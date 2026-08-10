#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const profileRoot = resolve(root, '.dev/pw-profile');
const temporaryRoot = resolve(root, '.dev/tmp');
const temporaryEnvironmentPath = '.dev/tmp';
const cacheRoot = resolve(root, '.dev/cache');
const browserRoot = resolve(cacheRoot, 'ms-playwright');
const xdgCacheRoot = resolve(cacheRoot, 'xdg');
const childEnvironment = { ...process.env };

// Playwright forces color for its worker and web-server output. Node 24 emits a
// process warning when FORCE_COLOR and a host-provided NO_COLOR are both set,
// which would make the repository's warning-zero gate fail despite passing
// browser tests. Do not propagate the conflicting host preference into this
// repository-owned subprocess tree.
delete childEnvironment['NO_COLOR'];

for (const directory of [profileRoot, temporaryRoot, cacheRoot, browserRoot, xdgCacheRoot]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
}

const executable = resolve(root, 'node_modules/.bin/playwright');
const result = spawnSync(executable, process.argv.slice(2), {
  cwd: root,
  env: {
    ...childEnvironment,
    PLAYWRIGHT_BROWSERS_PATH: browserRoot,
    // Keep the socket path short enough for macOS even when a clean worktree is
    // nested below `.dev/tmp`, while the actual storage remains repository-owned.
    TMPDIR: temporaryEnvironmentPath,
    XDG_CACHE_HOME: xdgCacheRoot,
  },
  stdio: 'inherit',
});

let cleanupStatus = 0;
if (process.argv[2] === 'test') {
  cleanupStatus =
    spawnSync('pnpm', ['dev:down'], {
      cwd: root,
      env: childEnvironment,
      stdio: 'inherit',
    }).status ?? 1;
}

process.exit(result.status === 0 ? cleanupStatus : (result.status ?? 1));
