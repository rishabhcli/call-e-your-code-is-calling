#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

import { findWarningLines } from './warning-policy.mjs';

const invocation = process.argv.slice(2);
if (invocation[0] === '--') invocation.shift();
const [command, ...args] = invocation;
if (command === undefined) {
  process.stderr.write('Usage: run-with-warning-gate.mjs [--] <command> [arguments...]\n');
  process.exit(1);
}

const result = spawnSync(command, args, {
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
  stdio: 'pipe',
});
const stdout = typeof result.stdout === 'string' ? result.stdout : '';
const stderr = typeof result.stderr === 'string' ? result.stderr : '';
process.stdout.write(stdout);
process.stderr.write(stderr);

if (result.status !== 0) {
  process.stderr.write(
    `warning-gated command failed with exit code ${result.status ?? 'unknown'}: ${command}\n`,
  );
  process.exit(result.status ?? 1);
}

const warningLines = findWarningLines(`${stdout}\n${stderr}`);
if (warningLines.length > 0) {
  process.stderr.write(
    `warning-gated command emitted prohibited warning/deprecation output:\n${warningLines.join('\n')}\n`,
  );
  process.exit(1);
}
