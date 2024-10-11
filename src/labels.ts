import { z } from 'zod';
import { Label, LabelSchema } from './schemas.ts';
import * as log from '@std/log';

const logger = log.getLogger();

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

function validateLabels() {
	try {
		LABELS.forEach((label, index) => {
			LabelSchema.parse(label);
			logger.debug(`Validated label ${index}: ${JSON.stringify(label)}`);
		});

		z.array(LabelSchema).parse(LABELS);
		logger.info('All labels validated successfully');
	} catch (error) {
		logger.error(
			`Label validation error: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		throw new Error('Label validation failed');
	}
}

validateLabels();

export function getLabelByRkey(rkey: string): Label | undefined {
	const label = LABELS.find((label) => label.rkey === rkey);
	if (label) {
		logger.debug(`Found label for rkey ${rkey}: ${JSON.stringify(label)}`);
	} else {
		logger.warn(`No label found for rkey ${rkey}`);
	}
	return label;
}

export function getLabelsByCategory(category: string): Label[] {
	const labels = LABELS.filter((label) => label.category === category);
	logger.debug(`Found ${labels.length} labels for category ${category}`);
	return labels;
}
