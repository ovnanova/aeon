import { z } from 'zod';
import { ConfigSchema } from './schemas.ts';
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

Object.freeze(CONFIG);
