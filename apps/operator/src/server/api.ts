import { createServer } from 'node:http';

import { Pool } from 'pg';

import { loadRuntimeConfig } from './config.js';
import { createLogger } from './logger.js';
import { checkDatabase, checkHttpReadiness, type ReadinessDocument } from './readiness.js';

const config = loadRuntimeConfig();
const logger = createLogger('api');
const pool = new Pool({
  application_name: 'call-e-your-code-is-calling-api',
  connectionString: config.DATABASE_URL,
  connectionTimeoutMillis: 2_000,
  idleTimeoutMillis: 10_000,
  max: 4,
  query_timeout: 5_000,
  statement_timeout: 4_000,
});
pool.on('error', (error) => {
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : 'DATABASE_POOL_ERROR';
  logger.error({ event: 'database.idle_client_error', code }, 'An idle database client failed.');
});

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

async function handleRequest(
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
): Promise<void> {
  const correlationId = request.headers['x-correlation-id'] ?? crypto.randomUUID();
  response.setHeader('x-correlation-id', correlationId);

  if (request.method === 'GET' && request.url === '/livez') {
    writeJson(response, 200, {
      service: 'api',
      status: 'alive',
      version: config.APP_VERSION,
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/readyz') {
    const checks = [await checkDatabase(pool)];
    if (config.CALLE_PROVIDER_MODE === 'fake' && config.FAKE_CALLE_URL !== undefined) {
      checks.push(
        await checkHttpReadiness(
          `${config.FAKE_CALLE_URL}/readyz`,
          'fake_provider_ready',
          'fake-calle',
          config.APP_VERSION,
        ),
      );
    }
    const ready = checks.every((check) => check.ok);
    const document: ReadinessDocument = {
      service: 'api',
      status: ready ? 'ready' : 'not_ready',
      version: config.APP_VERSION,
      checkedAt: new Date().toISOString(),
      checks,
      capabilities: ['configuration', 'database', 'provider_boundary'],
    };
    writeJson(response, ready ? 200 : 503, document);
    return;
  }

  writeJson(response, 404, {
    error: { code: 'ROUTE_NOT_FOUND', message: 'The requested API route does not exist.' },
  });
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    logger.error({ error, event: 'api.request_failed' }, 'API request failed');
    if (!response.headersSent) {
      writeJson(response, 500, {
        error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' },
      });
    } else response.destroy();
  });
});

server.requestTimeout = 5_000;
server.headersTimeout = 6_000;
server.keepAliveTimeout = 2_000;

server.listen(config.API_PORT, config.HOST, () => {
  logger.info({ event: 'api.started', host: config.HOST, port: config.API_PORT }, 'API started');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ event: 'api.shutdown_started', signal }, 'API shutdown started');
  server.close();
  await pool.end();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
