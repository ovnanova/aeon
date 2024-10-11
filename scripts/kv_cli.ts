const kv = await Deno.openKv();

async function listKeys() {
	const iter = kv.list({ prefix: [] });
	for await (const entry of iter) {
		console.log(
			`Key: ${entry.key.join(':')}, Value: ${JSON.stringify(entry.value)}`,
		);
	}
}

async function getValue(key: string[]) {
	const result = await kv.get(key);
	console.log(
		`Value for key ${key.join(':')}: ${JSON.stringify(result.value)}`,
	);
}

async function setValue(key: string[], value: unknown) {
	await kv.set(key, value);
	console.log(`Set value for key ${key.join(':')}`);
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
	console.log("KV store wiped");
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
	case 'delete':
	await deleteKey(key);
	break;
	case 'wipe':
	await wipeStore();
	break;
	default:
	console.log('Usage: deno run --allow-read --allow-write --unstable-kv kv_cli.ts [list|get|set|delete|wipe] [key...] [value]');
}
}

await main();
