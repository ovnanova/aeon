// kv_cli.ts
// - Command-line interface for managing the Deno KV store
// - Provides functions for listing, getting, setting, updating, and deleting KV pairs
// - Implements input validation and error handling
// - Masks sensitive values when displayed

import { ConfigSchema, SigningKeySchema } from '../src/schemas.ts';
import { z } from 'zod';

const kv = await Deno.openKv();

// validateKeyValue
// - Validates a key-value pair against the ConfigSchema
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

// listKeys
// - Lists all keys and their values in the KV store
// - Call this function by using: deno task kv:list
async function listKeys() {
	const iter = kv.list({ prefix: ['config'] });
	for await (const entry of iter) {
		const key = entry.key.join(':');
		let value = entry.value;

		if (entry.key[1] === 'SIGNING_KEY' || entry.key[1] === 'BSKY_PASSWORD') {
			value = maskSensitiveValue(entry.key, value);
		}

		console.log(`Key: ${key}, Value: ${JSON.stringify(value)}`);
	}
}

// getValue
// - Retrieves and displays the value for a given key
// - Call this function by using: deno task kv:get config <KEY>
async function getValue(key: Deno.KvKey) {
	if (key[0] !== 'config' || key.length !== 2) {
		throw new Error(
			'Invalid key structure. Expected ["config", "<CONFIG_KEY>"]',
		);
	}

	const result = await kv.get(key);
	let value = result.value;

	if (value === null) {
		console.log(`No value found for key ${key.join(':')}`);
		return;
	}

	if (key[1] === 'SIGNING_KEY' || key[1] === 'BSKY_PASSWORD') {
		value = maskSensitiveValue(key, value);
	}

	console.log(`Value for key ${key.join(':')}: ${JSON.stringify(value)}`);
}

// setValue
// - Sets a value for a given key after validation
// - Call this function by using: deno task kv:set config <KEY> <value>
async function setValue(key: Deno.KvKey, value: unknown) {
	validateKeyValue(key, value);
	await kv.set(key, value);
	console.log(`Set value for key ${key.join(':')}: ${JSON.stringify(value)}`);
}

// updateValue
// - Updates a value for a given key after validation
// - Call this function by using: deno task kv:update config <KEY> <value>
async function updateValue(key: Deno.KvKey, value: unknown) {
	validateKeyValue(key, value);
	await kv.set(key, value);
	console.log(
		`Updated value for key ${key.join(':')}: ${JSON.stringify(value)}`,
	);
}

// deleteKey
// - Deletes a key-value pair from the KV store
// - Call this function by using: deno task kv:delete config <KEY>
async function deleteKey(key: Deno.KvKey) {
	if (key[0] !== 'config' || key.length !== 2 || typeof key[1] !== 'string') {
		throw new Error(
			'Invalid key structure. Expected ["config", "<CONFIG_KEY>"]',
		);
	}

	const configKey = key[1] as keyof z.infer<typeof ConfigSchema>;
	if (!(configKey in ConfigSchema.shape)) {
		throw new Error(`Invalid config key: ${configKey}`);
	}

	await kv.delete(key);
	console.log(`Deleted key ${key.join(':')}`);
}

// wipeStore
// - Removes all key-value pairs from the KV store
// - Call this function by using: deno task kv:wipe
async function wipeStore() {
	const iter = kv.list({ prefix: ['config'] });
	for await (const entry of iter) {
		await kv.delete(entry.key);
	}
	console.log('KV store wiped');
}

// maskSensitiveValue
// - Masks sensitive values when displayed in the CLI
function maskSensitiveValue(key: Deno.KvKey, value: unknown): string {
	if (typeof value !== 'string') {
		return '[INVALID]';
	}

	if (key[1] === 'SIGNING_KEY') {
		return SigningKeySchema.safeParse(value).success ? '[VALID]' : '[INVALID]';
	}

	if (key[1] === 'BSKY_PASSWORD') {
		return value.length > 0 ? '[SET]' : '[NOT SET]';
	}

	return value;
}

// main
// - Parses command-line arguments and executes the appropriate function
async function main() {
	const command = Deno.args[0];
	const key = Deno.args.slice(1, -1) as Deno.KvKey;
	const value = Deno.args[Deno.args.length - 1];

	try {
		switch (command) {
			case 'list':
				await listKeys();
				break;
			case 'get': {
				const getKey = Deno.args.slice(1) as Deno.KvKey;
				await getValue(getKey);
				break;
			}
			case 'set':
				await setValue(key, value);
				break;
			case 'update':
				await updateValue(key, value);
				break;
			case 'delete':
				await deleteKey(key);
				break;
			case 'wipe':
				await wipeStore();
				break;
			default:
				console.log(
					'Usage:\n' +
						'  deno task kv:list\n' +
						'  deno task kv:get config <KEY>\n' +
						'  deno task kv:set config <KEY> <value>\n' +
						'  deno task kv:update config <KEY> <value>\n' +
						'  deno task kv:delete config <KEY>\n' +
						'  deno task kv:wipe\n\n' +
						'Examples:\n' +
						'  deno task kv:list\n' +
						'  deno task kv:get config JETSTREAM_URL\n' +
						'  deno task kv:set config JETSTREAM_URL "wss://example.com"\n' +
						'  deno task kv:update config CURSOR_INTERVAL 10000\n' +
						'  deno task kv:delete config COLLECTION\n' +
						'  deno task kv:wipe',
				);
		}
	} catch (error) {
		console.error(`Error: ${(error as Error).message}`);
	}
}

await main();

// Usage instructions are provided when running the script without arguments or with an invalid command
