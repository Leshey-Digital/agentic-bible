import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({testDir:'./tests/wiki-bridge-browser',workers:1,fullyParallel:false,retries:0,timeout:180000,outputDir:'test-results/wiki-bridge',reporter:[['list'],['html',{outputFolder:'playwright-report/wiki-bridge',open:'never'}]],use:{viewport:{width:1440,height:1000},trace:'retain-on-failure',launchOptions:{executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)}}});
