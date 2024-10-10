import { z } from 'zod';

export const RkeySchema = z.union([
	z.string().length(13).regex(/^[a-z2-7]{13}$/),
	z.literal('self'),
]);

export const DidSchema = z.string()
	.regex(/^did:plc:[a-z2-7]{24}$/);

export const SigningKeySchema = z.string().regex(/^[0-9a-f]{64}$/);

export const CategorySchema = z.enum([
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
]);

export const LabelSchema = z.object({
	rkey: RkeySchema,
	identifier: z.string().length(4),
	category: CategorySchema,
});

export const ConfigSchema = z.object({
	DID: DidSchema,
	SIGNING_KEY: SigningKeySchema,
	JETSTREAM_URL: z.string().url().default(
		'wss://jetstream1.us-west.bsky.network/subscribe',
	),
	COLLECTION: z.string().min(1).default('app.bsky.feed.like'),
	CURSOR_INTERVAL: z.number().int().positive().default(100000),
	BSKY_HANDLE: z.string().min(1),
	BSKY_PASSWORD: z.string().min(1),
});

export type Rkey = z.infer<typeof RkeySchema>;
export type Did = z.infer<typeof DidSchema>;
export type SigningKey = z.infer<typeof SigningKeySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Label = z.infer<typeof LabelSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export const CATEGORIES = CategorySchema.options;
