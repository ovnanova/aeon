import { initializeConfig, setConfigValue } from '../src/config.ts';

// First, initialize with default values
await initializeConfig();

await setConfigValue('DID', 'did:plc:7iza6de2dwap2sbkpav7c6c6');
await setConfigValue(
	'SIGNING_KEY',
	'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
);
await setConfigValue(
	'JETSTREAM_URL',
	'wss://jetstream1.us-west.bsky.network/subscribe',
);
await setConfigValue('COLLECTION', 'app.bsky.feed.like');
await setConfigValue('CURSOR_INTERVAL', 10000);
await setConfigValue('BSKY_HANDLE', 'test.bsky.social');
await setConfigValue('BSKY_PASSWORD', 'this-is-an-app-password');

console.log('Deno KV initialized with default values.');
