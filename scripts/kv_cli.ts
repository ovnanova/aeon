import { SigningKeySchema } from '../src/schemas.ts';

const kv = await Deno.openKv();

async function listKeys() {
	const iter = kv.list({ prefix: [] });
	for await (const entry of iter) {
		const key = entry.key.join(':');
		let value = entry.value;

		// Mask sensitive information
		if (key === 'config:SIGNING_KEY' || key === 'config:BSKY_PASSWORD') {
			value = maskSensitiveValue(key, value);
		}

		console.log(`Key: ${key}, Value: ${JSON.stringify(value)}`);
	}
}

async function getValue(key: string[]) {
	const result = await kv.get(key);
	let value = result.value;

	// Mask sensitive information
	if (
		key[0] === 'config' &&
		(key[1] === 'SIGNING_KEY' || key[1] === 'BSKY_PASSWORD')
	) {
		value = maskSensitiveValue(key.join(':'), value);
	}

	console.log(`Value for key ${key.join(':')}: ${JSON.stringify(value)}`);
}

async function setValue(key: string[], value: unknown) {
	await kv.set(key, value);
	console.log(`Set value for key ${key.join(':')}`);
}

async function updateValue(key: string[], value: unknown) {
	await kv.set(key, value);
	console.log(`Updated value for key ${key.join(':')}`);
}

async function deleteKey(key: string[]) {
	await kv.delete(key);
	console.log(`Deleted key ${key.join(':')}`);
}

async function wipeStore() {
	const iter = kv.list({ prefix: [] });
	for await (const entry of iter) {
		await kv.delete(entry.key);
	}
	console.log('KV store wiped');
}

function maskSensitiveValue(key: string, value: unknown): string {
	if (typeof value !== 'string') {
		return '[INVALID]';
	}

	if (key.endsWith('SIGNING_KEY')) {
		return SigningKeySchema.safeParse(value).success ? '[VALID]' : '[INVALID]';
	}

	if (key.endsWith('BSKY_PASSWORD')) {
		return value.length > 0 ? '[SET]' : '[NOT SET]';
	}

	return '[MASKED]';
}

async function main() {
	const command = Deno.args[0];
	const key = Deno.args.slice(1, -1);
	const value = Deno.args[Deno.args.length - 1];

	switch (command) {
		case 'list':
			await listKeys();
			break;
		case 'get':
			await getValue(key);
			break;
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
				'Usage: deno run --allow-read --allow-write --unstable-kv kv_cli.ts [list|get|set|update|delete|wipe] [key...] [value]',
			);
	}
}

await main();
