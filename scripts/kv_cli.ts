/**
 * CLI utility for managing the Deno KV store
 * Provides commands for configuration and metrics management.
 */
import { ConfigSchema } from '../src/schemas.ts';
import { z } from 'zod';
import * as log from '@std/log';

const kv = await Deno.openKv();
const logger = log.getLogger();

/**
 * Validates a key-value pair against schema
 * @param key KV key to validate
 * @param value Value to validate
 * @throws {Error} If validation fails
 */
function validateKeyValue(key: Deno.KvKey, value: unknown): void {
	if (key[0] !== 'config' || key.length !== 2 || typeof key[1] !== 'string') {
		throw new Error(
			'Invalid key structure. Expected ["config", "<CONFIG_KEY>"]',
		);
	}

	const configKey = key[1] as keyof z.infer<typeof ConfigSchema>;
	if (!(configKey in ConfigSchema.shape)) {
		throw new Error(`Invalid config key: ${configKey}`);
	}

	const schema = ConfigSchema.shape[configKey] as z.ZodType<unknown>;
	try {
		schema.parse(value);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(
				`Invalid value for ${configKey}: ${
					error.errors.map((e) => e.message).join(', ')
				}`,
			);
		}
		throw error;
	}
}

/**
 * Lists all keys and values in the KV store
 */
async function listKeys(): Promise<void> {
	const iter = kv.list({ prefix: ['config'] });
	for await (const entry of iter) {
		const key = entry.key.join(':');
		let value = entry.value;

		if (entry.key[1] === 'SIGNING_KEY' || entry.key[1] === 'BSKY_PASSWORD') {
			value = maskSensitiveValue(value);
		}

		logger.info(`Key: ${key}, Value: ${JSON.stringify(value)}`);
	}
}

/**
 * Gets value for a specific key
 * @param key KV key to retrieve
 */
async function getValue(key: Deno.KvKey): Promise<void> {
	const result = await kv.get(key);
	let value = result.value;

	if (value === null) {
		logger.info(`No value found for key ${key.join(':')}`);
		return;
	}

	if (key[1] === 'SIGNING_KEY' || key[1] === 'BSKY_PASSWORD') {
		value = maskSensitiveValue(value);
	}

	logger.info(`Value for key ${key.join(':')}: ${JSON.stringify(value)}`);
}

/**
 * Sets value for a specific key
 * @param key KV key to set
 * @param value Value to store
 */
async function setValue(key: Deno.KvKey, value: unknown): Promise<void> {
	// Convert string number to actual number before validation
	const parsedValue = typeof value === 'string' && !isNaN(Number(value))
		? Number(value)
		: value;

	validateKeyValue(key, parsedValue);
	await kv.set(key, parsedValue);
	logger.info(
		`Set value for key ${key.join(':')}: ${JSON.stringify(parsedValue)}`,
	);
}

/**
 * Deletes a specific key
 * @param key KV key to delete
 */
async function deleteKey(key: Deno.KvKey): Promise<void> {
	await kv.delete(key);
	logger.info(`Deleted key ${key.join(':')}`);
}

/**
 * Wipes all data from the KV store
 */
async function wipeStore(): Promise<void> {
	const iter = kv.list({ prefix: ['config'] });
	for await (const entry of iter) {
		await kv.delete(entry.key);
	}
	logger.info('KV store wiped');
}

/**
 * Masks sensitive values for display
 * @param value Value to mask
 * @returns Masked string
 */
function maskSensitiveValue(value: unknown): string {
	if (typeof value !== 'string') return '[INVALID]';
	return '[REDACTED]';
}

/**
 * Shows CLI help information
 */
function showHelp(): void {
	console.log(
		'Usage:\n' +
			'  deno task kv:list              List all config keys and values\n' +
			'  deno task kv:get <KEY>         Get value for a key\n' +
			'  deno task kv:set <KEY> <value> Set value for a key\n' +
			'  deno task kv:delete <KEY>      Delete a key\n' +
			'  deno task kv:wipe              Delete all data\n' +
			'  deno task metrics              Show metrics data\n' +
			'  deno task metrics:clear        Clear metrics data\n',
	);
}

/**
 * Main CLI function
 */
async function main() {
	const command = Deno.args[0];
	const args = Deno.args.slice(1);

	try {
		switch (command) {
			case 'list':
				await listKeys();
				break;
			case 'get':
				await getValue(args as Deno.KvKey);
				break;
			case 'set':
				await setValue(args.slice(0, -1) as Deno.KvKey, args[args.length - 1]);
				break;
			case 'delete':
				await deleteKey(args as Deno.KvKey);
				break;
			case 'wipe':
				await wipeStore();
				break;
			default:
				showHelp();
		}
	} catch (error) {
		logger.error(
			`Error: ${error instanceof Error ? error.message : String(error)}`,
		);
		Deno.exit(1);
	} finally {
		await kv.close();
	}
}

await main();
