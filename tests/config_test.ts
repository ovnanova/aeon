import { assertEquals, assertExists } from '@std/assert';
import { ConfigSchema, DidSchema, SigningKeySchema } from '../src/schemas.ts';
import { closeConfig, CONFIG, initializeConfig } from '../src/config.ts';

Deno.test('Config loaded correctly and validates schema', async () => {
	try {
		await initializeConfig();

		// Validate the entire config object
		const validatedConfig = ConfigSchema.parse(CONFIG);
		assertEquals(
			Object.keys(validatedConfig).length,
			Object.keys(ConfigSchema.shape).length,
			'All expected config keys should be present',
		);

		// Validate DID format
		assertExists(CONFIG.DID, 'DID should exist');
		const didParseResult = DidSchema.safeParse(CONFIG.DID);
		assertEquals(didParseResult.success, true, 'DID should match the schema');

		// Validate SIGNING_KEY format
		assertExists(CONFIG.SIGNING_KEY, 'SIGNING_KEY should exist');
		const signingKeyParseResult = SigningKeySchema.safeParse(
			CONFIG.SIGNING_KEY,
		);
		assertEquals(
			signingKeyParseResult.success,
			true,
			'SIGNING_KEY should match the schema',
		);

		// Validate other config properties
		assertExists(CONFIG.JETSTREAM_URL, 'JETSTREAM_URL should exist');
		assertEquals(
			typeof CONFIG.JETSTREAM_URL,
			'string',
			'JETSTREAM_URL should be a string',
		);

		assertExists(CONFIG.COLLECTION, 'COLLECTION should exist');
		assertEquals(
			typeof CONFIG.COLLECTION,
			'string',
			'COLLECTION should be a string',
		);

		assertExists(CONFIG.CURSOR_INTERVAL, 'CURSOR_INTERVAL should exist');
		assertEquals(
			typeof CONFIG.CURSOR_INTERVAL,
			'number',
			'CURSOR_INTERVAL should be a number',
		);

		assertExists(CONFIG.BSKY_HANDLE, 'BSKY_HANDLE should exist');
		assertEquals(
			typeof CONFIG.BSKY_HANDLE,
			'string',
			'BSKY_HANDLE should be a string',
		);

		assertExists(CONFIG.BSKY_PASSWORD, 'BSKY_PASSWORD should exist');
		assertEquals(
			typeof CONFIG.BSKY_PASSWORD,
			'string',
			'BSKY_PASSWORD should be a string',
		);
		assertExists(CONFIG.BSKY_URL, 'BSKY_URL should exist');
		assertEquals(
			typeof CONFIG.BSKY_URL,
			'string',
			'BSKY_URL should be a string',
		);

		console.log('All config properties validated successfully');
	} finally {
		await closeConfig();
	}
});
