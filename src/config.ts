// - Configuration management module
// - Handles initialization, retrieval, and updating of configuration
// - Uses Deno KV for persistent storage
// - Implements logging for configuration operations
// - Provides placeholder configuration and schema validation

import { z } from 'zod';
import { ConfigSchema } from './schemas.ts';
import * as log from '@std/log';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { ConfigurationError } from './errors.ts';

// Global variables
// - kv: Deno KV store instance
// - logger: Logging instance from @std/log
let kv: Deno.Kv | null = null;
let logger: log.Logger | null = null;

/**
 * Default configuration object.
 * Used when initializing the configuration.
 * Contains non-functional example values.
 * Must be overridden with valid data before use by using: deno task kv:setup
 *
 * See scripts/kv_setup.ts for setting up the configuration.
 */
export const defaultConfig: z.infer<typeof ConfigSchema> = {
	DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
	SIGNING_KEY: 'K8ej1iNr0qpOT5RQZzA7/nMx2+4dFgYuCVbL3PwcJaU',
	JETSTREAM_URL: 'wss://jetstream1.us-west.bsky.network/subscribe',
	COLLECTION: 'app.bsky.feed.like',
	CURSOR: 0,
	CURSOR_INTERVAL: 10000,
	BSKY_HANDLE: 'default.handle',
	BSKY_PASSWORD: 'default_password',
	BSKY_URL: 'https://bsky.social',
	PORT: 1024,
	REMOVAL_RKEY: '3jzfcijpj2z2d',
};

/**
 * Retrieves configuration from KV store.
 * Falls back to placeholder values if not set.
 * Parses and validates config using ConfigSchema.
 * Returns placeholder config in test environment.
 *
 * See schemas.ts for ConfigSchema definition.
 */
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

/**
 * Exported configuration object.
 * Initialized during application startup.
 */
export let CONFIG: z.infer<typeof ConfigSchema>;

/**
 * Updates a single configuration value.
 * Validates entire config after update.
 * Persists change to KV store.
 *
 * @param key - The configuration key to update.
 * @param value - The new value for the configuration key.
 * @throws {ConfigurationError} If CONFIG is not initialized or KV store is not available.
 */
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
	if (key != 'CURSOR') {
		logger?.info(`Config value set: ${key} = ${logValue}`);
	}
}

/**
 * Initializes KV store, logger, and configuration.
 * Sets up log file and handlers.
 * Populates KV store with placeholder values if empty.
 * Retrieves and validates full configuration.
 */
export async function initializeConfig(): Promise<void> {
	if (!kv) {
		kv = await Deno.openKv();
	}

	if (!logger) {
		const logDir = './logs';
		await ensureDir(logDir);
		const logFilePath = join(
			logDir,
			`${new Date().toISOString().split('T')[0]}_labeler.log`,
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

/**
 * Closes and cleans up resources.
 * Destroys log handlers and closes KV store.
 */
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
