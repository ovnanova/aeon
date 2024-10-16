import { assertEquals } from '@std/assert';
import { ConfigSchema } from '../src/schemas.ts';
import { closeConfig, CONFIG, initializeConfig } from '../src/config.ts';

Deno.test('Config loaded correctly and validates schema', async () => {
	try {
		await initializeConfig();

		const configKeys = Object.keys(CONFIG) as (keyof typeof CONFIG)[];
		const loadedConfig: Record<string, unknown> = {};

		for (const key of configKeys) {
			loadedConfig[key] = CONFIG[key];
		}

		const validatedConfig = ConfigSchema.parse(loadedConfig);
		assertEquals(
			validatedConfig,
			loadedConfig,
			'Validated config should match loaded config',
		);

		assertEquals(
			CONFIG.DID,
			'did:plc:7iza6de2dwap2sbkpav7c6c6',
			'DID should match expected value',
		);
		assertEquals(
			CONFIG.COLLECTION,
			'app.bsky.feed.like',
			'COLLECTION should match expected value',
		);
		assertEquals(
			CONFIG.CURSOR_INTERVAL,
			10000,
			'CURSOR_INTERVAL should match expected value',
		);
	} finally {
		await closeConfig();
	}
});
