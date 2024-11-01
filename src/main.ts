/**
 * Core application file for ÆON
 *
 * - Imports necessary modules and initializes key components
 * - Sets up logging, configuration, and Deno KV store
 * - Manages ATP agent, Aeon instance, and Jetstream connection
 * - Handles cursor initialization and updates
 * - Implements error handling and graceful shutdown
 */

import { AtpAgent } from 'atproto';
import { Jetstream } from 'jetstream';
import { Aeon } from './aeon.ts';
import { closeConfig, CONFIG, initializeConfig } from './config.ts';
import { DidSchema, RkeySchema } from './schemas.ts';
import { verifyKvStore } from '../scripts/kv_utils.ts';
import { AtpError, JetstreamError } from './errors.ts';
import * as log from '@std/log';
import { MetricsTracker } from './metrics.ts';

const kv = await Deno.openKv();
const logger = log.getLogger();

/**
 * Main function orchestrating the application.
 * Initializes config, verifies KV store, sets up ATP agent, Aeon, and Jetstream.
 * Manages login, cursor, listeners, and shutdown handlers.
 *
 * @throws {AtpError} If ATP initialization or login fails
 * @throws {JetstreamError} If Jetstream connection fails
 */
async function main() {
	try {
		await initializeConfig();
		if (!(await verifyKvStore())) {
			throw new Error('KV store verification failed');
		}
		logger.info('KV store verified successfully');

		const agent = new AtpAgent({ service: CONFIG.BSKY_URL });
		const metrics = new MetricsTracker(kv);
		const aeon = new Aeon(metrics);

		if (!CONFIG.BSKY_HANDLE || !CONFIG.BSKY_PASSWORD) {
			throw new AtpError(
				'BSKY_HANDLE and BSKY_PASSWORD must be set in the configuration',
			);
		}

		try {
			await agent.login({
				identifier: CONFIG.BSKY_HANDLE,
				password: CONFIG.BSKY_PASSWORD,
			});
			logger.info('Logged in to ATP successfully');
		} catch (error) {
			if (error instanceof Error) {
				throw new AtpError(`ATP login failed: ${error.message}`);
			} else {
				throw new AtpError('ATP login failed: Unknown error');
			}
		}

		await aeon.init();

		const cursor = await initializeCursor();

		try {
			const jetstream = new Jetstream({
				wantedCollections: [CONFIG.COLLECTION],
				endpoint: CONFIG.JETSTREAM_URL,
				cursor: cursor,
			});

			setupJetstreamListeners(jetstream, aeon);

			jetstream.start();
			logger.info('Jetstream started');

			setupCursorUpdateInterval(jetstream);
			setupShutdownHandlers(aeon, jetstream);
		} catch (error) {
			if (error instanceof Error) {
				throw new JetstreamError(
					`Jetstream initialization failed: ${error.message}`,
				);
			} else {
				throw new JetstreamError(
					'Jetstream initialization failed: Unknown error',
				);
			}
		}
	} catch (error) {
		if (error instanceof AtpError || error instanceof JetstreamError) {
			logger.error(`Error in main: ${error.message}`);
		} else {
			logger.error(`Error in main: ${String(error)}`);
		}
		Deno.exit(1);
	}
}

/**
 * Initializes or retrieves the cursor value from the KV store.
 * The cursor represents a point in time (in microseconds) from which
 * to start processing events.
 *
 * @returns The cursor value in microseconds since epoch
 */
async function initializeCursor(): Promise<number> {
	const cursorResult = await kv.get(['cursor']);
	if (cursorResult.value === null) {
		const cursor = Date.now() * 1000;
		logger.info(
			`Cursor not found, setting to: ${cursor} (${
				new Date(cursor / 1000).toISOString()
			})`,
		);
		await kv.set(['cursor'], cursor);
		return cursor;
	} else {
		const cursor = cursorResult.value as number;
		logger.info(
			`Cursor found: ${cursor} (${new Date(cursor / 1000).toISOString()})`,
		);
		return cursor;
	}
}

/**
 * Sets up event listeners for Jetstream.
 * Handles 'open', 'close', and 'error' events.
 * Processes 'create' events for the specified collection.
 * Implements exponential backoff reconnection strategy.
 *
 * @param jetstream - The Jetstream instance
 * @param aeon - The Aeon instance
 */
