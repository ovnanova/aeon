// schemas.ts
// - Defines Zod schemas for data validation
// - Includes schemas for Rkey, Did, SigningKey, Category, Label, and Config
// - Provides type definitions derived from schemas
// - Implements utility functions for exhaustive type checking
// - Exports CATEGORIES object for category enumeration

import { z } from 'zod';

// rkey / TID
// - 13-character string
// - lowercase ASCII: a-z, 2-7 (no 0189)
// - represents a 64-bit integer, big-endian byte ordering
// - encoded as base32-sortable
export const RkeySchema = z.union([
	z.string().length(13).regex(/^[a-z2-7]{13}$/),
	z.literal('self'),
]);

// did:plc
// - 32-character string (including "did:plc:")
// - lowercase ASCII: a-z, 2-7, and : (no 0189)
// - identifier derived from genesis operation hash
// - last 24 characters are encoded as standard base32
export const DidSchema = z.string()
	.regex(/^did:plc:[a-z2-7]{24}$/);

// signing key
// - 64-character string
// - lowercase ASCII characters only (0-9, a-f)
// - represents a 256-bit (32-byte) cryptographic key
// - encoded as hexadecimal
export const SigningKeySchema = z.string().regex(/^[0-9a-f]{64}$/);

// category
// - 4-character string
// - lowercase ASCII: a-r
// - represents a label category
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

// label
// - object with rkey, identifier, and category
// - rkey: valid Rkey
// - identifier: 4-character string
// - category: valid Category
export const LabelSchema = z.object({
	rkey: RkeySchema,
	identifier: z.string().length(4),
	category: CategorySchema,
});

// config
// - object with DID, SIGNING_KEY, and other configuration fields
// - all fields are required
// - strict object (no additional properties allowed)
export const ConfigSchema = z.object({
	DID: DidSchema,
	SIGNING_KEY: SigningKeySchema,
	JETSTREAM_URL: z.string().url(),
	COLLECTION: z.string().min(1),
	CURSOR_INTERVAL: z.number().int().positive(),
	BSKY_HANDLE: z.string().min(1),
	BSKY_PASSWORD: z.string().min(1),
	BSKY_URL: z.string().url(),
}).strict();

// Type definitions derived from schemas
export type Rkey = z.infer<typeof RkeySchema>;
export type Did = z.infer<typeof DidSchema>;
export type SigningKey = z.infer<typeof SigningKeySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Label = z.infer<typeof LabelSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// Category map
// - object with Category keys and values
export const CATEGORIES = Object.fromEntries(
	CategorySchema.options.map((category) => [category, category]),
) as Record<Category, Category>;
