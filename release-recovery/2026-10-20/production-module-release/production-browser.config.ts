import {defineConfig} from '@playwright/test';
import root from '../../playwright.config.ts';
export default defineConfig({...root,workers:1,use:{...root.use,baseURL:'http://127.0.0.1:8790'},webServer:undefined,testDir:'../production-launch/browser',outputDir:'./production-browser-results',reporter:[['list'],['json',{outputFile:'.git/production-module-release/production-browser-report.json'}]]});