import { execFile, spawn } from 'node:child_process';
import { rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const lifecycleScript = resolve('scripts/dev-lifecycle.mjs');
const lockFile = resolve('.dev/lifecycle.lock');
const lockOwnerFile = resolve('.dev/lifecycle.lock.owner.json');
const testEnvironment = {
  ...process.env,
  CALL_E_LIFECYCLE_LOCK_TEST: '1',
};

function lifecycleArguments(...arguments_: string[]): string[] {
  return [lifecycleScript, 'lock-test', ...arguments_];
}

async function lifecycleFailure(...arguments_: string[]): Promise<{
  code?: number | string;
  stderr?: string;
}> {
  try {
    await execFileAsync(process.execPath, lifecycleArguments(...arguments_), {
      env: testEnvironment,
      timeout: 30_000,
    });
  } catch (error) {
    return error as { code?: number | string; stderr?: string };
  }
  throw new Error('Expected the lifecycle command to fail.');
}

describe('atomic lifecycle lock', () => {
  it('rejects a forged private invocation without an inherited lock descriptor', async () => {
    const token = 'a'.repeat(32);
    let failure: unknown;
    try {
      await execFileAsync(
        process.execPath,
        [lifecycleScript, '__lock-held', 'test', token, 'hold', '0'],
        {
          env: { ...testEnvironment, CALL_E_LIFECYCLE_LOCK_WRAPPER_TOKEN: token },
          timeout: 30_000,
        },
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: 1 });
    expect(String((failure as { stderr?: string }).stderr)).toContain('LIFECYCLE_LOCK_INVALID');
  });

  it('rejects a concurrent lifecycle operation without disturbing the current owner', async () => {
    const releaseFileName = `lifecycle-lock-release-${String(process.pid)}-${String(Date.now())}`;
    const releaseFile = resolve('.dev/tmp', releaseFileName);
    await rm(releaseFile, { force: true });
    const holder = spawn(process.execPath, lifecycleArguments('hold-until', releaseFileName), {
      env: testEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const acquired = new Promise<void>((resolveAcquired, rejectAcquired) => {
      const timeout = setTimeout(
        () => rejectAcquired(new Error(`Timed out waiting for lifecycle lock: ${output}`)),
        15_000,
      );
      holder.stdout.setEncoding('utf8');
      holder.stderr.setEncoding('utf8');
      holder.stdout.on('data', (chunk: string) => {
        output += chunk;
        if (output.includes('lifecycle-lock:test acquired')) {
          clearTimeout(timeout);
          resolveAcquired();
        }
      });
      holder.stderr.on('data', (chunk: string) => {
        output += chunk;
      });
      holder.once('error', (error) => {
        clearTimeout(timeout);
        rejectAcquired(error);
      });
      holder.once('exit', (code, signal) => {
        if (!output.includes('lifecycle-lock:test acquired')) {
          clearTimeout(timeout);
          rejectAcquired(
            new Error(
              `Lifecycle lock holder exited before acquisition (${String(code)}/${String(signal)}): ${output}`,
            ),
          );
        }
      });
    });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolveExit) => {
        holder.once('exit', (code, signal) => resolveExit({ code, signal }));
      },
    );

    try {
      await acquired;
      const conflict = await lifecycleFailure('hold', '0');
      expect(conflict.code).toBe(1);
      expect(String(conflict.stderr)).toContain('LIFECYCLE_LOCKED');
    } finally {
      await writeFile(releaseFile, 'release\n', { flag: 'wx' });
    }
    await expect(exited).resolves.toEqual({ code: 0, signal: null });
    await rm(releaseFile, { force: true });
  });

  it('recovers from a crashed owner without replacing or reclaiming the lock file', async () => {
    await execFileAsync(process.execPath, lifecycleArguments('hold', '0'), {
      env: testEnvironment,
      timeout: 30_000,
    });
    const originalLock = await stat(lockFile);

    const crash = await lifecycleFailure('crash');
    expect(crash.code).toBe(86);
    await expect(stat(lockOwnerFile)).resolves.toBeDefined();

    await execFileAsync(process.execPath, lifecycleArguments('hold', '0'), {
      env: testEnvironment,
      timeout: 30_000,
    });
    const recoveredLock = await stat(lockFile);
    expect(recoveredLock.ino).toBe(originalLock.ino);
    await expect(stat(lockOwnerFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
