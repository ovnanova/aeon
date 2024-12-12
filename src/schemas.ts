// - Defines all Zod schemas for data validation
// - Includes schemas for Rkey, Did, SigningKey, LabelIdentifier, LabelCategory, Label, and Config
// - Provides type definitions derived from schemas
// - Implements utility functions for exhaustive type checking
// - Exports CATEGORIES object for category enumeration

import { z } from 'zod';
import { LABELS } from './labels.ts';

/**
 * RkeySchema (aka TID)
 * - 13-character string
 * - lowercase ASCII: a-z, 2-7 (no 0189)
 * - represents a 64-bit integer, big-endian byte ordering
 * - encoded as base32-sortable
 */
export const RkeySchema = z.union([
	z.string().length(13).regex(/^[a-z2-7]{13}$/),
	z.literal('self'),
]);

/**
 * DidSchema
 * - 32-character string (including "did:plc:")
 * - lowercase ASCII: a-z, 2-7, and : (no 0189)
 * - identifier derived from genesis operation hash
 * - last 24 characters are encoded as standard base32
 */
export const DidSchema = z.string()
	.regex(/^did:plc:[a-z2-7]{24}$/);

/**
 * SigningKeySchema
 * - 43-character string
 * - alphanumeric ASCII alphabet only (A-Z, a-z, 0-9)
 * - Represents a 256-bit (32-byte) cryptographic key
 * - Encoded as base64url (no padding)
 */
export const SigningKeySchema = z.string().regex(/^[A-Za-z0-9]{43}$/);

/**
 * ConfigSchema
 * - object with DID, SIGNING_KEY, and other configuration fields
 * - all fields are required
 * - strict object (no additional properties allowed)
 */
export const ConfigSchema = z.object({
	DID: DidSchema,
	SIGNING_KEY: SigningKeySchema,
	JETSTREAM_URL: z.string().url(),
	COLLECTION: z.string().min(1),
	CURSOR: z.number().nonnegative().default(0),
	CURSOR_INTERVAL: z.number().int().positive(),
	BSKY_HANDLE: z.string().min(1),
	BSKY_PASSWORD: z.string().min(1),
	BSKY_URL: z.string().url(),
	PORT: z.number().int().min(1024),
	REMOVAL_RKEY: RkeySchema,
}).strict();

/**
 * LabelIdentifierSchema
 * - Enumeration of all valid label identifiers
 */
export const LabelIdentifierSchema = z.enum(
	LABELS.map((label) => label.identifier) as [string, ...string[]],
);

/**
 * LabelCategorySchema
 * - Enumeration of all valid label categories
 */
export const LabelCategorySchema = z.enum(
	LABELS.map((label) => label.category) as [string, ...string[]],
);

/**
 * LabelSchema
 * - Object schema for a label, including rkey, identifier, and category
 */
export const LabelSchema = z.object({
	rkey: RkeySchema,
	identifier: LabelIdentifierSchema,
	category: LabelCategorySchema,
}).strict();

// Type definitions derived from schemas
export type Rkey = z.infer<typeof RkeySchema>;
export type Did = z.infer<typeof DidSchema>;
export type SigningKey = z.infer<typeof SigningKeySchema>;
export type LabelIdentifier = z.infer<typeof LabelIdentifierSchema>;
export type LabelCategory = z.infer<typeof LabelCategorySchema>;
export type Label = z.infer<typeof LabelSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * CATEGORIES
 * Object with Category keys and values
 *
 * See labels.ts for the source of label categories.
 */
export const CATEGORIES: Record<LabelCategory, LabelCategory> = Object
	.fromEntries(
		LabelCategorySchema.options.map((
			category: LabelCategory,
		) => [category, category]),
	) as Record<LabelCategory, LabelCategory>;

// Validate that all labels in LABELS conform to the schema
LABELS.forEach((label: Label) => {
	LabelSchema.parse(label);
});
