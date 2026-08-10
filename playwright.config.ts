import { defineConfig } from '@playwright/test';

const operatorUrl = 'http://127.0.0.1:4150';
const harnessUrl = 'http://127.0.0.1:4154';

export default defineConfig({
  testDir: './tests/e2e',
  failOnFlakyTests: true,
  forbidOnly: Boolean(process.env['CI']),
  fullyParallel: false,
  retries: process.env['CI'] ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: './.dev/pw-profile/report' }]],
  outputDir: './.dev/pw-profile/artifacts',
  use: {
    baseURL: operatorUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/playwright-server.mjs',
    url: `${harnessUrl}/readyz`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
