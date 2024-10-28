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
 *
 * @param jetstream - The Jetstream instance
 * @param aeon - The Aeon instance
 */
function setupJetstreamListeners(jetstream: Jetstream, aeon: Aeon) {
	jetstream.on('open', () => {
		logger.info(
			`Connected to Jetstream at ${CONFIG.JETSTREAM_URL} with cursor ${jetstream.cursor}`,
		);
	});

	jetstream.on('close', () => {
		logger.info('Jetstream connection closed');
	});

	jetstream.on('error', (error: Error) => {
		logger.error(`Jetstream error: ${error.message}`);
	});

	jetstream.onCreate(CONFIG.COLLECTION, async (event: any) => {
		if (event.commit?.record?.subject?.uri?.includes(CONFIG.DID)) {
			try {
				const validatedDID = DidSchema.parse(event.did);
				const rkey = event.commit.record.subject.uri.split('/').pop()!;
				const validatedRkey = RkeySchema.parse(rkey);
				await aeon.handleLike(validatedDID, validatedRkey);
			} catch (error) {
				logger.error(
					`Error processing event: ${
						error instanceof JetstreamError ? error.message : String(error)
					}`,
				);
			}
		}
	});
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
