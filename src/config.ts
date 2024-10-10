import { z } from 'zod';
import { ConfigSchema } from './schemas.ts';

const kv = await Deno.openKv();

async function getConfig(): Promise<z.infer<typeof ConfigSchema>> {
	const config: Partial<z.infer<typeof ConfigSchema>> = {};

	for (
		const key of Object.keys(ConfigSchema.shape) as Array<
			keyof z.infer<typeof ConfigSchema>
		>
	) {
		const result = await kv.get(['config', key]);
		if (result.value !== null) {
			config[key] = result.value as z.infer<typeof ConfigSchema>[typeof key];
		}
	}

	return ConfigSchema.parse(config);
}

export const CONFIG = await getConfig();

export async function setConfigValue(
	key: keyof z.infer<typeof ConfigSchema>,
	value: unknown,
): Promise<void> {
	const schema = ConfigSchema.shape[key] as z.ZodType<unknown>;
	const validatedValue = schema.parse(value);
	await kv.set(['config', key], validatedValue);
}

export async function initializeConfig(): Promise<void> {
	const defaultConfig: z.infer<typeof ConfigSchema> = {
		DID: 'did:plc:default',
		SIGNING_KEY:
			'0000000000000000000000000000000000000000000000000000000000000000',
		JETSTREAM_URL: 'wss://jetstream1.us-west.bsky.network/subscribe',
		COLLECTION: 'app.bsky.feed.like',
		CURSOR_INTERVAL: 100000,
		BSKY_HANDLE: 'default.handle',
		BSKY_PASSWORD: 'default_password',
	};

	for (const [key, value] of Object.entries(defaultConfig)) {
		const result = await kv.get(['config', key]);
		if (result.value === null) {
			await setConfigValue(key as keyof z.infer<typeof ConfigSchema>, value);
		}
	}
}

// Ensure the configuration is initialized
await initializeConfig();
