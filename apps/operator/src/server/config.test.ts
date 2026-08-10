import { describe, expect, it } from 'vitest';

import { RuntimeConfigSchema } from './config.js';

describe('RuntimeConfigSchema', () => {
  it('makes the fake provider unrepresentable in production configuration', () => {
    const parsed = RuntimeConfigSchema.safeParse({
      APP_MODE: 'production',
      APP_VERSION: 'release',
      HOST: '127.0.0.1',
      DATABASE_URL: 'postgresql://db.example.invalid/directory',
      API_PORT: 4151,
      WORKER_PORT: 4153,
      CALLE_PROVIDER_MODE: 'fake',
      FAKE_CALLE_URL: 'http://127.0.0.1:4152',
      CALLE_BASE_URL: 'https://api.heycall-e.com',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a local fake-provider URL outside the exclusive port block', () => {
    const parsed = RuntimeConfigSchema.safeParse({
      APP_MODE: 'local',
      APP_VERSION: 'development',
      HOST: '127.0.0.1',
      DATABASE_URL:
        'postgresql://call_e_your_code_is_calling:local@127.0.0.1:4155/call_e_your_code_is_calling',
      API_PORT: 4151,
      WORKER_PORT: 4153,
      CALLE_PROVIDER_MODE: 'fake',
      FAKE_CALLE_URL: 'http://127.0.0.1:3000',
    });
    expect(parsed.success).toBe(false);
  });
});
