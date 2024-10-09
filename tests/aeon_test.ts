import { z } from 'zod';
import { assertEquals, assertRejects } from '@std/assert';
import { assertSpyCall, spy } from '@std/testing/mock';
import { LABELS } from '../src/labels.ts';
import { CATEGORY_PREFIXES, Category } from '../src/schemas.ts';

const CategorySchema = z.nativeEnum(CATEGORY_PREFIXES);

class MockAeon {
    private labelerServer: any;
    private agent: any;

    constructor() {
        this.labelerServer = {
            did: 'did:plc:7iza6de2dwap2sbkpav7c6c6',
            createLabels: spy(() => Promise.resolve([])),
            createLabel: spy(() => Promise.resolve({})),
            db: {
                prepare: () => ({
                    all: () => [
                        { val: 'fklr', neg: false },
                        { val: 'adlr', neg: false },
                        { val: 'lstr', neg: false },
                        { val: 'fklr', neg: true },
                    ],
                }),
            },
        };
        this.agent = {
            login: spy(() => Promise.resolve({})),
        };
    }

    async init(): Promise<void> {
        await this.agent.login({
            identifier: 'test-handle',
            password: 'test-password',
        });
        console.log('ÆON initialized');
    }

    async label(subject: string, rkey: string): Promise<void> {
        if (rkey === 'self') {
            console.log(`Self-labeling detected for ${subject}. No action taken.`);
            return;
        }

        const currentLabels = this.fetchCurrentLabels(subject);
        await this.addOrUpdateLabel(subject, rkey, currentLabels);
    }

    private fetchCurrentLabels(_did: string): Record<Category, Set<string>> {
        const labelCategories: Record<Category, Set<string>> = {
            adlr: new Set(['adlr']),
            arar: new Set(),
            eulr: new Set(),
            fklr: new Set(['fklr']),
            klbr: new Set(),
            lstr: new Set(['lstr']),
            mnhr: new Set(),
            star: new Set(),
            stcr: new Set(),
        };
        return labelCategories;
    }

    private async addOrUpdateLabel(
        subject: string,
        rkey: string,
        _labelCategories: Record<Category, Set<string>>,
    ): Promise<void> {
        const newLabel = this.findLabelByPost(rkey);
        if (!newLabel) {
            console.log(`No matching label found for rkey: ${rkey}`);
            return;
        }

        const category = this.getCategoryFromLabel(newLabel.identifier);
        await this.labelerServer.createLabel({
            uri: subject,
            val: newLabel.identifier,
            category: category,
        });
    }

    private findLabelByPost(rkey: string): { identifier: string } | undefined {
        return LABELS.find((label) => label.rkey === rkey);
    }

    private getCategoryFromLabel(label: string): Category {
        if (label.length !== 4) {
          throw new Error(`Invalid label length: ${label}`);
        }
        const lowercaseLabel = label.toLowerCase();
        if (CategorySchema.safeParse(lowercaseLabel).success) {
          return lowercaseLabel as Category;
        }
        throw new Error(`Invalid label: ${label}`);
    }
}

Deno.test('ÆON', async (t) => {
    await t.step('init', async () => {
        const aeon = new MockAeon();
        await aeon.init();
        assertSpyCall(aeon['agent'].login, 0);
    });

    await t.step('label - self labeling', async () => {
        const aeon = new MockAeon();
        const consoleSpy = spy(console, 'log');
        await aeon.label('did:plc:7iza6de2dwap2sbkpav7c6c6', 'self');
        assertSpyCall(consoleSpy, 0, {
            args: ['Self-labeling detected for did:plc:7iza6de2dwap2sbkpav7c6c6. No action taken.'],
        });
        consoleSpy.restore();
    });

    await t.step('label - successful labeling', async () => {
        const aeon = new MockAeon();
        await aeon.label('did:plc:7iza6de2dwap2sbkpav7c6c6', '3jzfcijpj2z2a');
        assertSpyCall(aeon['labelerServer'].createLabel, 0);
    });

    await t.step('findLabelByPost', () => {
        const aeon = new MockAeon();
        const result = aeon['findLabelByPost'](LABELS[0].rkey);
        assertEquals(result, LABELS[0]);
        const notFound = aeon['findLabelByPost']('3jzfcijpj222a');
        assertEquals(notFound, undefined);
    });

    await t.step('getCategoryFromLabel', async () => {
        const aeon = new MockAeon();
        const validLabels = ['adlr', 'arar', 'eulr', 'fklr', 'klbr', 'lstr', 'mnhr', 'star', 'stcr'];
        for (const label of validLabels) {
            const result = await aeon['getCategoryFromLabel'](label);
            assertEquals(result, label);
        }
    });

    await t.step('getCategoryFromLabel - invalid label', async () => {
        const aeon = new MockAeon();

        await assertRejects(
            async () => {
                await aeon['getCategoryFromLabel']('invalid');
            },
            Error,
            'Invalid label length: invalid'
        );

        await assertRejects(
            async () => {
                await aeon['getCategoryFromLabel']('abcd');
            },
            Error,
            'Invalid label: abcd'
        );
    });
});