#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function stop(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (process.version !== 'v24.19.0') {
  stop(`bootstrap requires Node 24.19.0 exactly; found ${process.version}`);
}

const pnpmVersion = spawnSync('pnpm', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
if (pnpmVersion.status !== 0 || pnpmVersion.stdout.trim() !== '11.20.0') {
  stop(`bootstrap requires pnpm 11.20.0; found ${pnpmVersion.stdout.trim() || 'unavailable'}`);
}
if (!existsSync('pnpm-lock.yaml')) stop('bootstrap requires the committed pnpm-lock.yaml');

const install = spawnSync('pnpm', ['install', '--frozen-lockfile'], { stdio: 'inherit' });
if (install.status !== 0) process.exit(install.status ?? 1);

const browser = spawnSync(process.execPath, ['scripts/playwright-cli.mjs', 'install', 'chromium'], {
  stdio: 'inherit',
});
if (browser.status !== 0) process.exit(browser.status ?? 1);

process.stdout.write(
  'bootstrap PASS — exact locked dependencies and the pinned Chromium runtime are installed.\n',
);
