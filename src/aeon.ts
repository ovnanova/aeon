import { AtpAgent, ComAtprotoLabelDefs } from 'atproto';
import { LabelerServer } from 'labeler';
import { CONFIG } from './config.ts';
import { LABELS } from './labels.ts';
import {
	Category,
	CATEGORY_PREFIXES,
	DidSchema,
	Label,
	RkeySchema,
	SigningKeySchema,
} from './schemas.ts';

export class Aeon {
	private labelerServer: LabelerServer;
	private agent: AtpAgent;

	constructor() {
		const validatedDID = DidSchema.parse(CONFIG.DID);
		const validatedSigningKey = SigningKeySchema.parse(CONFIG.SIGNING_KEY);
		this.labelerServer = new LabelerServer({
			did: validatedDID,
			signingKey: validatedSigningKey,
		});
		this.agent = new AtpAgent({ service: CONFIG.JETSTREAM_URL });
	}

	async init(): Promise<void> {
		await this.agent.login({
			identifier: CONFIG.BSKY_HANDLE,
			password: CONFIG.BSKY_PASSWORD,
		});
		console.log('ÆON initialized');
	}

	async assignLabel(subject: string, rkey: string): Promise<void> {
		const validatedSubject = DidSchema.parse(subject);
		const validatedRkey = RkeySchema.parse(rkey);
		console.log(
			`Processing label request: rkey=${validatedRkey}, subject=${validatedSubject}`,
		);

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
		}
	}

	private fetchCurrentLabels(did: string): Record<Category, Set<string>> {
		const labelCategories = {
			adlr: new Set<string>(),
			arar: new Set<string>(),
			eulr: new Set<string>(),
			fklr: new Set<string>(),
			klbr: new Set<string>(),
			lstr: new Set<string>(),
			mnhr: new Set<string>(),
			star: new Set<string>(),
			stcr: new Set<string>(),
		};
		type Category = keyof typeof labelCategories;
		const categories = Object.keys(labelCategories) as Category[];

		for (const category of categories) {
			const prefix = CATEGORY_PREFIXES[category];
			const query = this.labelerServer.db
				.prepare<unknown[], ComAtprotoLabelDefs.Label>(
					`SELECT * FROM labels WHERE uri = ? AND val LIKE ? ORDER BY cts DESC`,
				)
				.all(did, `${prefix}-${category}-%`);

			const labels = query.reduce(
				(set: Set<string>, label: ComAtprotoLabelDefs.Label) => {
					if (!label.neg) set.add(label.val);
					else set.delete(label.val);
					return set;
				},
				new Set<string>(),
			);

			labelCategories[category] = labels;
			console.log(
				`Current ${category} labels: ${Array.from(labels).join(', ')}`,
			);
		}

		return labelCategories;
	}

	private async addOrUpdateLabel(
		subject: string,
		rkey: string,
		labelCategories: Record<Category, Set<string>>,
	): Promise<void> {
		const newLabel = this.findLabelByPost(rkey);
		if (!newLabel) {
			console.log(`No matching label found for rkey: ${rkey}`);
			return;
		}

		const category = this.getCategoryFromLabel(newLabel.identifier);
		const existingLabels = labelCategories[category];

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
		}
	}

	private findLabelByPost(rkey: string): Label | undefined {
		return LABELS.find((label) => label.rkey === rkey);
	}

	private getCategoryFromLabel(label: string): Category {
		for (const [category, prefix] of Object.entries(CATEGORY_PREFIXES)) {
			if (label.startsWith(`${prefix}-${category}-`)) {
				return category as Category;
			}
		}
		throw new Error(`Invalid label: ${label}`);
	}
}
