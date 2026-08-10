import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('verification output policy', () => {
  it('does not confuse a filename containing warning with warning output', async () => {
    const result = await execFileAsync(process.execPath, [
      resolve('scripts/run-with-warning-gate.mjs'),
      '--',
      process.execPath,
      '-e',
      "process.stdout.write('scripts/warning-policy.mjs\\n')",
    ]);
    expect(result.stdout).toContain('scripts/warning-policy.mjs');
  });

  it('rejects deprecation output that a narrower warning matcher could miss', async () => {
    let failure: unknown;
    try {
      await execFileAsync(process.execPath, [
        resolve('scripts/run-with-warning-gate.mjs'),
        '--',
        process.execPath,
        '-e',
        "process.stderr.write('DeprecationWarning: controlled test output\\n')",
      ]);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 1 });
    expect(String((failure as { stderr?: string }).stderr)).toContain(
      'emitted prohibited warning/deprecation output',
    );
  });

  it('emits only allowlisted CI evidence fields', async () => {
    await mkdir(resolve('.dev/tmp'), { recursive: true });
    const directory = await mkdtemp(resolve('.dev/tmp/ci-evidence-'));
    const source = join(directory, 'source.json');
    const destination = join(directory, 'destination.json');
    const canary = 'PRIVATE-CANARY-MUST-NOT-APPEAR';
    try {
      await writeFile(
        source,
        JSON.stringify({
          schemaVersion: 1,
          status: 'passed',
          commit: 'a'.repeat(40),
          nodeVersion: 'v24.19.0',
          pnpmVersion: '11.20.0',
          startedAt: '2026-08-10T00:00:00.000Z',
          finishedAt: '2026-08-10T00:01:00.000Z',
          durationMilliseconds: 60_000,
          secret: canary,
          steps: [
            {
              label: 'lint',
              status: 'passed',
              durationMilliseconds: 1,
              exitCode: 0,
              warningCount: 0,
              rawOutput: canary,
            },
          ],
        }),
      );
      await execFileAsync(
        process.execPath,
        [resolve('scripts/finalize-ci-evidence.mjs'), source, destination],
        {
          env: {
            ...process.env,
            CI_JOB_STATUS: 'success',
            GITHUB_REPOSITORY: 'owner/repository',
            GITHUB_RUN_ID: '12345',
            GITHUB_SHA: 'b'.repeat(40),
          },
        },
      );
      const evidence = await readFile(destination, 'utf8');
      expect(evidence).not.toContain(canary);
      expect(JSON.parse(evidence) as unknown).toMatchObject({
        jobStatus: 'success',
        runUrl: 'https://github.com/owner/repository/actions/runs/12345',
        verifySummary: {
          status: 'passed',
          steps: [{ label: 'lint', status: 'passed' }],
        },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
