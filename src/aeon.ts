/**
 * Core module for the ÆON labeler
 *
 * - Manages label assignment, retrieval, and deletion
 * - Interacts with atprotocol and the Labeler Server
 * - Implements error handling and logging
 */

import { AtpAgent } from 'atproto';
import { LabelerServer } from 'labeler';
import { CONFIG } from './config.ts';
import { LABELS } from './labels.ts';
import {
	CATEGORIES,
	DidSchema,
	Label,
	LabelCategory,
	RkeySchema,
	SigningKeySchema,
} from './schemas.ts';
import { AtpError, LabelingError, ServerError } from './errors.ts';
import * as log from '@std/log';
import { MetricsTracker } from './metrics.ts';

/**
 * Main class for handling labeling operations.
 * Manages the lifecycle of the labeler server and ATP agent.
 */
export class Aeon {
	private readonly logger: log.Logger;
	private readonly metrics: MetricsTracker;

	/**
	 * Private constructor for Aeon class.
	 * Instances should be created using the static create() method.
	 *
	 * @param labelerServer - The LabelerServer instance to use
	 * @param agent - The AtpAgent instance to use
	 * @param metrics - The MetricsTracker instance to use
	 */
	private constructor(
		private readonly labelerServer: LabelerServer,
		private readonly agent: AtpAgent,
		metrics: MetricsTracker,
	) {
		this.logger = log.getLogger();
		this.metrics = metrics;
	}

	/**
	 * Creates an Aeon instance.
	 * Validates DID and signing key.
	 * Creates LabelerServer and AtpAgent if not provided.
	 *
	 * @param labelerServer - Optional LabelerServer instance
	 * @param agent - Optional AtpAgent instance
	 * @param config - Configuration object, defaults to global CONFIG
	 * @param metrics - Optional MetricsTracker instance
	 * @returns A new Aeon instance
	 * @throws {Error} If DID or signing key validation fails
	 */
	static create(
		metrics: MetricsTracker,
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
		return new Aeon(actualLabelerServer, actualAgent, metrics);
	}

	/**
	 * Initializes the Aeon instance.
	 * Creates an atprotocol session and starts the labeler server.
	 *
	 * @throws {AtpError} If ATP initialization fails
	 * @throws {ServerError} If server initialization fails
	 */
	async init(): Promise<void> {
		try {
			await this.agent.login({
				identifier: CONFIG.BSKY_HANDLE,
				password: CONFIG.BSKY_PASSWORD,
			});
			this.logger.info('ÆON initialized and logged in successfully');
		} catch (error) {
			this.logger.error('Error in ÆON initialization:', error);
			throw new AtpError('Failed to initialize ÆON');
		}
		try {
			await this.labelerServer.start(
				CONFIG.PORT,
				this.onServerStarted.bind(this),
			);
			this.logger.info('LabelerServer initialized successfully');
		} catch (error) {
			await this.agent.logout();
			this.logger.error('Error in LabelerServer initialization:', error);
			throw new ServerError('Failed to initialize LabelerServer');
		}
	}

	/**
	 * Shuts down the Aeon instance.
	 * Stops the labeler server and logs out of ATP.
	 */
	async shutdown(): Promise<void> {
		try {
			await this.labelerServer.stop();
			this.logger.info('LabelerServer stopped successfully');
		} catch (error) {
			this.logger.error('Error stopping LabelerServer:', error);
		}
		try {
			await this.agent.logout();
			this.logger.info('ATP agent logged out successfully');
		} catch (error) {
			this.logger.error('Error logging out ATP agent:', error);
		}
	}

	/**
	 * Callback function for server start events.
	 *
	 * @param error - Error object if server failed to start, null otherwise
	 * @param address - The address the server is listening on
	 */
	private onServerStarted(error: Error | null, address: string): void {
		if (error) {
			this.logger.error('Failed to start server:', error);
		} else {
			this.logger.info('Server started successfully at:', address);
		}
	}

	/**
	 * Retrieves current labels for a given DID.
	 * Queries LabelerServer database for all labels in each category.
	 *
	 * @param did - The DID to fetch labels for
	 * @returns A Map of categories to Sets of label values
	 */
	private async fetchCurrentLabels(
		did: string,
	): Promise<Map<LabelCategory, Set<string>>> {
		const labelCategories = new Map<LabelCategory, Set<string>>(
			Object.entries(CATEGORIES).map((
				[category],
			) => [category as LabelCategory, new Set<string>()]),
		);

		const query = await this.labelerServer.db.prepare<[string, string]>(
			`SELECT val, neg FROM labels WHERE uri = ? AND val LIKE ? ORDER BY cts DESC`,
		);

		for (const category of Object.keys(CATEGORIES) as LabelCategory[]) {
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
				this.logger.info(
					`Current ${category} labels: ${Array.from(labels).join(', ')}`,
				);
			}
		}

