import { assertEquals, assertThrows } from '@std/assert';
import {
	CategorySchema,
	ConfigSchema,
	DidSchema,
	LabelSchema,
	RkeySchema,
	SigningKeySchema,
} from '../src/schemas.ts';

Deno.test('RkeySchema validation', () => {
	assertEquals(RkeySchema.parse('3jzfcijpj2z2a'), '3jzfcijpj2z2a');
	assertEquals(RkeySchema.parse('self'), 'self');

	assertThrows(
		() => RkeySchema.parse('3jzfcijpj2z2aa'),
		Error,
		'String must contain exactly 13 character(s)',
	);

	assertThrows(
		() => RkeySchema.parse('3jzfcijpj2z2A'),
		Error,
		'Invalid',
	);
});

Deno.test('LabelSchema validation', () => {
	const validLabel = {
		rkey: '3jzfcijpj2z2a',
		identifier: 'adlr',
		category: 'adlr',
	};
	assertEquals(LabelSchema.parse(validLabel), validLabel);

	assertThrows(
		() => LabelSchema.parse({ ...validLabel, rkey: '3jzfcijpj2z2aa' }),
		Error,
		'String must contain exactly 13 character(s)',
	);

	assertThrows(
		() => LabelSchema.parse({ ...validLabel, identifier: 'adlr-001' }),
		Error,
		'String must contain exactly 4 character(s)',
	);

	assertThrows(
		() => LabelSchema.parse({ ...validLabel, category: 'invalid' }),
		Error,
		'Invalid enum value',
	);
});

Deno.test('ConfigSchema validation', () => {
	const validConfig = {
		DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
		SIGNING_KEY:
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		JETSTREAM_URL: 'wss://jetstream1.us-west.bsky.network/subscribe',
		COLLECTION: 'app.bsky.feed.like',
		CURSOR_INTERVAL: 100000,
		BSKY_HANDLE: 'aeon.netwatch.dev',
		BSKY_PASSWORD: 'this-is-a-very-secure-password',
	};
	const parsedConfig = ConfigSchema.parse(validConfig);
	assertEquals(parsedConfig.DID, validConfig.DID);
	assertEquals(parsedConfig.SIGNING_KEY, validConfig.SIGNING_KEY);
	assertEquals(
		parsedConfig.JETSTREAM_URL,
		validConfig.JETSTREAM_URL,
	);
	assertEquals(parsedConfig.COLLECTION, validConfig.COLLECTION);
	assertEquals(parsedConfig.CURSOR_INTERVAL, validConfig.CURSOR_INTERVAL);
	assertEquals(parsedConfig.BSKY_HANDLE, validConfig.BSKY_HANDLE);
	assertEquals(parsedConfig.BSKY_PASSWORD, validConfig.BSKY_PASSWORD);

	assertThrows(
		() => ConfigSchema.parse({ ...validConfig, DID: 'invalid-did' }),
		Error,
		'Invalid',
	);

	assertThrows(
		() => ConfigSchema.parse({ ...validConfig, SIGNING_KEY: 'invalid-key' }),
		Error,
		'Invalid',
	);

	assertThrows(
		() => ConfigSchema.parse({ ...validConfig, JETSTREAM_URL: 'not-a-url' }),
		Error,
		'Invalid url',
	);

	assertThrows(
		() => ConfigSchema.parse({ ...validConfig, CURSOR_INTERVAL: -1 }),
		Error,
		'Number must be greater than 0',
	);

	assertThrows(
		() => ConfigSchema.parse({ ...validConfig, BSKY_HANDLE: '' }),
		Error,
		'String must contain at least 1 character(s)',
	);
});

Deno.test('DidSchema validation', () => {
	assertEquals(
		DidSchema.parse('did:plc:7iza6de2dwap2sbkpav7c6c6'),
		'did:plc:7iza6de2dwap2sbkpav7c6c6',
	);

	assertThrows(
		() => DidSchema.parse('invalid-did'),
		Error,
		'Invalid',
	);
});

Deno.test('SigningKeySchema validation', () => {
	const validKey =
		'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
	assertEquals(SigningKeySchema.parse(validKey), validKey);

	assertThrows(
		() => SigningKeySchema.parse('invalid-key'),
		Error,
		'Invalid',
	);

	assertThrows(
		() => SigningKeySchema.parse('0123456789abcdef'),
		Error,
		'Invalid',
	);
});

Deno.test('CategorySchema validation', () => {
	const validCategories = [
		'adlr',
		'arar',
		'eulr',
		'fklr',
		'klbr',
		'lstr',
		'mnhr',
		'star',
		'stcr',
		'drmr',
	];

	for (const category of validCategories) {
		assertEquals(CategorySchema.parse(category), category);
	}

	assertThrows(
		() => CategorySchema.parse('invalid'),
		Error,
		'Invalid enum value',
	);
});
