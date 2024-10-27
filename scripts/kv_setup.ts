/**
 * KV Setup script for ÆON
 * Initializes KV store with required configuration values.
 *
 * Usage: deno task setup
 *
 * The script validates and sets the following required configuration:
 * - DID: The DID of the labeler account
 * - SIGNING_KEY: Key used to sign labels
 * - JETSTREAM_URL: WebSocket endpoint for the Jetstream service
 * - COLLECTION: The collection to monitor (e.g., 'app.bsky.feed.like')
 * - CURSOR_INTERVAL: Interval for cursor updates (in milliseconds)
 * - BSKY_HANDLE: Handle for the Bluesky account
 * - BSKY_PASSWORD: App password for authentication
 * - BSKY_URL: Bluesky API endpoint
 * - PORT: Port number for the labeler service
 */

import { initLogging } from '../src/logger.ts';
import { ConfigSchema } from '../src/schemas.ts';
import { setValue } from './kv_utils.ts';
import * as log from '@std/log';

await initLogging();
const logger = log.getLogger();

interface SetupConfig {
	DID: string;
	SIGNING_KEY: string;
	JETSTREAM_URL: string;
	COLLECTION: string;
	CURSOR_INTERVAL: number;
	BSKY_HANDLE: string;
	BSKY_PASSWORD: string;
	BSKY_URL: string;
	PORT: number;
}

/**
 * Default configuration values.
 * These should be overridden in production.
 */
const defaultConfig: SetupConfig = {
	DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
	SIGNING_KEY: 'K8ej1iNr0qpOT5RQZzA7/nMx2+4dFgYuCVbL3PwcJaU',
	JETSTREAM_URL: 'wss://jetstream1.us-west.bsky.network/subscribe',
	COLLECTION: 'app.bsky.feed.like',
	CURSOR_INTERVAL: 10000,
	BSKY_HANDLE: 'test.bsky.social',
	BSKY_PASSWORD: 'this-is-an-app-password',
	BSKY_URL: 'https://bsky.social',
	PORT: 1024,
};

async function setup() {
	try {
		logger.info('Starting KV store setup...');

		// Validate configuration
		const validatedConfig = ConfigSchema.parse(defaultConfig);
		logger.info('Configuration validated successfully');

		// Store each config value
		for (const [key, value] of Object.entries(validatedConfig)) {
			await setValue(['config', key], value);
			if (key !== 'SIGNING_KEY' && key !== 'BSKY_PASSWORD') {
				logger.info(`Set ${key}`, { value });
			} else {
				logger.info(`Set ${key}`, { value: '[REDACTED]' });
			}
		}

		logger.info('KV store setup completed successfully');
	} catch (error) {
		logger.error('Setup failed', {
			error: error instanceof Error ? error.message : String(error),
		});
		Deno.exit(1);
	}
}

await validateAndSetConfig();

// Instructions for use:
// 1. Modify the 'configToSet' object with your desired configuration
// 2. Run the script using: deno task kv:setup
// 3. The script will validate your configuration and set it in the KV store
// 4. If there are any validation errors, they will be logged to the console
await setup();
