import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({
  testDir:'./tests/combined-browser',workers:1,fullyParallel:false,retries:0,timeout:120000,
  outputDir:'test-results/combined',reporter:[['list'],['html',{outputFolder:'playwright-report/combined',open:'never'}]],
  use:{viewport:{width:1440,height:1000},trace:'retain-on-failure',launchOptions:{executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)}},
});
