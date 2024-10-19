import { initializeConfig, setConfigValue } from '../src/config.ts';
import { ConfigSchema } from '../src/schemas.ts';
import { z } from 'zod';

async function validateAndSetConfig() {
	// Define the configuration object
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
