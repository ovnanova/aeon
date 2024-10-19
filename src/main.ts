// main.ts
// - Core application file for the ÆON labeler
// - Imports necessary modules and initializes key components
// - Sets up logging, configuration, and Deno KV store
// - Manages ATP agent, Aeon instance, and Jetstream connection
// - Handles cursor initialization and updates
// - Implements error handling and graceful shutdown

import { AtpAgent } from 'atproto';
import { Jetstream } from 'jetstream';
import { Aeon } from './aeon.ts';
import { CONFIG, initializeConfig } from './config.ts';
import { DidSchema, RkeySchema } from './schemas.ts';
import { verifyKvStore } from '../scripts/kv_utils.ts';
import * as log from '@std/log';

// Global constants
// - kv: Deno key-value store instance
// - logger: Logging instance from @std/log
const kv = await Deno.openKv();
const logger = log.getLogger();

// main function
// - Asynchronous function orchestrating the application
// - Initializes config, verifies KV store
// - Sets up ATP agent, Aeon, and Jetstream
// - Manages login, cursor, listeners, and shutdown handlers
async function main() {
	try {
		await initializeConfig();
		if (!(await verifyKvStore())) {
			throw new Error('KV store verification failed');
		}
		logger.info('KV store verified successfully');

		const agent = new AtpAgent({ service: CONFIG.BSKY_URL });
		const aeon = await Aeon.create();

		if (!CONFIG.BSKY_HANDLE || !CONFIG.BSKY_PASSWORD) {
			throw new Error(
				'BSKY_HANDLE and BSKY_PASSWORD must be set in the configuration',
			);
		}

		await agent.login({
			identifier: CONFIG.BSKY_HANDLE,
			password: CONFIG.BSKY_PASSWORD,
		});
		logger.info('Logged in to ATP successfully');

		await aeon.init();

		const cursor = await initializeCursor();

		if (!CONFIG.COLLECTION) {
			throw new Error('COLLECTION must be set in the configuration');
		}

		const jetstream = new Jetstream({
			wantedCollections: [CONFIG.COLLECTION],
			endpoint: CONFIG.JETSTREAM_URL,
			cursor: cursor,
		});

		setupJetstreamListeners(jetstream, aeon);

		jetstream.start();
		logger.info('Jetstream started');

		setupCursorUpdateInterval(jetstream);
		setupShutdownHandlers(jetstream);
	} catch (error) {
		logger.error(
			`Error in main: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		Deno.exit(1);
	}
}

// initializeCursor function
// - Retrieves or sets initial cursor value in KV store
// - Returns cursor as a number (microseconds since epoch)
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

// setupJetstreamListeners function
// - Sets up event listeners for Jetstream
// - Handles 'open', 'close', and 'error' events
// - Processes 'create' events for specified collection
function setupJetstreamListeners(jetstream: Jetstream, aeon: Aeon) {
	jetstream.on('open', () => {
		logger.info(
			`Connected to Jetstream at ${CONFIG.JETSTREAM_URL} with cursor ${jetstream.cursor}`,
		);
	});

	jetstream.on('close', () => {
		logger.info('Jetstream connection closed.');
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
				await aeon.assignLabel(validatedDID, validatedRkey);
			} catch (error) {
				logger.error(
					`Error processing event: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
	});
}

// setupCursorUpdateInterval function
// - Periodically updates cursor value in KV store
// - Uses interval specified in configuration
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

// setupShutdownHandlers function
// - Sets up handlers for SIGINT and SIGTERM signals
// - Ensures graceful shutdown of Jetstream connection
function setupShutdownHandlers(jetstream: Jetstream) {
	const shutdown = () => {
		logger.info('Shutting down...');
		jetstream.close();
		Deno.exit(0);
	};

	Deno.addSignalListener('SIGINT', shutdown);
	Deno.addSignalListener('SIGTERM', shutdown);
}

// Main execution
// - Runs the main function and handles any unhandled errors
main().catch((error) => {
	logger.critical(
		`Unhandled error in main: ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
	Deno.exit(1);
});
