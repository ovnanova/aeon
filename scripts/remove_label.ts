// remove_label.ts
// - Script for manually removing labels from accounts
// - This script takes two command-line arguments:
//   1. DID of the account to remove the label from
//   2. Label identifier of the label to be removed
// Example usage:
// deno task remove_label did:plc:exampleuser123 fklr

import { Aeon } from '../src/aeon.ts';
import { initializeConfig } from '../src/config.ts';
import { DidSchema, LabelIdentifierSchema } from '../src/schemas.ts';

async function removeLabel() {
	// Check if the correct number of arguments is provided
	if (Deno.args.length !== 2) {
		console.error('Usage: deno task remove_label <did> <label_identifier>');
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
		} else {
			console.error('Invalid DID or label identifier:', error);
		}
		Deno.exit(1);
	}

	// Initialize configuration and create Aeon instance
	await initializeConfig();
	const aeon = await Aeon.create();
	await aeon.init();

	// Attempt to remove the label
	try {
		await aeon.removeLabel(did, labelIdentifier);
		console.log(`Successfully removed label ${labelIdentifier} from ${did}`);
	} catch (error) {
		if (error instanceof Error) {
			console.error('Error removing label:', error.message);
		} else {
			console.error('Error removing label:', error);
		}
		Deno.exit(1);
	}
}

await removeLabel();
