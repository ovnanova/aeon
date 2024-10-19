// aeon.ts
// - Core module for the ÆON labeler
// - Manages label assignment, retrieval, and deletion
// - Interacts with atprotocol and the Labeler Server
// - Implements error handling and logging
import { AtpAgent } from 'atproto';
import { LabelerServer } from 'labeler';
import { CONFIG } from './config.ts';
import { LABELS } from './labels.ts';
import {
	CATEGORIES,
	Category,
	DidSchema,
	Label,
	RkeySchema,
	SigningKeySchema,
} from './schemas.ts';

// AtpError
// - Custom error class for atprotocol-related errors
class AtpError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AtpError';
	}
}

// LabelingError
// - Custom error class for labeling-related errors
class LabelingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LabelingError';
	}
}

// Aeon
// - Main class for handling labeling operations
export class Aeon {
	// Private constructor
	// - Initializes Aeon with LabelerServer and AtpAgent
	private constructor(
		private readonly labelerServer: LabelerServer,
		private readonly agent: AtpAgent,
	) {}

	// create
	// - Static factory method to create Aeon instance
	// - Validates DID and signing key
	// - Creates LabelerServer and AtpAgent if not provided
	static create(
		labelerServer?: LabelerServer,
		agent?: AtpAgent,
		config: typeof CONFIG = CONFIG,
	): Aeon {
		const validatedDID = DidSchema.parse(config.DID);
		const validatedSigningKey = SigningKeySchema.parse(config.SIGNING_KEY);
		const actualLabelerServer = labelerServer ?? new LabelerServer({
			did: validatedDID,
			signingKey: validatedSigningKey,
		});
		const actualAgent = agent ??
			new AtpAgent({ service: CONFIG.BSKY_URL });
		return new Aeon(actualLabelerServer, actualAgent);
	}

	// init
	// - Initializes Aeon by creating an atprotocol session
	// - Throws ConnectionError on failure
	async init(): Promise<void> {
		try {
			await this.agent.login({
				identifier: CONFIG.BSKY_HANDLE,
				password: CONFIG.BSKY_PASSWORD,
			});
			console.log('ÆON initialized and logged in successfully');
		} catch (error) {
			console.error('Error in ÆON initialization:', error);
			throw new AtpError('Failed to initialize ÆON');
		}
	}

