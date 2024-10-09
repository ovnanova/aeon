import { z } from 'zod';
import { ConfigSchema } from '../src/schemas.ts';
import { assertEquals, assertThrows } from '@std/assert';
import { load } from '@std/dotenv';

const env = await load();

const envConfig = {
	DID: env['DID'] || Deno.env.get('DID'),
	SIGNING_KEY: env['SIGNING_KEY'] || Deno.env.get('SIGNING_KEY'),
	JETSTREAM_URL: env['JETSTREAM_URL'] || Deno.env.get('JETSTREAM_URL'),
	COLLECTION: env['COLLECTION'] || Deno.env.get('COLLECTION'),
	CURSOR_INTERVAL: env['CURSOR_INTERVAL']
		? Number(env['CURSOR_INTERVAL'])
		: Deno.env.get('CURSOR_INTERVAL')
		? Number(Deno.env.get('CURSOR_INTERVAL'))
		: undefined,
	BSKY_HANDLE: env['BSKY_HANDLE'] || Deno.env.get('BSKY_HANDLE'),
	BSKY_PASSWORD: env['BSKY_PASSWORD'] || Deno.env.get('BSKY_PASSWORD'),
};

export const CONFIG = ConfigSchema.parse(envConfig);

z.object(ConfigSchema.shape).parse(CONFIG);

const testConfig = {
	DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
	SIGNING_KEY: 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme',
	JETSTREAM_URL: 'wss://jetstream.atproto.tools/subscribe',
	COLLECTION: 'app.bsky.feed.like',
	CURSOR_INTERVAL: 100000,
	BSKY_HANDLE: 'battlemaster.netwatch.dev',
	BSKY_PASSWORD: 'this-is-a-very-secure-password',
};

Deno.test('.env file load validation', () => {
	assertEquals(ConfigSchema.parse(CONFIG), testConfig);
	Deno.test('.env file load validation', () => {
		assertEquals(ConfigSchema.parse(CONFIG), testConfig);

		assertThrows(
			() => ConfigSchema.parse({ ...CONFIG, JETSTREAM_URL: 'not-a-url' }),
			Error,
			'Invalid url',
		);

		assertThrows(
			() => ConfigSchema.parse({ ...CONFIG, DID: 'invalid-did' }),
			Error,
			'invalid_string',
		);

		assertThrows(
			() =>
				ConfigSchema.parse({ ...CONFIG, SIGNING_KEY: 'invalid-signing-key' }),
			Error,
			'invalid_string',
		);

		assertThrows(
			() => ConfigSchema.parse({ ...CONFIG, CURSOR_INTERVAL: -1 }),
			Error,
			'Number must be greater than 0',
		);

		assertThrows(
			() => ConfigSchema.parse({ ...CONFIG, BSKY_HANDLE: '' }),
			Error,
			'String must contain at least 1 character(s)',
		);
	});
});
