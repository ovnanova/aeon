// assign_label.ts
// - Script for manually assigning labels to accounts
// - The script handles both new assignments and updates
// - This script takes two command-line arguments:
//   1. DID of the account to be labeled
//   2. Label identifier of the label to be assigned
// Example usage:
// deno task assign_label did:plc:exampleuser123 fklr

import { Aeon } from '../src/aeon.ts';
import { initializeConfig } from '../src/config.ts';
import { DidSchema, LabelIdentifierSchema } from '../src/schemas.ts';
import { LABELS } from '../src/labels.ts';

async function assignLabel() {
	// Check if the correct number of arguments is provided
	if (Deno.args.length !== 2) {
		console.error('Usage: deno task assign_label <did> <label_identifier>');
		Deno.exit(1);
	}

	const [did, labelIdentifier] = Deno.args;

	// Validate DID and label identifier using schemas
	try {
		DidSchema.parse(did);
		LabelIdentifierSchema.parse(labelIdentifier);
	} catch (error) {
		if (error instanceof Error) {
			console.error('Invalid DID or label identifier:', error.message);
		}
		Deno.exit(1);
	}

	// Find the corresponding label for the given label identifier
	const label = LABELS.find((l) => l.identifier === labelIdentifier);
	if (!label) {
		console.error(`No matching label found for identifier: ${labelIdentifier}`);
		Deno.exit(1);
	}

	// Initialize configuration and create Aeon instance
	await initializeConfig();
	const aeon = await Aeon.create();
	await aeon.init();

	// Attempt to assign the label
	try {
		await aeon.assignOrUpdateLabel(did, label.rkey);
	} catch (error) {
		if (error instanceof Error) {
			console.error('Error assigning label:', error.message);
		}
		Deno.exit(1);
	}
}

await assignLabel();
