#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { findWarningLines } from './warning-policy.mjs';

const startedAt = Date.now();
const startedAtIso = new Date(startedAt).toISOString();
let runtimeStarted = false;
const verificationSteps = [];
const summaryPath = resolve('.dev/logs/verify-summary.json');
mkdirSync(resolve('.dev/logs'), { recursive: true });

const pidDirectory = resolve('.dev/pids');
if (existsSync(pidDirectory) && readdirSync(pidDirectory).some((name) => name.endsWith('.json'))) {
  process.stderr.write(
    'verify-all requires no pre-existing runtime ownership records; run pnpm dev:down first.\n',
  );
  process.exit(1);
}

function run(label, command, args, environment = {}) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const stepStartedAt = Date.now();
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    maxBuffer: 20 * 1024 * 1024,
    stdio: 'pipe',
  });
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  const warningLines = findWarningLines(`${stdout}\n${stderr}`);
  const step = {
    label,
    status: result.status === 0 && warningLines.length === 0 ? 'passed' : 'failed',
    durationMilliseconds: Date.now() - stepStartedAt,
    exitCode: result.status ?? 1,
    warningCount: warningLines.length,
  };
  verificationSteps.push(step);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
  }
  if (warningLines.length > 0) {
    throw new Error(`${label} emitted warning output:\n${warningLines.join('\n')}`);
  }
}

function exactCommandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0 && typeof result.stdout === 'string'
    ? result.stdout.trim()
    : 'unknown';
}

function writeSummary(status) {
  const finishedAt = Date.now();
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        claim: 'Current Tier 0 gate execution only; this does not claim production.',
        status,
        commit: exactCommandOutput('git', ['rev-parse', 'HEAD']),
        nodeVersion: process.version,
        pnpmVersion: exactCommandOutput('pnpm', ['--version']),
        startedAt: startedAtIso,
        finishedAt: new Date(finishedAt).toISOString(),
        durationMilliseconds: finishedAt - startedAt,
        steps: verificationSteps,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
}

writeFileSync(
  summaryPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      claim: 'Current Tier 0 gate execution only; this does not claim production.',
      status: 'running',
      commit: exactCommandOutput('git', ['rev-parse', 'HEAD']),
      nodeVersion: process.version,
      pnpmVersion: exactCommandOutput('pnpm', ['--version']),
      startedAt: startedAtIso,
      finishedAt: null,
      durationMilliseconds: 0,
      steps: [],
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);

function stopRuntime() {
  if (!runtimeStarted) return;
  const result = spawnSync('pnpm', ['dev:down'], { stdio: 'inherit' });
  runtimeStarted = false;
  if (result.status !== 0) throw new Error('dev:down failed during verification cleanup');
}

try {
  run('format check', 'pnpm', ['format:check']);
  run('lint', 'pnpm', ['lint']);
  run('typecheck', 'pnpm', ['typecheck']);
  run('architecture boundaries', 'pnpm', ['boundary:check']);
  run('dependency register', 'pnpm', ['dependency:check']);
  run('high-severity dependency audit', 'pnpm', ['security:audit']);
  run('unit tests', 'pnpm', ['test:unit']);
  run('release build', 'pnpm', ['build']);
  run('development preflight', 'pnpm', ['dev:preflight']);
  runtimeStarted = true;
  run('development startup', 'pnpm', ['dev:up']);
  run('semantic development health', 'pnpm', ['dev:health']);
  run('integration tests', 'pnpm', ['test:integration']);
  stopRuntime();
  runtimeStarted = true;
  run('browser end-to-end tests', 'pnpm', ['test:e2e'], { CI: '1' });
  stopRuntime();
  writeSummary('passed');
  process.stdout.write(
    `\nverify-all PASS in ${Math.round((Date.now() - startedAt) / 1000)} seconds — every Tier 0 command and semantic runtime gate passed.\n`,
  );
} catch (error) {
  try {
    stopRuntime();
  } catch (cleanupError) {
    process.stderr.write(
      `verification cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}\n`,
    );
  }
  writeSummary('failed');
  process.stderr.write(`${error instanceof Error ? error.message : 'verify-all failed'}\n`);
  process.exitCode = 1;
}
