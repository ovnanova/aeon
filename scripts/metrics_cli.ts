import { MetricsTracker } from '../src/metrics.ts';
import { initLogging } from '../src/logger.ts';
import * as log from '@std/log';

const kv = await Deno.openKv();
const metrics = new MetricsTracker(kv);
await initLogging();
const logger = log.getLogger();

async function showMetrics(): Promise<void> {
	const labelMetrics = await metrics.getLabelMetrics();
	console.log('\nCurrent Label Metrics:');
	console.table(labelMetrics);
}

async function resetMetrics(): Promise<void> {
	await metrics.reset();
	logger.info('Metrics have been reset');
}

async function main() {
	const command = Deno.args[0];

	try {
		switch (command) {
			case 'show':
				await showMetrics();
				break;
			case 'reset':
				await resetMetrics();
				break;
			default:
				console.log(`
Usage:
  deno task metrics:show    Display current metrics
  deno task metrics:reset   Reset all metrics to zero
        `);
		}
	} catch (error) {
		logger.error(
			'Error:',
			error instanceof Error ? error.message : String(error),
		);
	} finally {
		await kv.close();
	}
}

await main();
