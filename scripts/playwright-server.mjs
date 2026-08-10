#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function run(command, args) {
  return spawnSync(command, args, { stdio: 'inherit' }).status ?? 1;
}

const upStatus = run('pnpm', ['dev:up']);
if (upStatus !== 0) process.exit(upStatus);

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(`Playwright runtime received ${signal}; stopping owned services.\n`);
  const status = run('pnpm', ['dev:down']);
  process.exit(status);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.stdout.write('Playwright runtime is ready.\n');
setInterval(() => undefined, 60_000);
