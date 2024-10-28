import { assertEquals, assertExists } from '@std/assert';
import { ConfigSchema } from '../src/schemas.ts';
import { closeConfig, CONFIG, initializeConfig } from '../src/config.ts';

Deno.test('Config loaded correctly from KV', async () => {
  try {
    await initializeConfig();

    // Validate the entire config object
    const validatedConfig = ConfigSchema.parse(CONFIG);
    assertEquals(
      Object.keys(validatedConfig).length,
      Object.keys(ConfigSchema.shape).length,
      'All expected config keys should be present',
    );

    // Check that all required properties exist and are of the correct type
    for (const [key, value] of Object.entries(ConfigSchema.shape)) {
      assertExists(CONFIG[key as keyof typeof CONFIG], `${key} should exist`);

      const expectedType = (() => {
        switch (value._def.typeName) {
          case 'ZodString':
            return 'string';
          case 'ZodNumber':
            return 'number';
          case 'ZodUnion':
            return 'string';
          default:
            return 'unknown';
        }
      })();

      assertEquals(
        typeof CONFIG[key as keyof typeof CONFIG],
        expectedType,
        `${key} should be of the correct type`
      );
    }

    console.log('All config properties loaded and validated successfully');
  } finally {
    await closeConfig();
  }
});
