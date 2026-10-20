import {defineConfig} from '@playwright/test';
import root from '../../playwright.config.ts';
export default defineConfig({...root,workers:1,use:{...root.use,baseURL:'http://127.0.0.1:8790'},webServer:undefined,testDir:'./browser',outputDir:'./network-browser-results',reporter:[['list'],['json',{outputFile:'.git/production-module-release/network-browser-report.json'}]]});