// kv_utils.ts
// - Utility functions for interacting with Deno KV store
// - Provides CRUD operations and additional helpers
// - Implements KV store verification function

// getValue
// - Retrieves a value from the KV store by key
export async function getValue(key: Deno.KvKey): Promise<unknown> {
	const kv = await Deno.openKv();
	const result = await kv.get(key);
	return result.value;
}

// setValue
// - Sets a value in the KV store for a given key
export async function setValue(key: Deno.KvKey, value: unknown): Promise<void> {
	const kv = await Deno.openKv();
	await kv.set(key, value);
}

// updateValue
// - Updates a value in the KV store using a provided update function
export async function updateValue(
	key: Deno.KvKey,
	updateFn: (oldValue: unknown) => unknown,
): Promise<void> {
	const kv = await Deno.openKv();
	const existingEntry = await kv.get(key);
	const newValue = updateFn(existingEntry.value);

	await kv.set(key, newValue);
}

// deleteValue
// - Deletes a value from the KV store by key
export async function deleteValue(key: Deno.KvKey): Promise<void> {
	const kv = await Deno.openKv();
	await kv.delete(key);
}

// listKeys
// - Lists all keys in the KV store with a given prefix
export async function listKeys(prefix: Deno.KvKey): Promise<Deno.KvKey[]> {
	const kv = await Deno.openKv();
	const keys: Deno.KvKey[] = [];
	const iter = kv.list({ prefix });
	for await (const entry of iter) {
		keys.push(entry.key);
	}
	return keys;
}

// verifyKvStore
// - Verifies the KV store's functionality by performing a test operation
export async function verifyKvStore(): Promise<boolean> {
	const kv = await Deno.openKv();
	const testKey: Deno.KvKey = ['test', 'key'];
	const testValue = 'test_value';
	try {
		await kv.set(testKey, testValue);
		const result = await kv.get(testKey);
		await kv.delete(testKey);
		return result.value === testValue;
	} catch (error) {
		console.error('KV store verification failed:', error);
		return false;
	} finally {
		kv.close();
	}
}
