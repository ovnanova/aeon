/**
 * Script for manually updating metric values in the KV store
 * Usage: deno task metrics:update <label> <value>
 */

import { MetricsTracker } from '../src/metrics.ts';
import { initLogging } from '../src/logger.ts';
import { LabelIdentifierSchema } from '../src/schemas.ts';
import * as log from '@std/log';

const kv = await Deno.openKv();
const metrics = new MetricsTracker(kv);
await initLogging();
const logger = log.getLogger();

/**
 * Updates a metric value for a given label
 */
async function updateMetric(label: string, valueStr: string): Promise<void> {
	try {
		// Validate the label
		const validLabel = LabelIdentifierSchema.parse(label);

		// Parse and validate the new value
		const value = parseInt(valueStr, 10);
		if (isNaN(value) || value < 0) {
			throw new Error('Value must be a non-negative integer');
		}

		// Get current metrics
		const metrics_data = await metrics.getLabelMetrics();

		// Set the new value
		metrics_data[validLabel] = value;

		// Update the metrics in KV store
		await kv.set(['metrics', 'labels'], metrics_data);

		logger.info(`Updated metric for ${label} to ${value}`);
		console.log(`Successfully updated ${label} metric to ${value}`);
	} catch (error) {
		logger.error('Failed to update metric', {
			error: error instanceof Error ? error.message : String(error),
		});
		console.error(
			'Error:',
			error instanceof Error ? error.message : String(error),
		);
		Deno.exit(1);
	} finally {
		await kv.close();
	}
}

// Main execution
if (Deno.args.length !== 2) {
	console.error('Usage: deno task metrics:update <label> <value>');
	console.error('Example: deno task metrics:update adlr 42');
	Deno.exit(1);
}

await updateMetric(Deno.args[0], Deno.args[1]);
