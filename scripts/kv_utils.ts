/**
 * Deno KV utility functions
 * Provides type-safe CRUD operations and verification utilities.
 */

import { KvError } from '../src/errors.ts';
import * as log from '@std/log';

const logger = log.getLogger();

/**
 * Retrieves a value from the KV store.
 *
 * @param key - The key to retrieve
 * @returns The stored value, or null if not found
 * @throws {KvError} If retrieval fails
 */
export async function getValue<T>(key: Deno.KvKey): Promise<T | null> {
	try {
		const kv = await Deno.openKv();
		const result = await kv.get(key);
		await kv.close();
		return result.value as T;
	} catch (error) {
		logger.error(`Failed to get value for key ${key.join('/')}`, { error });
		throw new KvError(
			`Failed to get value for key ${key.join('/')}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Sets a value in the KV store.
 *
 * @param key - The key to set
 * @param value - The value to store
 * @throws {KvError} If the operation fails
 */
export async function setValue(key: Deno.KvKey, value: unknown): Promise<void> {
	try {
		const kv = await Deno.openKv();
		await kv.set(key, value);
		await kv.close();
		logger.debug(`Set value for key ${key.join('/')}`);
	} catch (error) {
		logger.error(`Failed to set value for key ${key.join('/')}`, { error });
		throw new KvError(
			`Failed to set value for key ${key.join('/')}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Deletes a value from the KV store.
 *
 * @param key - The key to delete
 * @throws {KvError} If deletion fails
 */
export async function deleteValue(key: Deno.KvKey): Promise<void> {
	try {
		const kv = await Deno.openKv();
		await kv.delete(key);
		await kv.close();
		logger.debug(`Deleted value for key ${key.join('/')}`);
	} catch (error) {
		logger.error(`Failed to delete value for key ${key.join('/')}`, { error });
		throw new KvError(
			`Failed to delete value for key ${key.join('/')}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Lists all keys with a given prefix.
 *
 * @param prefix - The key prefix to list
 * @returns Array of matching keys
 * @throws {KvError} If listing fails
 */
export async function listKeys(prefix: Deno.KvKey): Promise<Deno.KvKey[]> {
	try {
		const kv = await Deno.openKv();
		const keys: Deno.KvKey[] = [];
		const iter = kv.list({ prefix });
		for await (const entry of iter) {
			keys.push(entry.key);
		}
		await kv.close();
		return keys;
	} catch (error) {
		logger.error(`Failed to list keys with prefix ${prefix.join('/')}`, {
			error,
		});
		throw new KvError(
			`Failed to list keys with prefix ${prefix.join('/')}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Verifies KV store functionality with a test operation.
 *
 * @returns true if verification succeeds
 * @throws {KvError} If verification fails
 */
export async function verifyKvStore(): Promise<boolean> {
	const testKey: Deno.KvKey = ['test', crypto.randomUUID()];
	const testValue = 'test_value';

	try {
		const kv = await Deno.openKv();
		await kv.set(testKey, testValue);
		const result = await kv.get(testKey);
		await kv.delete(testKey);
		await kv.close();

		if (result.value !== testValue) {
			throw new Error('Value mismatch in verification');
		}

		logger.info('KV store verification successful');
		return true;
	} catch (error) {
		logger.error('KV store verification failed', { error });
		throw new KvError(
			`KV store verification failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}
