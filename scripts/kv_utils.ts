export async function getValue(key: Deno.KvKey): Promise<unknown> {
	const kv = await Deno.openKv();
	const result = await kv.get(key);
	return result.value;
}

export async function setValue(key: Deno.KvKey, value: unknown): Promise<void> {
	const kv = await Deno.openKv();
	await kv.set(key, value);
}

export async function updateValue(
	key: Deno.KvKey,
	updateFn: (oldValue: unknown) => unknown,
): Promise<void> {
	const kv = await Deno.openKv();
	const existingEntry = await kv.get(key);
	const newValue = updateFn(existingEntry.value);

	await kv.set(key, newValue);
}

export async function deleteValue(key: Deno.KvKey): Promise<void> {
	const kv = await Deno.openKv();
	await kv.delete(key);
}

export async function listKeys(prefix: Deno.KvKey): Promise<Deno.KvKey[]> {
	const kv = await Deno.openKv();
	const keys: Deno.KvKey[] = [];
	const iter = kv.list({ prefix });
	for await (const entry of iter) {
		keys.push(entry.key);
	}
	return keys;
}

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
