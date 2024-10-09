import { assertEquals, assertThrows } from '@std/assert';
import {
	ConfigSchema,
	DidSchema,
	LabelSchema,
	LabelValueDefinitionSchema,
	LocaleSchema,
	SigningKeySchema,
} from '../src/schemas.ts';

Deno.test('LocaleSchema validation', () => {
	const validLocale = {
		lang: 'en',
		name: 'English',
		description: 'English language',
	};
	assertEquals(LocaleSchema.parse(validLocale), validLocale);

	assertThrows(
		() => LocaleSchema.parse({ ...validLocale, lang: 123 }),
		Error,
		'Expected string, received number',
	);
});

Deno.test('LabelSchema validation', () => {
	const validLabel = {
		rkey: '3jzfcijpj2z2a',
		identifier: 'test-label',
		locales: [
			{ lang: 'en', name: 'Test Label', description: 'A test label' },
		],
	};
	assertEquals(LabelSchema.parse(validLabel), validLabel);

	assertThrows(
		() => LabelSchema.parse({ ...validLabel, rkey: '3jzfcijpj2z2aa' }),
		Error,
		'String must contain exactly 13 character(s)',
	);

	assertThrows(
		() => LabelSchema.parse({ ...validLabel, rkey: '3jzfcijpj2z2A' }),
		Error,
		'invalid_string',
	);
});

Deno.test('LabelValueDefinitionSchema validation', () => {
	const validLabelValueDefinition = {
		identifier: 'test-label',
		severity: 'inform',
		blurs: 'none',
		defaultSetting: 'warn',
		adultOnly: false,
		locales: [
			{ lang: 'en', name: 'Test Label', description: 'A test label' },
		],
	};
	assertEquals(
		LabelValueDefinitionSchema.parse(validLabelValueDefinition),
		validLabelValueDefinition,
	);

	assertThrows(
		() =>
			LabelValueDefinitionSchema.parse({
				...validLabelValueDefinition,
				severity: 'invalid',
			}),
		Error,
		"Invalid enum value. Expected 'inform' | 'alert' | 'none', received 'invalid'",
	);
});

Deno.test('ConfigSchema validation', () => {
	const validConfig = {
		DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
		SIGNING_KEY: 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme',
		JETSTREAM_URL: 'wss://jetstream.atproto.tools/subscribe',
		COLLECTION: 'app.bsky.feed.like',
		CURSOR_INTERVAL: 100000,
		BSKY_HANDLE: 'battlemaster.netwatch.dev',
		BSKY_PASSWORD: 'this-is-a-very-secure-password',
	};
	assertEquals(ConfigSchema.parse(validConfig), validConfig);

	const validConfigWithP256 = {
		...validConfig,
		SIGNING_KEY: 'did:key:zDnaerx9CtbPJ1q36T5Ln5wYt3MQYeGRG5ehnPAmxcf5mDZpv',
	};
	assertEquals(ConfigSchema.parse(validConfigWithP256), validConfigWithP256);

	assertThrows(
		() => ConfigSchema.parse({ ...validConfig, DID: 'invalid-did' }),
		Error,
		'invalid_string',
	);

	assertThrows(
		() => ConfigSchema.parse({ ...validConfig, SIGNING_KEY: 'invalid-key' }),
		Error,
		'invalid_string',
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
		() => ConfigSchema.parse({ ...validConfig, BSKY_HANDLE: undefined }),
		Error,
		'Required',
	);

	assertEquals(ConfigSchema.shape.DID, DidSchema);

	assertEquals(ConfigSchema.shape.SIGNING_KEY, SigningKeySchema);
});
