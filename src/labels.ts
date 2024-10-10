import { z } from 'zod';
import { Label, LabelSchema } from './schemas.ts';

export const LABELS: readonly Label[] = [
	{
		rkey: '3jzfcijpj2z2b',
		identifier: 'adlr',
		category: 'adlr',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'arar',
		category: 'arar',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'eulr',
		category: 'eulr',
	},
	{
		rkey: '3jzfcijpj2z2a',
		identifier: 'fklr',
		category: 'fklr',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'klbr',
		category: 'klbr',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'lstr',
		category: 'lstr',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'mnhr',
		category: 'mnhr',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'star',
		category: 'star',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'stcr',
		category: 'stcr',
	},
	{
		rkey: '3jzfcijpj2z2c',
		identifier: 'stcr',
		category: 'stcr',
	},
	{
		rkey: 'self',
		identifier: 'drmr',
		category: 'drmr',
	},
] as const;

LABELS.forEach((label) => {
	LabelSchema.parse(label);
});

z.array(LabelSchema).parse(LABELS);
