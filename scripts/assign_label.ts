/**
 * Label Assignment script for ÆON
 * Manually assigns labels to accounts.
 *
 * Usage: deno task assign_label <did> <label_identifier>
 * Example: deno task assign_label did:plc:example123 adlr
 *
 * Parameters:
 * - did: The DID of the account to label
 * - label_identifier: The identifier of the label to assign
 *   Valid identifiers: adlr, arar, eulr, fklr, klbr, lstr, mnhr, star, stcr
 */

import { initLogging } from '../src/logger.ts';
import { Aeon } from '../src/aeon.ts';
import { initializeConfig } from '../src/config.ts';
import { DidSchema, LabelIdentifierSchema } from '../src/schemas.ts';
import * as log from '@std/log';

await initLogging();
const logger = log.getLogger();

async function assignLabel() {
	if (Deno.args.length !== 2) {
		logger.error('Invalid arguments', {
			expected: 'did label_identifier',
			received: Deno.args.join(' '),
		});
		console.error('Usage: deno task assign_label <did> <label_identifier>');
		console.error('Example: deno task assign_label did:plc:example123 adlr');
		Deno.exit(1);
	}

	const [did, labelIdentifier] = Deno.args;

	try {
		// Validate inputs
		DidSchema.parse(did);
		LabelIdentifierSchema.parse(labelIdentifier);

		logger.info('Initializing Aeon...', { did, labelIdentifier });
		await initializeConfig();
		const aeon = await Aeon.create();
		await aeon.init();

		logger.info('Assigning label...', { did, labelIdentifier });
		await aeon.assignOrUpdateLabel(did, labelIdentifier);
		logger.info('Label assigned successfully', { did, labelIdentifier });
	} catch (error) {
		logger.error('Failed to assign label', {
			did,
			labelIdentifier,
			error: error instanceof Error ? error.message : String(error),
		});
		console.error(
			'Error:',
			error instanceof Error ? error.message : String(error),
		);
		Deno.exit(1);
	}
}

await assignLabel();
