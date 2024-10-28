/**
 * Core module for the ÆON labeler
 * Manages the automatic assignment and removal of labels based on user interactions.
 *
 * Key Features:
 * - One label active per user at any time
 * - Label assignment through post interactions (likes)
 * - Automatic removal of previous labels when new ones are assigned
 * - Decommission post that removes all labels
 */
import { AtpAgent } from 'atproto';
import { LabelerServer } from 'labeler';
import { CONFIG } from './config.ts';
import { LABELS } from './labels.ts';
import { DidSchema, RkeySchema, SigningKeySchema } from './schemas.ts';
import { AtpError, LabelingError, ServerError } from './errors.ts';
import * as log from '@std/log';
import { MetricsTracker } from './metrics.ts';

/**
 * Main class for handling labeling operations.
 * Manages the lifecycle of the labeler server, logger, and ATP agent.
 */
export class Aeon {
	private readonly logger: log.Logger;
	private labelerServer: LabelerServer;
	private agent: AtpAgent;

	/**
	 * Private constructor for Aeon class.
	 *
	 * @param metricsTracker - The Deno KV store to use for metrics tracking
	 */
	constructor(private readonly metrics: MetricsTracker) {
		this.logger = log.getLogger();
		const validatedDID = DidSchema.parse(CONFIG.DID);
		const validatedSigningKey = SigningKeySchema.parse(CONFIG.SIGNING_KEY);
		this.labelerServer = new LabelerServer({
			did: validatedDID,
			signingKey: validatedSigningKey,
		});
		this.agent = new AtpAgent({ service: CONFIG.BSKY_URL });
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
			this.logger.info('ATP authentication successful');
		} catch (error) {
			const errorMessage = error instanceof Error
				? error.message
				: String(error);
			this.logger.error('ATP authentication failed:', errorMessage);
			throw new AtpError(`ATP initialization failed: ${errorMessage}`);
		}

		try {
			await this.labelerServer.start(CONFIG.PORT);
			this.logger.info('LabelerServer started successfully');
		} catch (error) {
			await this.agent.logout();
			const errorMessage = error instanceof Error
				? error.message
				: String(error);
			this.logger.error('LabelerServer startup failed:', errorMessage);
			throw new ServerError(`Server initialization failed: ${errorMessage}`);
		}
	}

	/**
	 * Handles post interaction (like) events from users.
	 *
	 * Behavior:
	 * 1. If user likes the decommission post (REMOVAL_RKEY), their current label is removed
	 * 2. If user likes a labeled post:
	 *    - If they have no label, they receive the new label
	 *    - If they have a different label, old label is negated and new label applied
	 *    - If they have the same label, no action is taken
	 * 3. Self-labeling is prevented
	 *
	 * @param subject - The DID of the user who liked the post
	 * @param rkey - The record key of the post that was liked
	 * @throws {LabelingError} If label operations fail
	 */
	async handleLike(subject: string, rkey: string): Promise<void> {
		const validatedSubject = DidSchema.parse(subject);
		const validatedRkey = RkeySchema.parse(rkey);

		// Prevent self-labeling
		if (validatedSubject === CONFIG.DID) {
			this.logger.info(`Self-labeling blocked for ${validatedSubject}`);
			return;
		}

		try {
			// Check if this is the removal post
			if (validatedRkey === CONFIG.REMOVAL_RKEY) {
				await this.removeCurrentLabel(validatedSubject);
				return;
			}

			// Find the label for this post
			const newLabel = LABELS.find((label) => label.rkey === validatedRkey);
			if (!newLabel) {
				this.logger.info(`No label mapping found for post ${validatedRkey}`);
				return;
			}

			// Get current label if any
			const currentLabel = await this.getCurrentLabel(validatedSubject);

			// Skip if the same label is already active
			if (currentLabel?.val === newLabel.identifier && !currentLabel.neg) {
				this.logger.info(
					`Label ${newLabel.identifier} already active for ${validatedSubject}`,
				);
				return;
			}

			// If they have a different label, negate it first
			if (currentLabel?.val && !currentLabel.neg) {
				await this.labelerServer.createLabel({
					uri: validatedSubject,
					val: currentLabel.val,
					neg: true,
				});
				this.logger.info(
					`Negated existing label ${currentLabel.val} for ${validatedSubject}`,
				);
				await this.metrics.decrementLabel(currentLabel.val);
			}

			// Apply the new label
			await this.labelerServer.createLabel({
				uri: validatedSubject,
				val: newLabel.identifier,
			});

			await this.metrics.incrementLabel(newLabel.identifier);
			this.logger.info(
				`Applied label ${newLabel.identifier} to ${validatedSubject}`,
			);
		} catch (error) {
			const errorMessage = error instanceof Error
				? error.message
				: String(error);
			this.logger.error(`Error handling like:`, errorMessage);
			throw new LabelingError(
				`Failed to process like for ${validatedSubject}: ${errorMessage}`,
			);
		}
	}

	/**
	 * Retrieves the current label state for a given DID.
	 * 
	 * @param did - The DID to check
	 */
	private async getCurrentLabel(
		did: string,
		try {
			const query = await this.labelerServer.db.prepare(`
				SELECT val, neg FROM labels
				WHERE uri = ?
				ORDER BY cts DESC
				LIMIT 1
			`);

			const result = await query.get(did) as { val: string; neg: boolean } | undefined;
			if (!result || typeof result.val === 'undefined' || typeof result.neg === 'undefined') {
				return null;
			}

			return {
				val: result.val,
				neg: Boolean(result.neg),
			};
		} catch (error) {
			const errorMessage = error instanceof Error
				? error.message
				: String(error);
			this.logger.error(`Database query failed:`, errorMessage);
			throw new LabelingError(`Failed to fetch current label: ${errorMessage}`);
		}
	}

	/**
	 * Removes the current label from a user by creating a negation label.
	 * Only removes the label if one is currently active.
	 * 
	 * @param did - The DID of the account to remove the label from
	 */
	private async removeCurrentLabel(did: string): Promise<void> {
		try {
			const currentLabel = await this.getCurrentLabel(did);

			if (!currentLabel?.val || currentLabel.neg) {
				this.logger.info(`No active label to remove for ${did}`);
				return;
			}

			await this.labelerServer.createLabel({
				uri: did,
				val: currentLabel.val,
				neg: true,
			});

			await this.metrics.decrementLabel(currentLabel.val);
			this.logger.info(`Removed label ${currentLabel.val} from ${did}`);
		} catch (error) {
			const errorMessage = error instanceof Error
				? error.message
				: String(error);
			this.logger.error(`Error removing label:`, errorMessage);
			throw new LabelingError(
				`Failed to remove label for ${did}: ${errorMessage}`,
			);
		}
	}

	/**
	 * Performs graceful shutdown of the Aeon instance.
	 */
	async shutdown(): Promise<void> {
		const shutdownTasks = [
			{
				name: 'LabelerServer',
				task: () => this.labelerServer.stop(),
			},
			{
				name: 'ATP Agent',
				task: () => this.agent.logout(),
			},
		];

		for (const { name, task } of shutdownTasks) {
			try {
				await task();
				this.logger.info(`${name} shutdown successful`);
			} catch (error) {
				const errorMessage = error instanceof Error
					? error.message
					: String(error);
				this.logger.error(`${name} shutdown failed:`, errorMessage);
			}
		}
	}
}
