/**
 * Metrics tracking system for ÆON.
 * Tracks label application and removal statistics.
 */
import * as log from '@std/log';
import { LabelIdentifier } from './schemas.ts';
import { MetricsError } from './errors.ts';

interface ProcessStats {
	startTime: number;
	labelsTotal: number;
	removeTotal: number;
	lastLabelApplied?: string;
	lastLabelRemoved?: string;
	lastOperationTime?: number;
}

const INITIAL_STATS: ProcessStats = {
	startTime: Date.now(),
	labelsTotal: 0,
	removeTotal: 0,
};

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
	 * Records a label application operation.
	 */
	async recordLabelOp(label: LabelIdentifier): Promise<void> {
		try {
			const stats = await this.getStats();
			stats.labelsTotal++;
			stats.lastLabelApplied = label;
			stats.lastOperationTime = Date.now();

			await this.kv.set(['metrics', 'process_stats'], stats);
			this.logger.info(`Label operation recorded: ${label}`);
		} catch (error) {
			this.logger.error(
				`Failed to record label operation: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new MetricsError(
				`Failed to record label operation: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Records a label removal operation.
	 */
	async recordRemoveOp(label: LabelIdentifier): Promise<void> {
		try {
			const stats = await this.getStats();
			stats.removeTotal++;
			stats.lastLabelRemoved = label;
			stats.lastOperationTime = Date.now();

			await this.kv.set(['metrics', 'process_stats'], stats);
			this.logger.info(`Label removal recorded: ${label}`);
		} catch (error) {
			this.logger.error(
				`Failed to record label removal: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new MetricsError(
				`Failed to record label removal: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Retrieves current process statistics.
	 */
	async getStats(): Promise<ProcessStats> {
		try {
			const result = await this.kv.get<ProcessStats>([
				'metrics',
				'process_stats',
			]);
			return result.value ?? structuredClone(INITIAL_STATS);
		} catch (error) {
			this.logger.error(
				`Failed to get stats: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw new MetricsError(
				`Failed to get stats: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}
