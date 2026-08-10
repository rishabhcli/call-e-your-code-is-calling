#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const profileRoot = resolve(root, '.dev/pw-profile');
const temporaryRoot = resolve(profileRoot, 'tmp');
const cacheRoot = resolve(root, '.dev/cache');
const browserRoot = resolve(cacheRoot, 'ms-playwright');
const xdgCacheRoot = resolve(cacheRoot, 'xdg');

for (const directory of [profileRoot, temporaryRoot, cacheRoot, browserRoot, xdgCacheRoot]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
}

const executable = resolve(root, 'node_modules/.bin/playwright');
const result = spawnSync(executable, process.argv.slice(2), {
  cwd: root,
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browserRoot,
    TMPDIR: temporaryRoot,
    XDG_CACHE_HOME: xdgCacheRoot,
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
