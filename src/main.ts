/**
 * Core application file for ÆON
 *
 * This module serves as the entry point for the ÆON application, orchestrating:
 * - Configuration and logging setup
 * - ATP authentication
 * - Jetstream connection management
 * - Event processing lifecycle
 * - Graceful shutdown handling
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
import { Handler } from './handler.ts';

const kv = await Deno.openKv();
const logger = log.getLogger();

/**
 * Main function orchestrating the ÆON application.
 * Initializes core services and manages the application lifecycle.
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

			// Set up event listeners before initializing the handler
			setupJetstreamListeners(jetstream, aeon);

			// Initialize connection management
			const handler = new Handler(jetstream);
			await handler.start();
			logger.info('Jetstream started with connection management');

			setupCursorUpdateInterval(jetstream);
			setupShutdownHandlers(aeon, handler);
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
 * Configures event processing for the ÆON application.
 *
 * @param jetstream - The Jetstream instance
 * @param aeon - The ÆON instance
 */
function setupJetstreamListeners(
	jetstream: Jetstream<string, string>,
	aeon: Aeon,
) {
	jetstream.onCreate(CONFIG.COLLECTION, async (event: unknown) => {
		try {
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
 * Type guard to validate Jetstream event structure.
 *
 * @param event - The event object to validate
 * @returns True if the event has the required structure
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
 * Sets up periodic cursor updates.
 *
 * @param jetstream - The Jetstream instance
 */
function setupCursorUpdateInterval(jetstream: Jetstream<string, string>) {
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
 * Sets up handlers for graceful shutdown.
 *
 * @param aeon - The ÆON instance
 * @param handler - The connection handler
 */
function setupShutdownHandlers(aeon: Aeon, handler: Handler) {
	const shutdown = async () => {
		logger.info('Shutting down...');
		await aeon.shutdown();
		await handler.shutdown();
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
