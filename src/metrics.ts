/**
 * Metrics tracking system for ÆON.
 * Tracks label counts for each identifier.
 */
import * as log from '@std/log';
import { LabelIdentifier } from './schemas.ts';
import { MetricsError } from './errors.ts';

interface LabelMetrics {
	[key: string]: number; // Counts for each label identifier
}

/**
 * Manages metrics for label operations.
 * Uses Deno KV for persistent storage.
 */
export class MetricsTracker {
	private readonly logger: log.Logger;

	constructor(private readonly kv: Deno.Kv) {
		this.logger = log.getLogger();
	}

	/**
	 * Records a label application by incrementing its counter
	 */
	async incrementLabel(identifier: LabelIdentifier): Promise<void> {
		try {
			const metrics = await this.getLabelMetrics();
			metrics[identifier] = (metrics[identifier] || 0) + 1;
			await this.kv.set(['metrics', 'labels'], metrics);
			this.logger.info(
				`Incremented count for label ${identifier} to ${metrics[identifier]}`,
			);
		} catch (error) {
			const msg = `Failed to increment label ${identifier}: ${
				error instanceof Error ? error.message : String(error)
			}`;
			this.logger.error(msg);
			throw new MetricsError(msg);
		}
	}

	/**
	 * Records a label removal by decrementing its counter
	 */
	async decrementLabel(identifier: LabelIdentifier): Promise<void> {
		try {
			const metrics = await this.getLabelMetrics();
			if (metrics[identifier] > 0) {
				metrics[identifier]--;
				await this.kv.set(['metrics', 'labels'], metrics);
				this.logger.info(
					`Decremented count for label ${identifier} to ${metrics[identifier]}`,
				);
			}
		} catch (error) {
			const msg = `Failed to decrement label ${identifier}: ${
				error instanceof Error ? error.message : String(error)
			}`;
			this.logger.error(msg);
			throw new MetricsError(msg);
		}
	}

	/**
	 * Gets the current metrics for all labels
	 */
	async getLabelMetrics(): Promise<LabelMetrics> {
		try {
			const result = await this.kv.get<LabelMetrics>(['metrics', 'labels']);
			return result.value ?? {};
		} catch (error) {
			const msg = `Failed to get label metrics: ${
				error instanceof Error ? error.message : String(error)
			}`;
			this.logger.error(msg);
			throw new MetricsError(msg);
		}
	}

	/**
	 * Gets the current count for a specific label
	 */
	async getLabelCount(identifier: LabelIdentifier): Promise<number> {
		const metrics = await this.getLabelMetrics();
		return metrics[identifier] || 0;
	}

	/**
	 * Resets metrics (mainly for testing)
	 */
	async reset(): Promise<void> {
		await this.kv.delete(['metrics', 'labels']);
	}
}
