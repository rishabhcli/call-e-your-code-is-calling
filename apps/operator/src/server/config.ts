import { z } from 'zod';

const PortSchema = z.coerce.number().int().min(4150).max(4159);
const LoopbackUrlSchema = z.url().superRefine((rawUrl, context) => {
  const url = new URL(rawUrl);
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    context.addIssue({ code: 'custom', message: 'local service URLs must use loopback' });
  }
  const port = Number.parseInt(url.port, 10);
  if (!Number.isInteger(port) || port < 4150 || port > 4159) {
    context.addIssue({ code: 'custom', message: 'local service URLs must use ports 4150-4159' });
  }
});

const BaseConfigSchema = z.object({
  APP_MODE: z.enum(['local', 'test', 'staging', 'production']),
  APP_VERSION: z.string().trim().min(1).max(100),
  HOST: z.literal('127.0.0.1'),
  DATABASE_URL: z.url(),
  API_PORT: PortSchema,
  WORKER_PORT: PortSchema,
  FAKE_CALLE_URL: LoopbackUrlSchema.optional(),
  CALLE_PROVIDER_MODE: z.enum(['disabled', 'fake', 'live']),
  CALLE_BASE_URL: z.url().optional(),
});

export const RuntimeConfigSchema = BaseConfigSchema.superRefine((config, context) => {
  const allocated = [config.API_PORT, config.WORKER_PORT];
  if (new Set(allocated).size !== allocated.length) {
    context.addIssue({ code: 'custom', message: 'service ports must be unique' });
  }

  if (config.APP_MODE === 'production') {
    if (config.CALLE_PROVIDER_MODE !== 'live') {
      context.addIssue({
        code: 'custom',
        message: 'production requires the live CALL-E provider capability',
        path: ['CALLE_PROVIDER_MODE'],
      });
    }
    if (config.FAKE_CALLE_URL !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'production must not include a fake CALL-E URL',
        path: ['FAKE_CALLE_URL'],
      });
    }
    if (
      config.CALLE_BASE_URL === undefined ||
      new URL(config.CALLE_BASE_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'production CALL-E base URL must be explicit HTTPS',
        path: ['CALLE_BASE_URL'],
      });
    }
  }

  if (config.CALLE_PROVIDER_MODE === 'fake' && config.FAKE_CALLE_URL === undefined) {
    context.addIssue({
      code: 'custom',
      message: 'fake provider mode requires an explicit loopback URL',
      path: ['FAKE_CALLE_URL'],
    });
  }
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return RuntimeConfigSchema.parse({
    APP_MODE: environment['APP_MODE'],
    APP_VERSION: environment['APP_VERSION'],
    HOST: environment['HOST'],
    DATABASE_URL: environment['DATABASE_URL'],
    API_PORT: environment['API_PORT'],
    WORKER_PORT: environment['WORKER_PORT'],
    FAKE_CALLE_URL: environment['FAKE_CALLE_URL'],
    CALLE_PROVIDER_MODE: environment['CALLE_PROVIDER_MODE'],
    CALLE_BASE_URL: environment['CALLE_BASE_URL'],
  });
}
