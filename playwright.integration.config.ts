import config from './playwright.editorial.config';
import {defineConfig} from '@playwright/test';

export default defineConfig({
  ...config,
  testDir:'./tests/integration-browser',
  outputDir:'test-results/integration',
  reporter:[['list'],['html',{outputFolder:'playwright-report/integration',open:'never'}]],
  webServer:{...config.webServer,command:'node scripts/editorial-test-server.mjs integration',url:'http://127.0.0.1:8788/api/editorial/status',reuseExistingServer:false,timeout:45000},
});
