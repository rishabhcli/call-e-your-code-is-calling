#!/usr/bin/env node

import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const operatorOutput = resolve(repositoryRoot, 'apps/operator/.next');
const operatorOwnershipRecord = resolve(repositoryRoot, '.dev/pids/operator.json');

if (existsSync(operatorOwnershipRecord)) {
  process.stderr.write(
    'OPERATOR_RUNTIME_ACTIVE: Stop the repository-owned development runtime before building.\n',
  );
  process.exitCode = 1;
} else if (existsSync(operatorOutput)) {
  const status = lstatSync(operatorOutput);
  if (
    status.isSymbolicLink() ||
    !status.isDirectory() ||
    realpathSync(operatorOutput) !== operatorOutput
  ) {
    process.stderr.write(
      'OPERATOR_BUILD_OUTPUT_UNSAFE: apps/operator/.next must be a real repository directory.\n',
    );
    process.exitCode = 1;
  } else {
    rmSync(operatorOutput, { force: true, recursive: true });
    process.stdout.write('operator build preparation PASS — stale Next.js output removed.\n');
  }
} else {
  process.stdout.write('operator build preparation PASS — no stale Next.js output exists.\n');
}