		return labelCategories;
	}

	/**
	 * Assigns a single label to an account.
	 * Validates subject (DID) and rkey.
	 * Finds the corresponding label for the given rkey.
	 * Fetches current labels, negates existing ones, and creates the new label.
	 *
	 * @param subject - The DID of the account to label
	 * @param rkey - The rkey of the label to assign
	 * @throws {LabelingError} If label assignment fails
	 */
	async assignOrUpdateLabel(subject: string, rkey: string): Promise<void> {
		const validatedSubject = DidSchema.parse(subject);
		const validatedRkey = RkeySchema.parse(rkey);

		if (validatedSubject === CONFIG.DID) {
			this.logger.info(
				`Attempted self-labeling for ${CONFIG.DID}. Operation blocked.`,
			);
			return;
		}

		try {
			const newLabel = this.findLabelByPost(validatedRkey);
			if (!newLabel) {
				throw new Error(`No matching label found for rkey: ${validatedRkey}`);
			}

			const category = this.getCategoryFromLabel(newLabel.identifier);
			if (!category) {
				throw new Error(`Invalid category for label: ${newLabel.identifier}`);
			}

			const currentLabels = await this.fetchCurrentLabels(validatedSubject);
			const existingLabels = currentLabels.get(category) ?? new Set<string>();

			this.logger.info(
				`Updating ${category} label for ${validatedSubject}. Existing: ${
					Array.from(existingLabels).join(', ')
				}. New: ${newLabel.identifier}`,
			);

			if (existingLabels.size > 0) {
				await this.labelerServer.createLabels({ uri: validatedSubject }, {
					negate: Array.from(existingLabels),
				});
				this.logger.info(
					`Negated existing ${category} labels for ${validatedSubject}`,
				);
			}

			await this.labelerServer.createLabel({
				uri: validatedSubject,
				val: newLabel.identifier,
			});
			this.logger.info(
				`Successfully added new label ${newLabel.identifier} for ${validatedSubject}`,
			);
			this.metrics.recordLabelOp(newLabel.identifier);
		} catch (error) {
			this.logger.error(
				`Error in assignOrUpdateLabel: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new LabelingError(`Failed to assign label for ${validatedSubject}`);
		}
	}

	/**
	 * Removes a label from an account.
	 * Validates subject (DID).
	 * Fetches current labels and negates the specified one if it exists.
	 *
	 * @param subject - The DID of the account to remove the label from
	 * @param labelIdentifier - The identifier of the label to remove
	 * @throws {LabelingError} If label removal fails
	 */
	async removeLabel(subject: string, labelIdentifier: string): Promise<void> {
		const validatedSubject = DidSchema.parse(subject);

		try {
			const category = this.getCategoryFromLabel(labelIdentifier);
			if (!category) {
				this.logger.info(`Invalid label: ${labelIdentifier}. No action taken.`);
				return;
			}

			const currentLabels = await this.fetchCurrentLabels(validatedSubject);
			const existingLabels = currentLabels.get(category) ?? new Set<string>();

			if (!existingLabels.has(labelIdentifier)) {
				this.logger.info(
					`Label ${labelIdentifier} not found for ${validatedSubject}. No action taken.`,
				);
				return;
			}

			this.logger.info(
				`Removing ${category} label ${labelIdentifier} from ${validatedSubject}.`,
			);

			await this.labelerServer.createLabel({
				uri: validatedSubject,
				val: labelIdentifier,
				neg: true,
			});
			this.logger.info(
				`Successfully removed label ${labelIdentifier} from ${validatedSubject}`,
			);
			this.metrics.recordRemoveOp(labelIdentifier);
		} catch (error) {
			this.logger.error(
				`Error in removeLabel: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new LabelingError(`Failed to delete label for ${validatedSubject}`);
		}
	}

	/**
	 * Finds a Label object matching the given rkey.
	 *
	 * @param rkey - The rkey to find
	 * @returns The matching Label object, or undefined if not found
	 */
	private findLabelByPost(rkey: string): Label | undefined {
		return LABELS.find((label) => label.rkey === rkey);
	}

	/**
	 * Determines the category of a label based on its identifier.
	 *
	 * @param label - The label identifier
	 * @returns The label category, or undefined if not found
	 */
	private getCategoryFromLabel(label: string): LabelCategory | undefined {
		return Object.keys(CATEGORIES).find((cat) => label.startsWith(`${cat}`)) as
			| LabelCategory
			| undefined;
	}
}
