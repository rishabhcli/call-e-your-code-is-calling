import { createServer } from 'node:http';

import { Pool } from 'pg';

import { loadRuntimeConfig } from './config.js';
import { createLogger } from './logger.js';
import { checkDatabase, type ReadinessDocument } from './readiness.js';

const config = loadRuntimeConfig();
const logger = createLogger('worker');
const pool = new Pool({
  application_name: 'call-e-your-code-is-calling-worker',
  connectionString: config.DATABASE_URL,
  connectionTimeoutMillis: 2_000,
  idleTimeoutMillis: 10_000,
  max: 2,
  query_timeout: 5_000,
  statement_timeout: 4_000,
});
pool.on('error', (error) => {
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : 'DATABASE_POOL_ERROR';
  logger.error({ event: 'database.idle_client_error', code }, 'An idle database client failed.');
});

let lastLeaseHeartbeatAt = 0;

async function heartbeat(): Promise<void> {
  const check = await checkDatabase(pool);
  if (check.ok) {
    lastLeaseHeartbeatAt = Date.now();
  } else {
    logger.warn({ event: 'worker.heartbeat_failed', check }, 'Worker heartbeat failed');
  }
}

await heartbeat();
const heartbeatTimer = setInterval(() => void heartbeat(), 2_000);
heartbeatTimer.unref();

async function handleRequest(
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
): Promise<void> {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-content-type-options', 'nosniff');

  if (request.method === 'GET' && request.url === '/livez') {
    response.writeHead(200);
    response.end(
      JSON.stringify({ service: 'worker', status: 'alive', version: config.APP_VERSION }),
    );
    return;
  }

  if (request.method === 'GET' && request.url === '/readyz') {
    const database = await checkDatabase(pool);
    const heartbeatCurrent = Date.now() - lastLeaseHeartbeatAt < 10_000;
    const checks = [
      database,
      { code: 'worker_lease_heartbeat_current', ok: heartbeatCurrent, latencyMilliseconds: 0 },
    ];
    const ready = checks.every((check) => check.ok);
    const document: ReadinessDocument = {
      service: 'worker',
      status: ready ? 'ready' : 'not_ready',
      version: config.APP_VERSION,
      checkedAt: new Date().toISOString(),
      checks,
      capabilities: ['configuration', 'database', 'lease_heartbeat'],
    };
    response.writeHead(ready ? 200 : 503);
    response.end(JSON.stringify(document));
    return;
  }

  response.writeHead(404);
  response.end(
    JSON.stringify({
      error: { code: 'ROUTE_NOT_FOUND', message: 'The requested worker route does not exist.' },
    }),
  );
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    logger.error({ error, event: 'worker.request_failed' }, 'Worker request failed');
    if (!response.headersSent) {
      response.writeHead(500);
      response.end(
        JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' },
        }),
      );
    } else response.destroy();
  });
});

server.listen(config.WORKER_PORT, config.HOST, () => {
  logger.info(
    { event: 'worker.started', host: config.HOST, port: config.WORKER_PORT },
    'Worker started',
  );
});

async function shutdown(signal: string): Promise<void> {
  clearInterval(heartbeatTimer);
  logger.info({ event: 'worker.shutdown_started', signal }, 'Worker shutdown started');
  server.close();
  await pool.end();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
