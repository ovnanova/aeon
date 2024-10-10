import { assertEquals, assertRejects } from '@std/assert';
import { assertSpyCalls, spy } from '@std/testing/mock';
import { CONFIG, setConfigValue, initializeConfig } from '../src/config.ts';
import { ConfigSchema } from '../src/schemas.ts';

// Mock Deno.openKv
const mockKv = {
  // deno-lint-ignore require-await
  get: async (key: string[]) => {
    if (key[0] === 'config' && key[1] === 'DID') {
      return { value: 'did:plc:7iza6de2dwap2sbkpav7c6c6' };
    }
    return { value: null };
  },
  set: async () => {},
};

// @ts-ignore: Suppress 'Cannot assign to 'openKv' because it is a read-only property' error
Deno.openKv = () => Promise.resolve(mockKv);

Deno.test('Config initialization', async () => {
  const spyGet = spy(mockKv, 'get');
  const spySet = spy(mockKv, 'set');

  await initializeConfig();

  assertSpyCalls(spyGet, 7); // One call for each config value
  assertSpyCalls(spySet, 6); // Should set default values for all except DID

  spyGet.restore();
  spySet.restore();
});

Deno.test('Config validation', () => {
  assertEquals(typeof CONFIG.DID, 'string');
  assertEquals(typeof CONFIG.SIGNING_KEY, 'string');
  assertEquals(typeof CONFIG.JETSTREAM_URL, 'string');
  assertEquals(typeof CONFIG.COLLECTION, 'string');
  assertEquals(typeof CONFIG.CURSOR_INTERVAL, 'number');
  assertEquals(typeof CONFIG.BSKY_HANDLE, 'string');
  assertEquals(typeof CONFIG.BSKY_PASSWORD, 'string');
});

Deno.test('setConfigValue', async () => {
  const spySet = spy(mockKv, 'set');

  await setConfigValue('DID', 'did:plc:newdid');
  assertSpyCalls(spySet, 1);

  await assertRejects(
    async () => {
      await setConfigValue('DID', 'invalid-did');
    },
    Error,
    'Invalid input',
  );

  spySet.restore();
});

Deno.test('Config schema validation', () => {
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
});