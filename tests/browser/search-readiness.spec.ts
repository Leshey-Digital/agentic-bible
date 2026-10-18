import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('browser server serves the release source pinned to this checkout', async ({ request }) => {
  const builtSource = JSON.parse(readFileSync('dist/release-source.json', 'utf8'));
  const checkoutHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  expect(builtSource.commit).toBe(checkoutHead);
  const response = await request.get('/release-source.json');
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual(builtSource);
});

test('recognized reader questions use bounded local keyword expansions', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:8787') externalRequests.push(request.url());
  });
  await page.goto('/search/');
  const input = page.locator('#search-input');
  await input.fill('how to protect an agent from prompt injection and avoid malicious instructions in retrieved content');
  await expect(page.locator('#search-results a[href*="/articles/prompt-injection/"]')).toBeVisible();
  await expect(page.locator('#search-status')).toContainText('related keyword “prompt injection”');

  await input.fill('avoid duplicate actions after a crash');
  await expect(page.locator('#search-results a[href*="/articles/durable-agent-execution/"]')).toBeVisible();
  await expect(page.locator('#search-status')).toContainText('related keyword “durable agent execution”');
  await expect(page.locator('#search-results img, #search-results script')).toHaveCount(0);
  for (const link of await page.locator('#search-results a').all()) {
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/articles\/[a-z0-9-]+\//);
  }
  expect(externalRequests).toEqual([]);
});

test('SQL injection and ordinary after phrasing do not trigger inferred expansion', async ({ page }) => {
  await page.goto('/search/');
  const input = page.locator('#search-input');
  for (const query of [
    'protect an AI assistant from SQL injection',
    'repeat a workflow after eating lunch outdoors',
    'avoid duplicate actions after lunch in the cafeteria',
  ]) {
    await input.fill(query);
    await expect(page.locator('#search-status')).toContainText(`for “${query}”.`);
    await expect(page.locator('#search-results')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#search-status')).not.toContainText('using the related keyword');
  }

  await input.fill('protect my budget from crashes');
  await expect(page.locator('#search-status')).toContainText('for “protect my budget from crashes”.');
  await expect(page.locator('#search-results')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#no-results')).toBeVisible();
  await expect(page.locator('#search-status')).not.toContainText('related keyword');

  await input.fill('how do black holes evaporate');
  await expect(page.locator('#search-status')).toContainText('for “how do black holes evaporate”.');
  await expect(page.locator('#search-results')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#search-results li').first()).toBeVisible();
  await expect(page.locator('#search-status')).not.toContainText('related keyword');
});

test('typing quickly leaves the latest query and results visible', async ({ page }) => {
  await page.goto('/search/');
  const input = page.locator('#search-input');
  let releaseSlowFragment: () => void = () => {};
  const slowFragment = new Promise<void>(resolve => { releaseSlowFragment = resolve; });
  let delayNextFragment = true;
  await page.route('**/pagefind/fragment/**', async route => {
    if (delayNextFragment) {
      delayNextFragment = false;
      await slowFragment;
    }
    await route.continue();
  });
  try {
    const firstQueryFragment = page.waitForRequest(request => request.url().includes('/pagefind/fragment/'));
    await input.fill('prompt injection');
    await firstQueryFragment;
    await input.fill('mcp');
    await expect(page.locator('#search-results a[href="/articles/model-context-protocol/"]')).toBeVisible();
    await expect(page).toHaveURL(/#q=mcp$/);
    await expect(page.locator('#search-status')).toContainText('found for “mcp”');
    releaseSlowFragment();
    await expect(page.locator('#search-status')).toContainText('found for “mcp”');
    await expect(page.locator('#search-results a[href="/articles/prompt-injection/"]')).toHaveCount(0);
  } finally {
    releaseSlowFragment();
  }
});

test('slash opens a focused search field, while slash typed in a field stays there', async ({ page }) => {
  await page.goto('/articles/ai-agent/');
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/\/search\/$/);
  await expect(page.locator('#search-input')).toBeFocused();

  const input = page.locator('#search-input');
  await input.fill('prompt');
  await input.press('/');
  await expect(page).toHaveURL(/\/search\/#q=prompt%2F$/);
  await expect(input).toHaveValue('prompt/');
});

test('no JavaScript still exposes the complete browse list', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8787/search/');
  await expect(page.locator('.search-browse a')).toHaveCount(20);
  await expect(page.locator('#search-input')).toBeDisabled();
  await expect(page.locator('#search-status')).toContainText('Browse all entries below');
  await context.close();
});

test('a failed local index exposes its recovery action', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', route => route.abort());
  await page.goto('/search/');
  await page.locator('#search-input').fill('prompt injection');
  await expect(page.locator('#search-error')).toBeVisible();
  await expect(page.locator('#search-retry')).toBeVisible();
});
