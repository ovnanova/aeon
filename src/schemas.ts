import { z } from 'zod';

// rkey / TID
// 64 - bit integer
// big - endian byte ordering
// encoded as base32 - sortable (encoded with characters 234567abcdefghijklmnopqrstuvwxyz)
// length is always 13 ASCII characters

export const RkeySchema = z.string()
	.length(13)
	.regex(/^[a-z2-7]{13}$/);

// did:plc
// the overall identifier length is 32 characters
// the entire identifier is lower -case (and should be normalized to lower -case)
// the entire identifier is ASCII, and includes only the characters a - z, 0 - 9, and : (and does not use digits 0189)

export const DidSchema = z.string()
	.regex(/^did:plc:[a-z2-7]{24}$/);

// did:key schema for Secp256k1 keys

const didKeySecp256k1Schema = z.string()
	.regex(/^did:key:zQ3s[a-zA-Z0-9]{45}$/);

// did:key schema for NIST P-256 keys

const didKeyP256Schema = z.string()
	.regex(/^did:key:zDn[a-zA-Z0-9]{46}$/);

// Combined did:key schema

export const SigningKeySchema = z.union([
	didKeySecp256k1Schema,
	didKeyP256Schema,
]);

// ----------------------------------

export const LocaleSchema = z.object({
	lang: z.string().min(2),
	name: z.string().min(1),
	description: z.string().min(1),
});

export const LabelSchema = z.object({
	rkey: RkeySchema,
	identifier: z.string().min(1),
	locales: z.array(LocaleSchema).nonempty(),
});

export const LabelValueDefinitionSchema = z.object({
	identifier: z.string().min(1),
	severity: z.enum(['inform', 'alert', 'none']),
	blurs: z.enum(['content', 'media', 'none']),
	defaultSetting: z.enum(['ignore', 'warn', 'hide']),
	adultOnly: z.boolean(),
	locales: z.array(LocaleSchema).nonempty(),
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
export type Locale = z.infer<typeof LocaleSchema>;
export type Label = z.infer<typeof LabelSchema>;
export type LabelValueDefinition = z.infer<typeof LabelValueDefinitionSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export type Category =
	| 'adlr'
	| 'arar'
	| 'eulr'
	| 'fklr'
	| 'klbr'
	| 'lstr'
	| 'mnhr'
	| 'star'
	| 'stcr';
export const CATEGORY_PREFIXES: Record<Category, string> = {
	adlr: 'adlr',
	arar: 'arar',
	eulr: 'eulr',
	fklr: 'fklr',
	klbr: 'klbr',
	lstr: 'lstr',
	mnhr: 'mnhr',
	star: 'star',
	stcr: 'stcr',
};
