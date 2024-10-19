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

class LabelingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LabelingError';
	}
}

export class Aeon {
	private constructor(
		private readonly labelerServer: LabelerServer,
		private readonly agent: AtpAgent,
	) {}
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

	async init(): Promise<void> {
		try {
			await this.agent.login({
				identifier: CONFIG.BSKY_HANDLE,
				password: CONFIG.BSKY_PASSWORD,
			});
			console.log('ÆON initialized and logged in successfully');
		} catch (error) {
			console.error('Error in ÆON initialization:', error);
			throw new LabelingError('Failed to initialize ÆON');
		}
	}

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

	private findLabelByPost(rkey: string): Label | undefined {
		return LABELS.find((label) => label.rkey === rkey);
	}

	private getCategoryFromLabel(label: string): Category | undefined {
		return Object.keys(CATEGORIES).find((cat) => label.startsWith(`${cat}`)) as
			| Category
			| undefined;
	}
}
