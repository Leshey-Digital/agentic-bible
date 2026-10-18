import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests/editorial-browser',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/editorial', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8788',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) },
  },
  webServer: { command: 'node scripts/editorial-test-server.mjs', url: 'http://127.0.0.1:8788/api/editorial/status', reuseExistingServer: false, timeout: 45000 },
});
