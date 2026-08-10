#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const operatorOutput = resolve(repositoryRoot, 'apps/operator/.next');
const operatorCache = resolve(operatorOutput, 'cache');
const operatorOwnershipRecord = resolve(repositoryRoot, '.dev/pids/operator.json');

function isRealDirectory(path) {
  if (!existsSync(path)) return false;
  const status = lstatSync(path);
  return !status.isSymbolicLink() && status.isDirectory() && realpathSync(path) === path;
}

if (existsSync(operatorOwnershipRecord)) {
  process.stderr.write(
    'OPERATOR_RUNTIME_ACTIVE: Stop the repository-owned development runtime before building.\n',
  );
  process.exitCode = 1;
} else if (existsSync(operatorOutput)) {
  if (!isRealDirectory(operatorOutput)) {
    process.stderr.write(
      'OPERATOR_BUILD_OUTPUT_UNSAFE: apps/operator/.next must be a real repository directory.\n',
    );
    process.exitCode = 1;
  } else if (existsSync(operatorCache) && !isRealDirectory(operatorCache)) {
    process.stderr.write(
      'OPERATOR_BUILD_CACHE_UNSAFE: apps/operator/.next/cache must be a real repository directory.\n',
    );
    process.exitCode = 1;
  } else {
    for (const entry of readdirSync(operatorOutput)) {
      if (entry !== 'cache') {
        rmSync(resolve(operatorOutput, entry), { force: true, recursive: true });
      }
    }
    mkdirSync(operatorCache, { recursive: true });
    process.stdout.write(
      'operator build preparation PASS — stale Next.js output removed and the isolated build cache retained.\n',
    );
  }
} else {
  mkdirSync(operatorCache, { recursive: true });
  process.stdout.write(
    'operator build preparation PASS — isolated build cache initialized with no stale output.\n',
  );
}
