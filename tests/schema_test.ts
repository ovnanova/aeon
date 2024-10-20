import { assertEquals, assertThrows } from '@std/assert';
import {
	ConfigSchema,
	DidSchema,
	LabelCategorySchema,
	LabelIdentifierSchema,
	LabelSchema,
	RkeySchema,
	SigningKeySchema,
} from '../src/schemas.ts';
import { LABELS } from '../src/labels.ts';
import { defaultConfig } from '../src/config.ts';

Deno.test('RkeySchema validation', () => {
	LABELS.forEach((label) => {
		assertEquals(RkeySchema.parse(label.rkey), label.rkey);
	});

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
	assertThrows(
		() => RkeySchema.parse('invalid'),
		Error,
		'Invalid',
	);
});

Deno.test('DidSchema validation', () => {
	assertEquals(
		DidSchema.parse(defaultConfig.DID),
		defaultConfig.DID,
	);
	assertThrows(
		() => DidSchema.parse('invalid-did'),
		Error,
		'Invalid',
	);
	assertThrows(
		() => DidSchema.parse('did:plc:invalid'),
		Error,
		'Invalid',
	);
});

Deno.test('SigningKeySchema validation', () => {
	assertEquals(
		SigningKeySchema.parse(defaultConfig.SIGNING_KEY),
		defaultConfig.SIGNING_KEY,
	);
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
	assertThrows(
		() =>
			SigningKeySchema.parse(
				'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeX',
			),
		Error,
		'Invalid',
	);
});

Deno.test('LabelIdentifierSchema validation', () => {
	LABELS.forEach((label) => {
		assertEquals(
			LabelIdentifierSchema.parse(label.identifier),
			label.identifier,
		);
	});
	assertThrows(
		() => LabelIdentifierSchema.parse('invalid'),
		Error,
		'Invalid enum value',
	);
});

Deno.test('LabelCategorySchema validation', () => {
	LABELS.forEach((label) => {
		assertEquals(LabelCategorySchema.parse(label.category), label.category);
	});
	assertThrows(
		() => LabelCategorySchema.parse('invalid'),
		Error,
		'Invalid enum value',
	);
});

Deno.test('LabelSchema validation', () => {
	LABELS.forEach((label) => {
		assertEquals(LabelSchema.parse(label), label);
	});

	const validLabel = LABELS[0];
	assertThrows(
		() => LabelSchema.parse({ ...validLabel, rkey: '3jzfcijpj2z2aa' }),
		Error,
		'String must contain exactly 13 character(s)',
	);
	assertThrows(
		() => LabelSchema.parse({ ...validLabel, identifier: 'invalid' }),
		Error,
		'Invalid enum value',
	);
	assertThrows(
		() => LabelSchema.parse({ ...validLabel, category: 'invalid' }),
		Error,
		'Invalid enum value',
	);
	assertThrows(
		() => LabelSchema.parse({ ...validLabel, extraField: 'extra' }),
		Error,
		'Unrecognized key(s) in object',
	);
});

Deno.test('ConfigSchema validation', () => {
	const parsedConfig = ConfigSchema.parse(defaultConfig);
	assertEquals(parsedConfig, defaultConfig, 'Default config should be valid');

	assertThrows(
		() => ConfigSchema.parse({ ...defaultConfig, DID: 'invalid-did' }),
		Error,
		'Invalid',
	);
	assertThrows(
		() => ConfigSchema.parse({ ...defaultConfig, SIGNING_KEY: 'invalid-key' }),
		Error,
		'Invalid',
	);
	assertThrows(
		() => ConfigSchema.parse({ ...defaultConfig, JETSTREAM_URL: 'not-a-url' }),
		Error,
		'Invalid url',
	);
	assertThrows(
		() => ConfigSchema.parse({ ...defaultConfig, CURSOR_INTERVAL: -1 }),
		Error,
		'Number must be greater than 0',
	);
	assertThrows(
		() => ConfigSchema.parse({ ...defaultConfig, BSKY_HANDLE: '' }),
		Error,
		'String must contain at least 1 character(s)',
	);
	assertThrows(
		() => ConfigSchema.parse({ ...defaultConfig, EXTRA_FIELD: 'extra' }),
		Error,
		'Unrecognized key(s) in object',
	);
});
