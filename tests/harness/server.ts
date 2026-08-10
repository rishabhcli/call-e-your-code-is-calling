import { createServer } from 'node:http';

import { z } from 'zod';

const RuntimeSchema = z.object({
  API_INTERNAL_URL: z.url().startsWith('http://127.0.0.1:'),
  APP_MODE: z.enum(['local', 'test']),
  APP_VERSION: z.string().trim().min(1).max(100),
  FAKE_CALLE_URL: z.url().startsWith('http://127.0.0.1:'),
  HARNESS_PORT: z.coerce.number().int().min(4150).max(4159),
  HOST: z.literal('127.0.0.1'),
  OTEL_HEALTH_URL: z.url().startsWith('http://127.0.0.1:'),
  OPERATOR_INTERNAL_URL: z.url().startsWith('http://127.0.0.1:'),
  WORKER_INTERNAL_URL: z.url().startsWith('http://127.0.0.1:'),
});

const runtime = RuntimeSchema.parse({
  API_INTERNAL_URL: process.env['API_INTERNAL_URL'],
  APP_MODE: process.env['APP_MODE'],
  APP_VERSION: process.env['APP_VERSION'],
  FAKE_CALLE_URL: process.env['FAKE_CALLE_URL'],
  HARNESS_PORT: process.env['HARNESS_PORT'],
  HOST: process.env['HOST'],
  OTEL_HEALTH_URL: process.env['OTEL_HEALTH_URL'],
  OPERATOR_INTERNAL_URL: process.env['OPERATOR_INTERNAL_URL'],
  WORKER_INTERNAL_URL: process.env['WORKER_INTERNAL_URL'],
});

interface CheckResult {
  readonly code: string;
  readonly ok: boolean;
}

async function checkJsonDependency(
  code: string,
  service: string,
  url: string,
): Promise<CheckResult> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = (await response.json()) as unknown;
    return {
      code,
      ok:
        response.ok &&
        typeof body === 'object' &&
        body !== null &&
        'service' in body &&
        body.service === service &&
        'status' in body &&
        body.status === 'ready' &&
        'version' in body &&
        body.version === runtime.APP_VERSION,
    };
  } catch {
    return { code, ok: false };
  }
}

async function readinessChecks(): Promise<readonly CheckResult[]> {
  const componentChecks = await Promise.all([
    checkJsonDependency(
      'operator_ready',
      'operator',
      `${runtime.OPERATOR_INTERNAL_URL}/api/health`,
    ),
    checkJsonDependency('api_ready', 'api', `${runtime.API_INTERNAL_URL}/readyz`),
    checkJsonDependency('fake_calle_ready', 'fake-calle', `${runtime.FAKE_CALLE_URL}/readyz`),
    checkJsonDependency('worker_ready', 'worker', `${runtime.WORKER_INTERNAL_URL}/readyz`),
  ]);
  let collectorHealthy: boolean;
  try {
    const response = await fetch(runtime.OTEL_HEALTH_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    collectorHealthy = response.ok;
  } catch {
    collectorHealthy = false;
  }
  return [...componentChecks, { code: 'otel_health_extension', ok: collectorHealthy }];
}

function writeJson(
  response: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/livez') {
    writeJson(response, 200, {
      service: 'test-harness',
      status: 'alive',
      version: runtime.APP_VERSION,
    });
    return;
  }
  if (request.method === 'GET' && request.url === '/readyz') {
    void readinessChecks().then((checks) => {
      const ready = checks.every((check) => check.ok);
      writeJson(response, ready ? 200 : 503, {
        service: 'test-harness',
        status: ready ? 'ready' : 'not_ready',
        version: runtime.APP_VERSION,
        checkedAt: new Date().toISOString(),
        checks,
      });
    });
    return;
  }
  writeJson(response, 404, {
    error: { code: 'ROUTE_NOT_FOUND', message: 'The requested harness route does not exist.' },
  });
});

server.requestTimeout = 5_000;
server.headersTimeout = 6_000;
server.keepAliveTimeout = 2_000;
server.listen(runtime.HARNESS_PORT, runtime.HOST, () => {
  process.stdout.write(
    `${JSON.stringify({ event: 'test_harness.started', host: runtime.HOST, port: runtime.HARNESS_PORT })}\n`,
  );
});

function shutdown(): void {
  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
