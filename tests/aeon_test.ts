// deno-lint-ignore-file require-await
import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { assertSpyCall, spy } from '@std/testing/mock';
import { LABELS } from '../src/labels.ts';
import {
	Category,
	ConfigSchema,
	DidSchema,
	SigningKeySchema,
} from '../src/schemas.ts';
import { Aeon } from '../src/aeon.ts';
import { CONFIG, initializeConfig } from '../src/config.ts';

// Initialize the config before running tests
await initializeConfig();

Deno.test('Config validation', () => {
	const validatedConfig = ConfigSchema.parse(CONFIG);
	assertEquals(
		Object.keys(validatedConfig).length,
		Object.keys(ConfigSchema.shape).length,
		'All expected config keys should be present',
	);

	assertExists(CONFIG.DID, 'DID should exist');
	const didParseResult = DidSchema.safeParse(CONFIG.DID);
	assertEquals(didParseResult.success, true, 'DID should match the schema');

	assertExists(CONFIG.SIGNING_KEY, 'SIGNING_KEY should exist');
	const signingKeyParseResult = SigningKeySchema.safeParse(CONFIG.SIGNING_KEY);
	assertEquals(
		signingKeyParseResult.success,
		true,
		'SIGNING_KEY should match the schema',
	);

	assertExists(CONFIG.JETSTREAM_URL, 'JETSTREAM_URL should exist');
	assertExists(CONFIG.COLLECTION, 'COLLECTION should exist');
	assertExists(CONFIG.CURSOR_INTERVAL, 'CURSOR_INTERVAL should exist');
	assertExists(CONFIG.BSKY_HANDLE, 'BSKY_HANDLE should exist');
	assertExists(CONFIG.BSKY_PASSWORD, 'BSKY_PASSWORD should exist');
	assertExists(CONFIG.BSKY_URL, 'BSKY_URL should exist');
});

// Mock the LabelerServer
class MockLabelerServer {
	db = {
		prepare: () => ({
			all: () => [],
		}),
	};
	createLabels = async () => ({ success: true });
	createLabel = async () => ({ success: true });
}

// Mock AtpAgent
class MockAtpAgent {
	login = async () => ({ success: true });
}

Deno.test('Aeon', async (t) => {
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
		const validCategories: Category[] = [
			'adlr',
			'arar',
			'eulr',
			'fklr',
			'klbr',
			'lstr',
			'mnhr',
			'star',
			'stcr',
			'drmr',
		];
		for (const category of validCategories) {
			const result = (aeon as any)['getCategoryFromLabel'](`${category}`);
			assertEquals(result, category);
		}
	});

	await t.step('getCategoryFromLabel - invalid label', () => {
		const aeon = Aeon.create(
			new MockLabelerServer() as any,
			new MockAtpAgent() as any,
		);

		assertRejects(
			async () => (aeon as any)['getCategoryFromLabel']('invalid'),
			Error,
			'Invalid label: invalid',
		);

		assertRejects(
			async () => (aeon as any)['getCategoryFromLabel']('1234'),
			Error,
			'Invalid label: 1234',
		);
	});
});
