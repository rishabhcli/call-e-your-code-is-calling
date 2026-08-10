import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type RequestListener } from 'node:http';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const openServers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    openServers
      .splice(0)
      .map((server) => new Promise<void>((resolveClose) => server.close(() => resolveClose()))),
  );
});

async function listenRaw(handler: RequestListener): Promise<ReturnType<typeof createServer>> {
  const server = createServer(handler);
  openServers.push(server);
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(4159, '127.0.0.1', () => resolveListen());
  });
  return server;
}

describe('repository-isolated runtime', () => {
  it('serves semantic readiness and an idempotent failure-aware fake CALL-E boundary', async () => {
    const health = await fetch('http://127.0.0.1:4151/readyz');
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ service: 'api', status: 'ready' });

    const request = {
      task: 'Disclosed test-only verification task',
      recipients: [{ phones: ['+14155550100'], region: 'US', locale: 'en-US' }],
      metadata: { scenario: 'explicit_refusal' },
    };
    const headers = {
      'content-type': 'application/json',
      'idempotency-key': `integration-${String(process.pid)}-${String(Date.now())}`,
    };
    const first = await fetch('http://127.0.0.1:4152/v1/calls', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    const second = await fetch('http://127.0.0.1:4152/v1/calls', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()) as unknown).toEqual((await first.json()) as unknown);

    const conflict = await fetch('http://127.0.0.1:4152/v1/calls', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...request, metadata: { scenario: 'no_answer' } }),
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: { code: 'idempotency_conflict' } });
  });

  it('refuses a foreign holder in the port block without killing it', async () => {
    const sentinel = await listenRaw((_request, response) => response.end('sentinel'));
    let failure: unknown;
    try {
      await execFileAsync('pnpm', ['dev:preflight']);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 1 });
    expect(String((failure as { stderr?: string }).stderr)).toContain('FOREIGN_PORT_HOLDER');
    expect(sentinel.listening).toBe(true);
  });

  it('does not confuse a TCP acceptor with semantic readiness', async () => {
    await listenRaw((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ready' }));
    });
    let failure: unknown;
    try {
      await execFileAsync(process.execPath, [
        'scripts/dev-lifecycle.mjs',
        'probe',
        'http://127.0.0.1:4159/readyz',
        'sentinel',
      ]);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 1 });
    expect(String((failure as { stderr?: string }).stderr)).toContain('SEMANTIC_READINESS_FAILED');
  });

  it('fails a committed negative boundary fixture', async () => {
    await mkdir(resolve('.dev/tmp'), { recursive: true });
    const fixtureRoot = await mkdtemp(resolve('.dev/tmp/boundary-'));
    try {
      const badFile = join(fixtureRoot, 'packages/import/src/bad.ts');
      await mkdir(join(fixtureRoot, 'packages/import/src'), { recursive: true });
      const fixture = await readFile(
        resolve('tests/fixtures/boundary/forbidden-next-import.ts.fixture'),
        'utf8',
      );
      await writeFile(badFile, fixture);
      let failure: unknown;
      try {
        await execFileAsync(
          resolve('node_modules/.bin/depcruise'),
          ['--config', resolve('dependency-cruiser.config.mjs'), 'packages'],
          { cwd: fixtureRoot },
        );
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({ code: 1 });
      const output = `${String((failure as { stdout?: string }).stdout)}\n${String(
        (failure as { stderr?: string }).stderr,
      )}`;
      expect(output).toContain('domain-does-not-import-frameworks-or-transport-sdks');
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  });

  it('stops only repository-owned runtime resources and leaves a foreign sentinel alive', async () => {
    const sentinel = await listenRaw((_request, response) => response.end('sentinel'));
    await execFileAsync('pnpm', ['dev:down'], { timeout: 60_000 });
    expect(sentinel.listening).toBe(true);
    const response = await fetch('http://127.0.0.1:4159');
    await expect(response.text()).resolves.toBe('sentinel');
  });
});