	// assignLabel
	// - Assigns a label to a subject based on rkey
	// - Validates subject and rkey
	// - Handles self-labeling case
	// - Fetches current labels and updates/adds new label
	async assignLabel(subject: string, rkey: string): Promise<void> {
		const validatedSubject = DidSchema.parse(subject);
		const validatedRkey = RkeySchema.parse(rkey);

		if (validatedRkey === 'self') {
			console.log(
				`Self-labeling detected for ${validatedSubject}. No action taken.`,
			);
			return;
		}

		try {
			const currentLabels = await this.fetchCurrentLabels(validatedSubject);
			await this.addOrUpdateLabel(
				validatedSubject,
				validatedRkey,
				currentLabels,
			);
		} catch (error) {
			console.error(
				`Error in label function: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new LabelingError(`Failed to assign label for ${validatedSubject}`);
		}
	}

	// fetchCurrentLabels
	// - Retrieves current labels for a given DID
	// - Queries LabelerServer database
	// - Returns a Map of categories to Sets of label values
	private async fetchCurrentLabels(
		did: string,
	): Promise<Map<Category, Set<string>>> {
		const labelCategories = new Map<Category, Set<string>>(
			Object.entries(CATEGORIES).map((
				[category],
			) => [category as Category, new Set<string>()]),
		);

		const query = await this.labelerServer.db.prepare<[string, string]>(
			`SELECT val, neg FROM labels WHERE uri = ? AND val LIKE ? ORDER BY cts DESC`,
		);

		for (const category of Object.keys(CATEGORIES) as Category[]) {
			const results = await query.all(did, `${category}%`);

			for (const row of results) {
				if (Array.isArray(row) && row.length === 2) {
					const [val, neg] = row;
					if (typeof val === 'string' && typeof neg === 'string') {
						const labels = labelCategories.get(category);
						if (labels) {
							if (neg === 'false') {
								labels.add(val);
							}
						}
					}
				}
			}

			const labels = labelCategories.get(category);
			if (labels && labels.size > 0) {
				console.log(
					`Current ${category} labels: ${Array.from(labels).join(', ')}`,
				);
			}
		}

		return labelCategories;
	}

	// addOrUpdateLabel
	// - Adds or updates a label for a subject
	// - Finds matching label for given rkey
	// - Negates existing labels in the same category
	// - Creates new label
	private async addOrUpdateLabel(
		subject: string,
		rkey: string,
		labelCategories: Map<Category, Set<string>>,
	): Promise<void> {
		const newLabel = this.findLabelByPost(rkey);
		if (!newLabel) {
			console.log(`No matching label found for rkey: ${rkey}`);
			return;
		}

		const category = this.getCategoryFromLabel(newLabel.identifier);
		if (!category) {
			throw new LabelingError(
				`Invalid category for label: ${newLabel.identifier}`,
			);
		}
		const existingLabels = labelCategories.get(category) ?? new Set<string>();

		console.log(
			`Updating ${category} label for ${subject}. Existing: ${
				Array.from(existingLabels).join(', ')
			}. New: ${newLabel.identifier}`,
		);

		try {
			if (existingLabels.size > 0) {
				await this.labelerServer.createLabels({ uri: subject }, {
					negate: Array.from(existingLabels),
				});
				console.log(`Negated existing ${category} labels for ${subject}`);
			}

			await this.labelerServer.createLabel({
				uri: subject,
				val: newLabel.identifier,
			});
			console.log(
				`Successfully added new label ${newLabel.identifier} for ${subject}`,
			);
		} catch (error) {
			console.error(
				`Error updating label for ${subject}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new LabelingError(`Failed to update label for ${subject}`);
		}
	}

	// deleteLabel
	// - Deletes a specific label from a subject
	// - Validates subject
	// - Fetches current labels and removes specified label
	async deleteLabel(subject: string, labelIdentifier: string): Promise<void> {
		const validatedSubject = DidSchema.parse(subject);

		try {
			const currentLabels = await this.fetchCurrentLabels(validatedSubject);
			await this.removeLabelFromAccount(
				validatedSubject,
				labelIdentifier,
				currentLabels,
			);
		} catch (error) {
			console.error(
				`Error in deleteLabel function: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	// removeLabelFromAccount
	// - Removes a specific label from an account
	// - Determines category of label
	// - Checks if label exists for the account
	// - Negates the label if it exists
	private async removeLabelFromAccount(
		subject: string,
		labelIdentifier: string,
		currentLabels: Map<Category, Set<string>>,
	): Promise<void> {
		let category: Category;
		try {
			const categoryResult = this.getCategoryFromLabel(labelIdentifier);
			if (!categoryResult) {
				console.log(`Invalid label: ${labelIdentifier}. No action taken.`);
				return;
			}
			category = categoryResult;
		} catch (error) {
			console.error(
				`Error removing label for ${subject}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return;
		}

		const existingLabels = currentLabels.get(category) ?? new Set<string>();

		if (!existingLabels.has(labelIdentifier)) {
			console.log(
				`Label ${labelIdentifier} not found for ${subject}. No action taken.`,
			);
			return;
		}

		console.log(
			`Removing ${category} label ${labelIdentifier} from ${subject}.`,
		);

		try {
			await this.labelerServer.createLabel({
				uri: subject,
				val: labelIdentifier,
				neg: true,
			});
			console.log(
				`Successfully removed label ${labelIdentifier} from ${subject}`,
			);
		} catch (error) {
			console.error(
				`Error removing label for ${subject}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	// findLabelByPost
	// - Finds a Label object matching the given rkey
	// - Returns undefined if no match is found
	private findLabelByPost(rkey: string): Label | undefined {
		return LABELS.find((label) => label.rkey === rkey);
	}

	// getCategoryFromLabel
	// - Determines the category of a label based on its identifier
	// - Returns undefined if no matching category is found
	private getCategoryFromLabel(label: string): Category | undefined {
		return Object.keys(CATEGORIES).find((cat) => label.startsWith(`${cat}`)) as
			| Category
			| undefined;
	}
}
