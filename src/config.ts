import { z } from 'zod';
import { ConfigSchema } from './schemas.ts';
import * as log from '@std/log';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';

class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

let kv: Deno.Kv | null = null;
let logger: log.Logger | null = null;

const defaultConfig: z.infer<typeof ConfigSchema> = {
	DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
	SIGNING_KEY:
		'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
	JETSTREAM_URL: 'wss://jetstream1.us-west.bsky.network/subscribe',
	COLLECTION: 'app.bsky.feed.like',
	CURSOR_INTERVAL: 10000,
	BSKY_HANDLE: 'default.handle',
	BSKY_PASSWORD: 'default_password',
};

async function getConfigFromKV(): Promise<z.infer<typeof ConfigSchema>> {
	if (Deno.env.get('DENO_ENV') === 'test') {
		return defaultConfig;
	}

	const config = { ...defaultConfig };
	const keys = Object.keys(
		defaultConfig,
	) as (keyof z.infer<typeof ConfigSchema>)[];

	for (const key of keys) {
		const result = await kv!.get(['config', key]);
		if (result.value !== null) {
			(config[key] as z.infer<typeof ConfigSchema>[typeof key]) = result
				.value as z.infer<typeof ConfigSchema>[typeof key];
		}
	}

	const redactedConfig = { ...config };
	for (const key of ['SIGNING_KEY', 'BSKY_PASSWORD'] as const) {
		if (redactedConfig[key]) {
			redactedConfig[key] = '[REDACTED]';
		}
	}

	logger?.debug(`Retrieved config from KV: ${JSON.stringify(redactedConfig)}`);
	return ConfigSchema.parse(config);
}

export let CONFIG: z.infer<typeof ConfigSchema>;

export async function setConfigValue<
	K extends keyof z.infer<typeof ConfigSchema>,
>(
	key: K,
	value: z.infer<typeof ConfigSchema>[K],
): Promise<void> {
	if (!CONFIG) {
		throw new ConfigurationError('CONFIG is not initialized');
	}
	if (!kv) {
		throw new ConfigurationError('KV store is not initialized');
	}
	const newConfig = { ...CONFIG, [key]: value };
	const validatedConfig = ConfigSchema.parse(newConfig);
	await kv.set(['config', key], validatedConfig[key]);
	CONFIG = validatedConfig;
	const logValue = ['SIGNING_KEY', 'BSKY_PASSWORD'].includes(key)
		? '[REDACTED]'
		: value;
	logger?.info(`Config value set: ${key} = ${logValue}`);
}

export async function initializeConfig(): Promise<void> {
	if (!kv) {
		kv = await Deno.openKv();
	}

	if (!logger) {
		const logDir = './logs';
		await ensureDir(logDir);
		const logFilePath = join(
			logDir,
			`aeon_${new Date().toISOString().split('T')[0]}.log`,
		);

		await log.setup({
			handlers: {
				console: new log.ConsoleHandler('INFO'),
				file: new log.FileHandler('DEBUG', {
					filename: logFilePath,
					formatter: (record) => {
						const { msg, ...rest } = record;
						return JSON.stringify({
							...rest,
							msg: typeof msg === 'string' ? msg : JSON.stringify(msg),
						});
					},
				}),
			},
			loggers: {
				default: {
					level: 'DEBUG',
					handlers: ['console', 'file'],
				},
			},
		});
		logger = log.getLogger();
		logger.info(`Logs are being saved to: ${logFilePath}`);
	}

	// Initialize KV store with default values if keys don't exist
	for (const [key, value] of Object.entries(defaultConfig)) {
		const result = await kv.get(['config', key]);
		if (result.value === null) {
			await kv.set(['config', key], value);
		}
	}

	// Now retrieve the configuration from KV store
	CONFIG = await getConfigFromKV();

	logger.info('Config initialization complete');
}
export async function closeConfig(): Promise<void> {
	if (logger) {
		for (const handler of logger.handlers) {
			if (handler instanceof log.FileHandler) {
				await handler.destroy();
			}
		}
	}
	if (kv) {
		await kv.close();
		kv = null;
	}
	logger = null;
}
