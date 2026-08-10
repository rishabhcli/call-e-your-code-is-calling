import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  agentRules: false,
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: [
    '@call-e-directory/call-plan',
    '@call-e-directory/calle',
    '@call-e-directory/evidence',
    '@call-e-directory/freshness',
    '@call-e-directory/import',
    '@call-e-directory/review-publish',
  ],
  turbopack: {
    root: repositoryRoot,
  },
};

export default nextConfig;
