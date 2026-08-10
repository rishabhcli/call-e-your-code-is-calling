#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const commit = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
  encoding: 'utf8',
  stdio: 'pipe',
}).stdout.trim();
if (commit === '') {
  process.stderr.write('verify:clean-checkout requires a committed HEAD.\n');
  process.exit(1);
}

const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
  encoding: 'utf8',
  stdio: 'pipe',
}).stdout.trim();
if (status !== '') {
  process.stderr.write(
    'verify:clean-checkout refuses a dirty source tree; commit the coherent slice first.\n',
  );
  process.exit(1);
}

const parent = resolve(root, '.dev/tmp');
const checkout = resolve(parent, `clean-${commit.slice(0, 12)}-${process.pid}`);
mkdirSync(parent, { recursive: true });

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

try {
  run('git', ['worktree', 'add', '--detach', checkout, commit], root);
  run('pnpm', ['bootstrap'], checkout);
  run('pnpm', ['verify-all'], checkout);
  const cleanStatus = spawnSync('git', ['status', '--porcelain'], {
    cwd: checkout,
    encoding: 'utf8',
    stdio: 'pipe',
  }).stdout.trim();
  if (cleanStatus !== '') throw new Error(`clean checkout became dirty:\n${cleanStatus}`);
  process.stdout.write(`verify:clean-checkout PASS for ${commit}.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'clean verification failed'}\n`);
  process.exitCode = 1;
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', checkout], { cwd: root, stdio: 'inherit' });
  rmSync(checkout, { force: true, recursive: true });
}
