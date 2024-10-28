import { assertEquals } from '@std/assert';
import { MetricsTracker } from '../src/metrics.ts';
import { LabelIdentifier } from '../src/schemas.ts';

Deno.test('MetricsTracker', async (t) => {
	const kv = await Deno.openKv();
	const metrics = new MetricsTracker(kv);

	// Clean up before tests
	await metrics.reset();

	await t.step('initial metrics should be empty', async () => {
		const labelMetrics = await metrics.getLabelMetrics();
		assertEquals(Object.keys(labelMetrics).length, 0);
	});

	await t.step('should increment label count', async () => {
		const testLabel = 'adlr' as LabelIdentifier;
		await metrics.incrementLabel(testLabel);
		const count = await metrics.getLabelCount(testLabel);
		assertEquals(count, 1);
	});

	await t.step('should handle multiple increments', async () => {
		const testLabel = 'adlr' as LabelIdentifier;
		await metrics.incrementLabel(testLabel);
		const count = await metrics.getLabelCount(testLabel);
		assertEquals(count, 2);
	});

	await t.step('should decrement label count', async () => {
		const testLabel = 'adlr' as LabelIdentifier;
		await metrics.decrementLabel(testLabel);
		const count = await metrics.getLabelCount(testLabel);
		assertEquals(count, 1);
	});

	await t.step('should not decrement below zero', async () => {
		const testLabel = 'arar' as LabelIdentifier;
		await metrics.decrementLabel(testLabel);
		const count = await metrics.getLabelCount(testLabel);
		assertEquals(count, 0);
	});

	await t.step('should track multiple labels independently', async () => {
		const label1 = 'adlr' as LabelIdentifier;
		const label2 = 'arar' as LabelIdentifier;

		await metrics.incrementLabel(label1);
		await metrics.incrementLabel(label2);
		await metrics.incrementLabel(label2);

		const metrics1 = await metrics.getLabelCount(label1);
		const metrics2 = await metrics.getLabelCount(label2);

		assertEquals(metrics1, 2); // One from previous test + one new
		assertEquals(metrics2, 2); // Two new increments
	});

	// Clean up after tests
	await metrics.reset();
	await kv.close();
});
