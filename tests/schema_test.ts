import { assertEquals, assertThrows } from '@std/assert';
import {
  ConfigSchema,
  DidSchema,
  LabelSchema,
  SigningKeySchema,
  RkeySchema,
  CategorySchema,
} from '../src/schemas.ts';

Deno.test('RkeySchema validation', () => {
  assertEquals(RkeySchema.parse('3jzfcijpj2z2a'), '3jzfcijpj2z2a');
  assertEquals(RkeySchema.parse('self'), 'self');

  assertThrows(
    () => RkeySchema.parse('3jzfcijpj2z2aa'),
    Error,
    'Invalid',
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
    identifier: 'test-label',
    category: 'adlr',
  };
  assertEquals(LabelSchema.parse(validLabel), validLabel);

  assertThrows(
    () => LabelSchema.parse({ ...validLabel, rkey: '3jzfcijpj2z2aa' }),
    Error,
    'Invalid',
  );

  assertThrows(
    () => LabelSchema.parse({ ...validLabel, category: 'invalid' }),
    Error,
    'Invalid',
  );
});

Deno.test('ConfigSchema validation', () => {
  const validConfig = {
    DID: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
    SIGNING_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    JETSTREAM_URL: 'wss://jetstream1.us-west.bsky.network/subscribe',
    COLLECTION: 'app.bsky.feed.like',
    CURSOR_INTERVAL: 100000,
    BSKY_HANDLE: 'aeon.netwatch.dev',
    BSKY_PASSWORD: 'this-is-a-very-secure-password',
  };
  assertEquals(ConfigSchema.parse(validConfig), validConfig);

  assertThrows(
    () => ConfigSchema.parse({ ...validConfig, DID: 'invalid-did' }),
    Error,
    'Invalid input',
  );

  assertThrows(
    () => ConfigSchema.parse({ ...validConfig, SIGNING_KEY: 'invalid-key' }),
    Error,
    'Invalid input',
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
  assertEquals(DidSchema.parse('did:plc:7iza6de2dwap2sbkpav7c6c6'), 'did:plc:7iza6de2dwap2sbkpav7c6c6');

  assertThrows(
    () => DidSchema.parse('invalid-did'),
    Error,
    'Invalid input',
  );
});

Deno.test('SigningKeySchema validation', () => {
  const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  assertEquals(SigningKeySchema.parse(validKey), validKey);

  assertThrows(
    () => SigningKeySchema.parse('invalid-key'),
    Error,
    'Invalid input',
  );

  assertThrows(
    () => SigningKeySchema.parse('0123456789abcdef'), // too short
    Error,
    'Invalid input',
  );
});

Deno.test('CategorySchema validation', () => {
  const validCategories = ['adlr', 'arar', 'eulr', 'fklr', 'klbr', 'lstr', 'mnhr', 'star', 'stcr', 'drmr'];

  for (const category of validCategories) {
    assertEquals(CategorySchema.parse(category), category);
  }

  assertThrows(
    () => CategorySchema.parse('invalid'),
    Error,
    'Invalid input',
  );
});