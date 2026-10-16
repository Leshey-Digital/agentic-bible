import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = 'http://127.0.0.1:8788';
const suggestion = () => ({ requestKey: crypto.randomUUID(), articleId: 'ai-agent', kind: 'correction', message: `Synthetic browser suggestion ${crypto.randomUUID()}: clarify the distinction between an agent and a fixed workflow.`, sourceUrl: 'https://www.anthropic.com/engineering/building-effective-agents', website: '' });
async function login(page: Page, identity = 'local-editor') {
  await page.goto('/admin/sign-in/');
  await page.getByLabel('Test identity').selectOption(identity);
  await page.getByRole('button', { name: 'Start local test session' }).click();
}
async function submit(request: APIRequestContext, body = suggestion()) {
  return request.post('/api/submissions', { headers: { Origin: origin }, data: body });
}

test('local submission persists through refresh and becomes a tagged, audited inbox disposition', async ({ page }) => {
  await page.goto('/contribute/?article=tool-use');
  const text = 'Synthetic correction: describe where the application executes client tools and where the execution result is returned.';
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expect(page.getByLabel('Article', { exact: true })).toHaveValue('tool-use');
  await page.getByLabel('What needs attention?').fill(text);
  await page.getByLabel('Primary source URL').fill('https://developers.openai.com/api/docs/guides/function-calling');
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toHaveValue(text);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('editorial-form-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  await expect(page.locator('#receipt')).toContainText('Suggestion saved. Reference');
  await login(page);
  await page.getByRole('link', { name: text.slice(0, 80) }).click();
  await expect(page.locator('.submitted-text')).toHaveText(text);
  await page.getByLabel('Tags', { exact: true }).fill('Tools, Evidence context');
  await page.getByLabel('Status', { exact: true }).selectOption('follow-up');
  await page.getByRole('button', { name: 'Save disposition' }).click();
  await expect(page.getByRole('status')).toContainText('Disposition saved');
  await expect(page.locator('.audit-log')).toContainText('review-updated');
  await expect(page.locator('.audit-log')).toContainText('Tools, Evidence context');
  await page.reload();
  await expect(page.getByLabel('Tags', { exact: true })).toHaveValue('Tools, Evidence context');
  await page.screenshot({ path: test.info().outputPath('editorial-detail-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('link', { name: 'Back to needs follow-up' }).click();
  await expect(page.locator('.inbox-list')).toContainText(text.slice(0, 80));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: test.info().outputPath('editorial-inbox-desktop.png'), fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('validation and network interruption retain the draft and allow safe retry', async ({ page }) => {
  await page.goto('/contribute/');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await page.getByLabel('What needs attention?').fill('short');
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  await expect(page.locator('#message-error')).toContainText('20');
  await expect(page.getByLabel('What needs attention?')).toHaveValue('short');
  const text = 'Synthetic interrupted suggestion: preserve the draft until the server confirms the save.';
  await page.getByLabel('What needs attention?').fill(text);
  await page.route('**/api/submissions', route => route.abort());
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not confirm');
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toHaveValue(text);
  await page.unroute('**/api/submissions');
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  await expect(page.locator('#receipt')).toContainText('Suggestion saved');
});

test('anonymous, forged, reader and logged-out sessions cannot access the admin API', async ({ page, request }) => {
  expect((await request.get('/api/admin/submissions')).status()).toBe(401);
  expect((await request.get('/api/admin/submissions', { headers: { 'X-Role': 'admin', 'X-Local-Test-Identity': 'local-editor', Cookie: 'ab_local_editorial=' + 'f'.repeat(64) } })).status()).toBe(401);
  await login(page, 'local-reader');
  await expect(page.getByRole('heading', { name: 'Admin role required' })).toBeVisible();
  expect((await page.request.get('/api/admin/submissions')).status()).toBe(403);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await login(page);
  const session = await page.request.get('/api/admin/session'); expect(session.status()).toBe(200);
  const cookie = (await page.context().cookies()).find(cookie => cookie.name === 'ab_local_editorial')!;
  await page.getByRole('button', { name: 'Sign out' }).click();
  expect((await page.request.get('/api/admin/submissions', { headers: { Cookie: `${cookie.name}=${cookie.value}` } })).status()).toBe(401);
});

test('actual D1 handles simultaneous duplicate saves, stale updates, CSRF and malicious intake', async ({ request, page }) => {
  const body = suggestion();
  const responses = await Promise.all([submit(request, body), submit(request, body)]);
  expect(responses.map(response => response.status()).sort()).toEqual([200, 201]);
  const records = await Promise.all(responses.map(response => response.json()));
  expect(records[0].reference).toBe(records[1].reference);
  const id = records[0].reference;
  expect((await submit(request, { ...body, requestKey: crypto.randomUUID(), message: '<script>alert("synthetic")</script>' })).status()).toBe(422);
  expect((await request.post('/api/submissions', { headers: { Origin: 'https://attacker.invalid' }, data: suggestion() })).status()).toBe(403);
  const bot = await submit(request, { ...suggestion(), website: 'synthetic-bot' }); expect(bot.status()).toBe(202); expect((await bot.json()).reference).toBeUndefined();
  await login(page);
  const session = await (await page.request.get('/api/admin/session')).json();
  const endpoint = `/api/admin/submissions/${id}`;
  const change = { status: 'resolved', tags: 'Documentation', version: 1 };
  expect((await page.request.patch(endpoint, { headers: { Origin: origin }, data: change })).status()).toBe(403);
  expect((await page.request.patch(endpoint, { headers: { Origin: origin, 'X-CSRF-Token': session.csrf }, data: change })).status()).toBe(200);
  expect((await page.request.patch(endpoint, { headers: { Origin: origin, 'X-CSRF-Token': session.csrf }, data: change })).status()).toBe(409);
  const saved = await (await page.request.get(endpoint)).json();
  expect(saved.item.version).toBe(2); expect(saved.audit).toHaveLength(2);
  await page.goto(`/admin/items/${id}/`);
  expect((await page.request.patch(endpoint, { headers: { Origin: origin, 'X-CSRF-Token': session.csrf }, data: { status: 'new', tags: 'Another update', version: 2 } })).status()).toBe(200);
  await page.getByLabel('Tags', { exact: true }).fill('My retained tag');
  await page.getByRole('button', { name: 'Save disposition' }).click();
  await expect(page.getByRole('alert')).toContainText('Another update changed this item');
  await expect(page.getByLabel('Tags', { exact: true })).toHaveValue('My retained tag');
});

test('inbox empty and sign-in states remain accessible; rate limit stops further writes', async ({ page, request }) => {
  await page.goto('/admin/sign-in/');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await login(page);
  await page.goto('/admin/?status=dismissed');
  await expect(page.getByRole('heading', { name: 'No items in this view.' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  const statuses = [];
  for (let index = 0; index < 6; index++) statuses.push((await submit(request)).status());
  expect(statuses).toContain(429);
  expect(statuses.filter(status => status === 201).length).toBeLessThanOrEqual(5);
});
