import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';

import { z } from 'zod';

const ScenarioSchema = z.object({
  id: z.string().trim().min(1).max(100),
  terminalStatus: z.enum(['completed', 'failed']),
  taskCompleted: z.boolean(),
  completionConfidence: z.number().min(0).max(1),
  failureCode: z.string().trim().min(1).max(100).optional(),
  transcriptTurns: z.array(
    z.object({ speaker: z.enum(['bot', 'user', 'unknown']), text: z.string().min(1).max(2_000) }),
  ),
});

const CreateCallSchema = z.object({
  task: z.string().trim().min(1).max(10_000),
  recipients: z
    .array(
      z.object({
        phones: z.array(z.string().regex(/^\+[1-9]\d{6,14}$/u)).length(1),
        locale: z.string().optional(),
        region: z.string().optional(),
      }),
    )
    .length(1),
  metadata: z.object({ scenario: z.string().trim().min(1).max(100) }).loose(),
  recipientResultSchema: z.record(z.string(), z.unknown()).optional(),
  webhookUrl: z.url().optional(),
});

const RuntimeSchema = z.object({
  APP_MODE: z.enum(['local', 'test']),
  APP_VERSION: z.string().trim().min(1).max(100),
  HOST: z.literal('127.0.0.1'),
  FAKE_PORT: z.coerce.number().int().min(4150).max(4159),
});

const runtime = RuntimeSchema.parse({
  APP_MODE: process.env['APP_MODE'],
  APP_VERSION: process.env['APP_VERSION'],
  HOST: process.env['HOST'],
  FAKE_PORT: process.env['FAKE_PORT'],
});

const scenarios = z
  .array(ScenarioSchema)
  .min(2)
  .parse(JSON.parse(await readFile(resolve('tests/fake-calle/scenarios.json'), 'utf8')) as unknown);
const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
if (
  !scenarios.some((scenario) => scenario.terminalStatus === 'completed') ||
  !scenarios.some((scenario) => scenario.terminalStatus === 'failed') ||
  !scenarios.some((scenario) => !scenario.taskCompleted)
) {
  throw new Error('Fake CALL-E corpus must model success, failure, and abstention.');
}

interface StoredCall {
  readonly requestDigest: string;
  readonly response: {
    readonly id: string;
    readonly status: 'completed' | 'failed';
    readonly taskCompleted: boolean;
    readonly completionConfidence: number;
    readonly failure?: { readonly code: string; readonly message: string };
    readonly attempts: readonly {
      readonly transcriptTurns: readonly {
        readonly speaker: 'bot' | 'user' | 'unknown';
        readonly text: string;
      }[];
    }[];
    readonly metadata: Readonly<Record<string, unknown>>;
  };
}

const callsByIdempotencyKey = new Map<string, StoredCall>();
const callsById = new Map<string, StoredCall>();

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    bytes += buffer.byteLength;
    if (bytes > 65_536) {
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === 'GET' && request.url === '/livez') {
    writeJson(response, 200, {
      service: 'fake-calle',
      status: 'alive',
      version: runtime.APP_VERSION,
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/readyz') {
    writeJson(response, 200, {
      service: 'fake-calle',
      status: 'ready',
      version: runtime.APP_VERSION,
      checkedAt: new Date().toISOString(),
      checks: [
        { code: 'test_only_mode', ok: true, latencyMilliseconds: 0 },
        { code: 'scenario_corpus_valid', ok: true, latencyMilliseconds: 0 },
      ],
      capabilities: ['idempotent_create', 'canonical_get', 'failure_scenarios'],
      scenarioCount: scenarios.length,
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/v1/calls') {
    const idempotencyKey = request.headers['idempotency-key'];
    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.length < 1 ||
      idempotencyKey.length > 255
    ) {
      writeJson(response, 400, {
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'A valid Idempotency-Key is required.',
        },
      });
      return;
    }

    try {
      const body = CreateCallSchema.parse(await readJsonBody(request));
      const canonicalBody = JSON.stringify(body);
      const requestDigest = createHash('sha256').update(canonicalBody).digest('hex');
      const existing = callsByIdempotencyKey.get(idempotencyKey);
      if (existing !== undefined) {
        if (existing.requestDigest !== requestDigest) {
          writeJson(response, 409, {
            error: {
              code: 'idempotency_conflict',
              message: 'The idempotency key was already used with a different request.',
            },
          });
          return;
        }
        writeJson(response, 200, existing.response);
        return;
      }

      const scenario = scenarioById.get(body.metadata.scenario);
      if (scenario === undefined) {
        writeJson(response, 422, {
          error: {
            code: 'UNKNOWN_SCENARIO',
            message: 'The requested test scenario is not defined.',
          },
        });
        return;
      }

      const callId = `call_test_${randomUUID()}`;
      const stored: StoredCall = {
        requestDigest,
        response: {
          id: callId,
          status: scenario.terminalStatus,
          taskCompleted: scenario.taskCompleted,
          completionConfidence: scenario.completionConfidence,
          ...(scenario.failureCode === undefined
            ? {}
            : {
                failure: {
                  code: scenario.failureCode,
                  message: 'Controlled fake-provider terminal failure.',
                },
              }),
          attempts: [{ transcriptTurns: scenario.transcriptTurns }],
          metadata: body.metadata,
        },
      };
      callsByIdempotencyKey.set(idempotencyKey, stored);
      callsById.set(callId, stored);
      writeJson(response, 201, stored.response);
    } catch (error) {
      const code =
        error instanceof Error && error.message === 'BODY_TOO_LARGE'
          ? 'BODY_TOO_LARGE'
          : 'INVALID_BODY';
      writeJson(response, code === 'BODY_TOO_LARGE' ? 413 : 400, {
        error: { code, message: 'The fake CALL-E request body is invalid.' },
      });
    }
    return;
  }

  if (request.method === 'GET' && request.url?.startsWith('/v1/calls/') === true) {
    const callId = decodeURIComponent(request.url.slice('/v1/calls/'.length));
    const stored = callsById.get(callId);
    if (stored === undefined) {
      writeJson(response, 404, {
        error: { code: 'CALL_NOT_FOUND', message: 'The controlled call does not exist.' },
      });
      return;
    }
    writeJson(response, 200, stored.response);
    return;
  }

  writeJson(response, 404, {
    error: { code: 'ROUTE_NOT_FOUND', message: 'The requested fake CALL-E route does not exist.' },
  });
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch(() => {
    if (!response.headersSent) {
      writeJson(response, 500, {
        error: { code: 'INTERNAL_ERROR', message: 'The controlled request failed.' },
      });
    } else response.destroy();
  });
});

server.requestTimeout = 5_000;
server.headersTimeout = 6_000;
server.keepAliveTimeout = 2_000;
server.listen(runtime.FAKE_PORT, runtime.HOST, () => {
  process.stdout.write(
    `${JSON.stringify({ event: 'fake_calle.started', host: runtime.HOST, port: runtime.FAKE_PORT })}\n`,
  );
});

function shutdown(): void {
  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
