import { assertEquals } from '@std/assert';
import { CONFIG } from '../src/config.ts';
import { ConfigSchema } from '../src/schemas.ts';

const mockKvStore: Record<string, unknown> = {
  'config:DID': 'did:plc:7iza6de2dwap2sbkpav7c6c6',
  'config:SIGNING_KEY':
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'config:JETSTREAM_URL': 'wss://jetstream1.us-west.bsky.network/subscribe',
  'config:COLLECTION': 'app.bsky.feed.like',
  'config:CURSOR_INTERVAL': 100000,
  'config:BSKY_HANDLE': 'aeon.netwatch.dev',
  'config:BSKY_PASSWORD': 'this-is-a-very-secure-password',
};

const mockKv = {
  // deno-lint-ignore require-await
  get: async (key: string[]) => {
    const fullKey = key.join(':');
    return { value: mockKvStore[fullKey] || null };
  },
};

// @ts-ignore: Suppress 'Cannot assign to 'openKv' because it is a read-only property' error
Deno.openKv = () => Promise.resolve(mockKv);

Deno.test('Config loaded correctly', () => {
  assertEquals(CONFIG.DID, mockKvStore['config:DID']);
  assertEquals(CONFIG.SIGNING_KEY, mockKvStore['config:SIGNING_KEY']);
  assertEquals(CONFIG.JETSTREAM_URL, mockKvStore['config:JETSTREAM_URL']);
  assertEquals(CONFIG.COLLECTION, mockKvStore['config:COLLECTION']);
  assertEquals(CONFIG.CURSOR_INTERVAL, mockKvStore['config:CURSOR_INTERVAL']);
  assertEquals(CONFIG.BSKY_HANDLE, mockKvStore['config:BSKY_HANDLE']);
  assertEquals(CONFIG.BSKY_PASSWORD, mockKvStore['config:BSKY_PASSWORD']);
});

Deno.test('Config schema validation', () => {
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

  assertEquals(ConfigSchema.parse(validConfig), validConfig);
});
