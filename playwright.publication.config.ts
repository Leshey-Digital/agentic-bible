import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({
  testDir:'./tests/publication-browser',workers:1,fullyParallel:false,retries:0,timeout:60000,
  outputDir:'test-results/publication',reporter:[['list'],['html',{outputFolder:'playwright-report/publication',open:'never'}]],
  use:{baseURL:'http://127.0.0.1:8790',viewport:{width:1440,height:1000},trace:'retain-on-failure',launchOptions:{executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)}},
  webServer:{command:'node scripts/publication-test-server.mjs',url:'http://127.0.0.1:8790/local-publications/',reuseExistingServer:false,timeout:45000},
});
