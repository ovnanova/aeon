// kv_setup.ts
// - Script for initializing and setting up Deno KV store
// - Demonstrates how to validate and set configuration values
// - Provides a template for users to customize their own setup

import { initializeConfig, setConfigValue } from '../src/config.ts';
import { ConfigSchema } from '../src/schemas.ts';
import { z } from 'zod';

// validateAndSetConfig
// - Sets the initial configuration in the KV store
// - Uses Zod for schema validation before setting values
// - Logs results of the setup process
async function validateAndSetConfig() {
	const configToSet = {
		DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
		SIGNING_KEY:
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		JETSTREAM_URL: 'wss://jetstream1.us-west.bsky.network/subscribe',
		COLLECTION: 'app.bsky.feed.like',
		CURSOR_INTERVAL: 10000,
		BSKY_HANDLE: 'test.bsky.social',
		BSKY_PASSWORD: 'this-is-an-app-password',
		BSKY_URL: 'https://bsky.social',
	};

	try {
		// Validate the entire configuration object
		const validatedConfig = ConfigSchema.parse(configToSet);

		// If validation passes, initialize and set the values
		await initializeConfig();

		for (const [key, value] of Object.entries(validatedConfig)) {
			await setConfigValue(key as keyof z.infer<typeof ConfigSchema>, value);
		}

		console.log('Deno KV initialized with validated default values.');
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error('Configuration validation failed:');
			error.errors.forEach((err) => {
				console.error(`- ${err.path.join('.')}: ${err.message}`);
			});
		} else {
			console.error('An unexpected error occurred:', error);
		}
		Deno.exit(1);
	}
}

await validateAndSetConfig();

// Instructions for use:
// 1. Modify the 'configToSet' object with your desired configuration
// 2. Run the script using: deno task kv:setup
// 3. The script will validate your configuration and set it in the KV store
// 4. If there are any validation errors, they will be logged to the console
