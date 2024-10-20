// deno-lint-ignore-file require-await
import { assertEquals } from '@std/assert';
import { assertSpyCall, spy } from '@std/testing/mock';
import { LABELS } from '../src/labels.ts';
import { LabelCategory } from '../src/schemas.ts';
import { Aeon } from '../src/aeon.ts';
import { CONFIG, initializeConfig } from '../src/config.ts';

// Initialize the config before running tests
await initializeConfig();

// Mock the LabelerServer
class MockLabelerServer {
	db = {
		prepare: () => ({
			all: (_did: string, prefix: string) => {
				if (prefix.startsWith('adlr')) {
					return [['adlr', 'false']];
				}
				return [];
			},
		}),
	};
	createLabels = async () => ({ success: true });
	createLabel = async () => ({ success: true });
}

// Mock AtpAgent
class MockAtpAgent {
	login = async () => ({ success: true });
}

Deno.test('Labeler', async (t) => {
	await t.step('init', async () => {
		const mockAgent = new MockAtpAgent();
		const loginSpy = spy(mockAgent, 'login');
		const aeon = Aeon.create(new MockLabelerServer() as any, mockAgent as any);

		await aeon.init();

		assertSpyCall(loginSpy, 0);
	});

	await t.step('assignLabel - self labeling', async () => {
		const aeon = Aeon.create(
			new MockLabelerServer() as any,
			new MockAtpAgent() as any,
		);
		const consoleSpy = spy(console, 'log');
		await aeon.assignLabel(CONFIG.DID, 'self');
		assertSpyCall(consoleSpy, 0, {
			args: [
				`Self-labeling detected for ${CONFIG.DID}. No action taken.`,
			],
		});
		consoleSpy.restore();
	});

	await t.step('assignLabel - successful labeling', async () => {
		const mockLabelerServer = new MockLabelerServer();
		const createLabelSpy = spy(mockLabelerServer, 'createLabel');
		const aeon = Aeon.create(
			mockLabelerServer as any,
			new MockAtpAgent() as any,
		);

		await aeon.assignLabel(CONFIG.DID, '3jzfcijpj2z2a');

		assertSpyCall(createLabelSpy, 0);
	});

	await t.step('deleteLabel - successful label deletion', async () => {
		const mockLabelerServer = new MockLabelerServer();
		const createLabelSpy = spy(mockLabelerServer, 'createLabel');
		const consoleSpy = spy(console, 'log');
		const aeon = Aeon.create(
			mockLabelerServer as any,
			new MockAtpAgent() as any,
		);

		await aeon.deleteLabel(CONFIG.DID, 'adlr');

		assertSpyCall(consoleSpy, 0, {
			args: ['Current adlr labels: adlr'],
		});
		assertSpyCall(consoleSpy, 1, {
			args: [`Removing adlr label adlr from ${CONFIG.DID}.`],
		});
		assertSpyCall(createLabelSpy, 0, {
			args: [{ uri: CONFIG.DID, val: 'adlr', neg: true }],
		});

		consoleSpy.restore();
	});

	await t.step('deleteLabel - non-existent label', async () => {
		const mockLabelerServer = new MockLabelerServer();
		const createLabelSpy = spy(mockLabelerServer, 'createLabel');
		const consoleSpy = spy(console, 'log');
		const aeon = Aeon.create(
			mockLabelerServer as any,
			new MockAtpAgent() as any,
		);

		await aeon.deleteLabel(CONFIG.DID, 'nonexistent');

		assertEquals(
			createLabelSpy.calls.length,
			0,
			'createLabel should not be called for non-existent labels',
		);
		assertSpyCall(consoleSpy, 0, {
			args: ['Current adlr labels: adlr'],
		});
		assertSpyCall(consoleSpy, 1, {
			args: ['Invalid label: nonexistent. No action taken.'],
		});

		consoleSpy.restore();
	});

	await t.step('findLabelByPost', () => {
		const aeon = Aeon.create(
			new MockLabelerServer() as any,
			new MockAtpAgent() as any,
		);
		const result = (aeon as any)['findLabelByPost'](LABELS[0].rkey);
		assertEquals(result, LABELS[0]);
		const notFound = (aeon as any)['findLabelByPost']('3jzfcijpj222a');
		assertEquals(notFound, undefined);
	});

	await t.step('getCategoryFromLabel', () => {
		const aeon = Aeon.create(
			new MockLabelerServer() as any,
			new MockAtpAgent() as any,
		);
		const validCategories: LabelCategory[] = [
			...new Set(LABELS.map((label) => label.category)),
		];
		for (const category of validCategories) {
			const result = (aeon as any)['getCategoryFromLabel'](`${category}`);
			assertEquals(result, category);
		}

		// Test for a label that doesn't start with a valid category
		const invalidResult = (aeon as any)['getCategoryFromLabel'](
			'invalidcategory',
		);
		assertEquals(
			invalidResult,
			undefined,
			'Should return undefined for invalid category',
		);
	});
});
