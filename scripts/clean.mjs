#!/usr/bin/env node

import { rmSync } from 'node:fs';

const ownedBuildPaths = [
  'apps/operator/.next',
  'apps/operator/dist',
  'coverage',
  'playwright-report',
  'test-results',
  'packages/import/dist',
  'packages/freshness/dist',
  'packages/call-plan/dist',
  'packages/calle/dist',
  'packages/evidence/dist',
  'packages/review-publish/dist',
];

for (const path of ownedBuildPaths) rmSync(path, { force: true, recursive: true });
process.stdout.write('clean PASS — repository-owned build artifacts were removed.\n');
