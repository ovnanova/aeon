import { assertEquals, assertExists } from '@std/assert';
import { MetricsTracker } from '../src/metrics.ts';
import { initLogging } from '../src/logger.ts';

// Initialize logging before tests
await initLogging();

Deno.test('MetricsTracker', async (t) => {
	const kv = await Deno.openKv();
	const metrics = new MetricsTracker(kv);

	// Clean up existing test data
	await kv.delete(['metrics', 'process_stats']);

	await t.step('initial stats should have default values', async () => {
		const stats = await metrics.getStats();
		assertEquals(stats.labelsTotal, 0);
		assertEquals(stats.removeTotal, 0);
		assertExists(stats.startTime);
	});

	await t.step('should record label application', async () => {
		await metrics.recordLabelOp('adlr');
		const stats = await metrics.getStats();
		assertEquals(stats.labelsTotal, 1);
		assertEquals(stats.lastLabelApplied, 'adlr');
		assertExists(stats.lastOperationTime);
	});

	await t.step('should record label removal', async () => {
		await metrics.recordRemoveOp('adlr');
		const stats = await metrics.getStats();
		assertEquals(stats.removeTotal, 1);
		assertEquals(stats.lastLabelRemoved, 'adlr');
		assertExists(stats.lastOperationTime);
	});

	// Clean up test data
	await kv.delete(['metrics', 'process_stats']);
	await kv.close();
});
