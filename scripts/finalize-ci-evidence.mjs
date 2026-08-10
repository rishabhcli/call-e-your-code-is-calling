#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [source, destination] = process.argv.slice(2);
if (source === undefined || destination === undefined) {
  process.stderr.write('Usage: finalize-ci-evidence.mjs <verify-summary> <destination>\n');
  process.exit(1);
}

const allowedSteps = new Set([
  'format check',
  'lint',
  'typecheck',
  'architecture boundaries',
  'dependency register',
  'high-severity dependency audit',
  'unit tests',
  'release build',
  'development preflight',
  'development startup',
  'semantic development health',
  'integration tests',
  'browser end-to-end tests',
]);

function safeSummary() {
  if (!existsSync(source)) return null;
  try {
    const value = JSON.parse(readFileSync(source, 'utf8'));
    if (
      typeof value !== 'object' ||
      value === null ||
      value.schemaVersion !== 1 ||
      !['running', 'passed', 'failed'].includes(value.status) ||
      !Array.isArray(value.steps)
    ) {
      return null;
    }
    const steps = value.steps.map((step) => {
      if (
        typeof step !== 'object' ||
        step === null ||
        typeof step.label !== 'string' ||
        !allowedSteps.has(step.label) ||
        !['passed', 'failed'].includes(step.status) ||
        !Number.isSafeInteger(step.durationMilliseconds) ||
        !Number.isSafeInteger(step.exitCode) ||
        !Number.isSafeInteger(step.warningCount)
      ) {
        throw new Error('invalid verification step');
      }
      return {
        label: step.label,
        status: step.status,
        durationMilliseconds: step.durationMilliseconds,
        exitCode: step.exitCode,
        warningCount: step.warningCount,
      };
    });
    const commit =
      typeof value.commit === 'string' && /^[0-9a-f]{40}$/u.test(value.commit)
        ? value.commit
        : 'uncommitted';
    return {
      schemaVersion: 1,
      claim: 'Current Tier 0 gate execution only; this does not claim production.',
      status: value.status,
      commit,
      nodeVersion:
        typeof value.nodeVersion === 'string' ? value.nodeVersion.slice(0, 32) : 'unknown',
      pnpmVersion:
        typeof value.pnpmVersion === 'string' ? value.pnpmVersion.slice(0, 32) : 'unknown',
      startedAt: typeof value.startedAt === 'string' ? value.startedAt.slice(0, 40) : 'unknown',
      finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt.slice(0, 40) : null,
      durationMilliseconds: Number.isSafeInteger(value.durationMilliseconds)
        ? value.durationMilliseconds
        : 0,
      steps,
    };
  } catch {
    return null;
  }
}

const repository = process.env['GITHUB_REPOSITORY'] ?? '';
const runId = process.env['GITHUB_RUN_ID'] ?? '';
const commit = process.env['GITHUB_SHA'] ?? '';
const jobStatus = process.env['CI_JOB_STATUS'] ?? 'unknown';
const validRepository = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)
  ? repository
  : 'unknown/unknown';
const validRunId = /^\d+$/u.test(runId) ? runId : 'unknown';

const evidence = {
  schemaVersion: 1,
  claim: 'Allowlisted CI execution evidence for Tier 0 gates only; this does not claim production.',
  repository: validRepository,
  commit: /^[0-9a-f]{40}$/u.test(commit) ? commit : 'unknown',
  jobStatus: ['success', 'failure', 'cancelled'].includes(jobStatus) ? jobStatus : 'unknown',
  runUrl:
    validRunId === 'unknown'
      ? null
      : `https://github.com/${validRepository}/actions/runs/${validRunId}`,
  verifySummary: safeSummary(),
};

mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
