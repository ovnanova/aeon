import { assertEquals, assertRejects } from '@std/assert';
import { assertSpyCall, spy } from '@std/testing/mock';
import { LABELS } from '../src/labels.ts';
import { Category } from '../src/schemas.ts';
import { Aeon } from '../src/aeon.ts';

// Mock Deno.openKv
const mockKv = {
  // deno-lint-ignore require-await
  get: async (key: string[]) => {
    if (key[0] === 'config') {
      return { value: 'mock_value' };
    }
    return { value: null };
  },
  set: async () => {},
};

// @ts-ignore: Suppress 'Cannot assign to 'openKv' because it is a read-only property' error
Deno.openKv = () => Promise.resolve(mockKv);

Deno.test('Aeon', async (t) => {
  await t.step('init', async () => {
    const aeon = new Aeon();
    await aeon.init();
    assertSpyCall(aeon['agent'].login, 0);
  });

  await t.step('label - self labeling', async () => {
    const aeon = new Aeon();
    const consoleSpy = spy(console, 'log');
    await aeon.assignLabel('did:plc:7iza6de2dwap2sbkpav7c6c6', 'self');
    assertSpyCall(consoleSpy, 0, {
      args: [
        'Self-labeling detected for did:plc:7iza6de2dwap2sbkpav7c6c6. No action taken.',
      ],
    });
    consoleSpy.restore();
  });

  await t.step('label - successful labeling', async () => {
    const aeon = new Aeon();
    await aeon.assignLabel('did:plc:7iza6de2dwap2sbkpav7c6c6', '3jzfcijpj2z2a');
    assertSpyCall(aeon['labelerServer'].createLabel, 0);
  });

  await t.step('findLabelByPost', () => {
    const aeon = new Aeon();
    const result = aeon['findLabelByPost'](LABELS[0].rkey);
    assertEquals(result, LABELS[0]);
    const notFound = aeon['findLabelByPost']('3jzfcijpj222a');
    assertEquals(notFound, undefined);
  });

  await t.step('getCategoryFromLabel', async () => {
    const aeon = new Aeon();
    const validCategories: Category[] = [
      'adlr', 'arar', 'eulr', 'fklr', 'klbr', 'lstr', 'mnhr', 'star', 'stcr', 'drmr'
    ];
    for (const category of validCategories) {
      const result = await aeon['getCategoryFromLabel'](category);
      assertEquals(result, category);
    }
  });

  await t.step('getCategoryFromLabel - invalid label', async () => {
    const aeon = new Aeon();

    await assertRejects(
      async () => {
        await aeon['getCategoryFromLabel']('invalid');
      },
      Error,
      'Invalid label: invalid',
    );

    await assertRejects(
      async () => {
        await aeon['getCategoryFromLabel']('abcd');
      },
      Error,
      'Invalid label: abcd',
    );
  });
});