import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const origin = 'http://127.0.0.1:8787';
  mkdirSync('docs/review', { recursive: true });
  await page.goto(origin);
  await page.screenshot({ path: 'docs/review/library-desktop.png', fullPage: true });
  await page.goto(`${origin}/articles/model-context-protocol/`);
  await page.screenshot({ path: 'docs/review/article-desktop.png', fullPage: true });
  await page.goto(`${origin}/search/#q=MCP`);
  await page.locator('#search-results a').first().waitFor();
  await page.screenshot({ path: 'docs/review/search-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.screenshot({ path: 'docs/review/library-mobile.png', fullPage: true });
  console.log('Saved four screenshots from the local Workers preview.');
} finally { await browser.close(); }