function setupJetstreamListeners(jetstream: Jetstream, aeon: Aeon) {
	let reconnectAttempt = 0;
	const MAX_RECONNECT_ATTEMPTS = 10;

	jetstream.on('open', () => {
		// Reset reconnection counter on successful connection
		reconnectAttempt = 0;
		logger.info(
			`Connected to Jetstream at ${CONFIG.JETSTREAM_URL} with cursor ${jetstream.cursor}`,
		);
	});

	jetstream.on('close', () => {
		logger.info('Jetstream connection closed');

		// Reconnection with exponential backoff
		if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
			const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000); // Cap at 30 seconds
			reconnectAttempt++;

			logger.info(
				`Attempting reconnection in ${delay}ms (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`,
			);

			setTimeout(() => {
				try {
					jetstream.start();
				} catch (error) {
					logger.error(
						`Reconnection attempt failed: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
				}
			}, delay);
		} else {
			logger.error(
				'Max reconnection attempts reached. Manual intervention required.',
			);
		}
	});

	jetstream.on('error', () => {
		// Just log that an error occurred - don't try to access error properties
		// as the underlying WebSocket implementation might not provide them
		logger.error('Jetstream encountered a WebSocket error');

		// Let the close handler handle reconnection
		// as error events are usually followed by close events
	});

	jetstream.onCreate(CONFIG.COLLECTION, async (event: unknown) => {
		try {
			// Type guard for event structure
			if (!isValidEvent(event)) {
				logger.error('Received invalid event structure:', { event });
				return;
			}

			if (event.commit?.record?.subject?.uri?.includes(CONFIG.DID)) {
				const validatedDID = DidSchema.parse(event.did);
				const rkey = event.commit.record.subject.uri.split('/').pop();

				if (!rkey) {
					logger.error('Could not extract rkey from event:', { event });
					return;
				}

				const validatedRkey = RkeySchema.parse(rkey);
				await aeon.handleLike(validatedDID, validatedRkey);
			}
		} catch (error) {
			logger.error(
				`Error processing event: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	});
}

/**
 * Type guard to validate Jetstream event structure
 */
function isValidEvent(event: unknown): event is {
	did: string;
	commit: {
		record: {
			subject: {
				uri: string;
			};
		};
	};
} {
	if (typeof event !== 'object' || event === null) return false;

	const e = event as Record<string, unknown>;
	return (
		typeof e.did === 'string' &&
		typeof e.commit === 'object' && e.commit !== null &&
		typeof (e.commit as Record<string, unknown>).record === 'object' &&
		(e.commit as Record<string, unknown>).record !== null &&
		typeof ((e.commit as Record<string, unknown>).record as Record<
				string,
				unknown
			>).subject === 'object' &&
		((e.commit as Record<string, unknown>).record as Record<string, unknown>)
				.subject !== null &&
		typeof (((e.commit as Record<string, unknown>).record as Record<
				string,
				unknown
			>).subject as Record<string, unknown>).uri === 'string'
	);
}

/**
 * Sets up an interval to periodically update the cursor value in the KV store.
 * This ensures we can resume from the last processed event after a restart.
 *
 * @param jetstream - The Jetstream instance to get the cursor from
 */
function setupCursorUpdateInterval(jetstream: Jetstream) {
	setInterval(async () => {
		if (jetstream.cursor) {
			logger.info(
				`Updating cursor to: ${jetstream.cursor} (${
					new Date(jetstream.cursor / 1000).toISOString()
				})`,
			);
			await kv.set(['cursor'], jetstream.cursor);
		}
	}, CONFIG.CURSOR_INTERVAL);
}

/**
 * Sets up handlers for SIGINT and SIGTERM signals to ensure graceful shutdown.
 * Closes all connections and cleans up resources before exiting.
 *
 * @param aeon - The Aeon instance to shut down
 * @param jetstream - The Jetstream instance to close
 */
function setupShutdownHandlers(aeon: Aeon, jetstream: Jetstream) {
	const shutdown = async () => {
		logger.info('Shutting down...');
		await aeon.shutdown();
		jetstream.close();
		await closeConfig();
		kv.close();
		Deno.exit(0);
	};

	Deno.addSignalListener('SIGINT', shutdown);
	Deno.addSignalListener('SIGTERM', shutdown);
}

// Main execution
main().catch((error) => {
	logger.critical(
		`Unhandled error in main: ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
	Deno.exit(1);
});
