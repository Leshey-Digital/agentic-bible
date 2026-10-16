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
async function expectDraft(page: Page, draft: Record<string, string>) {
  for (const [name, value] of Object.entries(draft)) await expect(page.locator(`[name="${name}"]`)).toHaveValue(value);
}
async function holdCommittedSubmission(page: Page, discardResponse = false) {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let committed!: (receipt: { reference: string }) => void;
  let failed!: (error: unknown) => void;
  const saved = new Promise<{ reference: string }>((resolve, reject) => { committed = resolve; failed = reject; });
  await page.route('**/api/submissions', async route => {
    try {
      const response = await route.fetch(); // Commit to the actual Worker/D1 before delaying only the response.
      expect(response.status()).toBe(201);
      committed(await response.json());
      await held;
      if (discardResponse) await route.abort();
      else await route.fulfill({ response });
    } catch (error) { failed(error); throw error; }
  });
  return { saved, release };
}
async function storedItem(page: Page, reference: string) {
  const response = await page.request.get(`/api/admin/submissions/${reference}`);
  expect(response.status()).toBe(200);
  const record = await response.json();
  expect(record.audit).toHaveLength(1);
  expect(record.audit[0].action).toBe('submitted');
  expect(record.item.version).toBe(1);
  return record.item;
}
async function newReferences(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/admin/submissions?status=new');
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.next, 'These bounded fixtures must fit in one inbox page for exact counts.').toBeNull();
  return result.items.map((item: { id: string }) => item.id);
}
async function expectAddedRecords(page: Page, before: string[], references: string[]) {
  const after = await newReferences(page);
  expect(after).toHaveLength(before.length + references.length);
  expect(after.filter(id => !before.includes(id)).sort()).toEqual([...references].sort());
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

test('a committed response preserves newer draft fields and their fresh reference through reload', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.10' }); // Isolated synthetic local rate window.
  await page.goto('/contribute/?article=tool-use');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  const original = { articleId: 'tool-use', kind: 'correction', message: 'Synthetic pending save: the original tool evidence commits before this response is released.', sourceUrl: 'https://example.org/original' };
  const newer = { articleId: 'ai-agent', kind: 'source', message: 'Synthetic newer draft: retain every edited field while the original response is pending.', sourceUrl: 'https://example.org/new-evidence' };
  await page.getByLabel('What needs attention?').fill(original.message);
  await page.getByLabel('Primary source URL').fill(original.sourceUrl);
  const originalKey = await page.locator('#request-key').inputValue();
  const held = await holdCommittedSubmission(page);
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const first = await held.saved;
  try {
    await page.getByLabel('Article', { exact: true }).selectOption(newer.articleId);
    await page.getByLabel('Suggestion type').selectOption(newer.kind);
    await page.getByLabel('What needs attention?').fill(newer.message);
    await page.getByLabel('Primary source URL').fill(newer.sourceUrl);
  } finally { held.release(); }
  await expect(page.locator('#receipt')).toContainText('Your newer draft is kept');
  await expectDraft(page, newer);
  const newKey = await page.locator('#request-key').inputValue();
  expect(newKey).not.toBe(originalKey);
  await page.unroute('**/api/submissions');
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { ...newer, requestKey: newKey });
  const response = page.waitForResponse(response => response.url().endsWith('/api/submissions'));
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const saved = await response; expect(saved.status()).toBe(201);
  const second = await saved.json(); expect(second.reference).not.toBe(first.reference);
  await expect(page.locator('#receipt')).toContainText('Suggestion saved');
  await login(page);
  expect(await storedItem(page, first.reference)).toMatchObject(original);
  expect(await storedItem(page, second.reference)).toMatchObject(newer);
});

test('a lost committed response and edited replay conflict have nondestructive recovery across reloads', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.11' });
  await page.goto('/contribute/');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  const original = 'Synthetic lost response: this evidence is committed even though the browser never receives its receipt.';
  const revised = { articleId: 'tool-use', kind: 'source', message: 'Synthetic revised evidence after response loss: keep all edits while choosing a fresh request reference.', sourceUrl: 'https://example.org/revised-evidence' };
  let firstReference = '';
  await page.route('**/api/submissions', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(201);
    firstReference = (await response.json()).reference;
    await route.abort(); // Storage has committed; only delivery of the response fails.
  });
  await page.getByLabel('What needs attention?').fill(original);
  const oldKey = await page.locator('#request-key').inputValue();
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not confirm');
  await expect(page.getByRole('button', { name: 'Keep draft with new reference' })).toBeVisible();
  await page.unroute('**/api/submissions');
  await page.getByLabel('Article', { exact: true }).selectOption(revised.articleId);
  await page.getByLabel('Suggestion type').selectOption(revised.kind);
  await page.getByLabel('What needs attention?').fill(revised.message);
  await page.getByLabel('Primary source URL').fill(revised.sourceUrl);
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { ...revised, requestKey: oldKey });
  await expect(page.locator('#draft-recovery')).toContainText('An earlier version may already be saved');
  const conflict = page.waitForResponse(response => response.url().endsWith('/api/submissions'));
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('different content');
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { ...revised, requestKey: oldKey });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('draft-recovery-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Keep draft with new reference' }).click();
  const newKey = await page.locator('#request-key').inputValue(); expect(newKey).not.toBe(oldKey);
  await expectDraft(page, revised);
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { ...revised, requestKey: newKey });
  await expect(page.getByRole('button', { name: 'Keep draft with new reference' })).toBeHidden();
  const response = page.waitForResponse(response => response.url().endsWith('/api/submissions'));
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const saved = await response; expect(saved.status()).toBe(201);
  const second = await saved.json(); expect(second.reference).not.toBe(firstReference);
  await expect(page.locator('#receipt')).toContainText('Suggestion saved');
  await login(page);
  expect(await storedItem(page, firstReference)).toMatchObject({ message: original, articleId: 'ai-agent', kind: 'correction', sourceUrl: '' });
  expect(await storedItem(page, second.reference)).toMatchObject(revised);
});

test('clearing and starting a draft during a pending save preserves the new draft reference', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.12' });
  await page.goto('/contribute/');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  const original = 'Synthetic original before clearing: the pending response belongs only to this stored suggestion.';
  const newer = 'Synthetic new draft after clearing: the older response must preserve this draft and its own reference.';
  await page.getByLabel('What needs attention?').fill(original);
  const held = await holdCommittedSubmission(page);
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const first = await held.saved;
  let newKey = '';
  try {
    await page.getByRole('button', { name: 'Clear draft' }).click();
    newKey = await page.locator('#request-key').inputValue();
    await page.getByLabel('What needs attention?').fill(newer);
  } finally { held.release(); }
  await expect(page.locator('#receipt')).toContainText('Your newer draft is kept');
  await expectDraft(page, { message: newer, requestKey: newKey });
  await page.unroute('**/api/submissions');
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { message: newer, requestKey: newKey });
  const response = page.waitForResponse(response => response.url().endsWith('/api/submissions'));
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const saved = await response; expect(saved.status()).toBe(201);
  const second = await saved.json(); expect(second.reference).not.toBe(first.reference);
  await expect(page.locator('#receipt')).toContainText('Suggestion saved');
  await login(page);
  expect(await storedItem(page, first.reference)).toMatchObject({ message: original });
  expect(await storedItem(page, second.reference)).toMatchObject({ message: newer });
});

test('an unchanged retry after a lost committed response and reload reuses one record and audit event', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.20' });
  await login(page);
  const before = await newReferences(page);
  await page.goto('/contribute/?article=model-context-protocol');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  const draft = { articleId: 'model-context-protocol', kind: 'source', message: 'Synthetic unchanged replay: confirm the original persisted evidence after its receipt is lost.', sourceUrl: 'https://example.org/unchanged-replay' };
  await page.getByLabel('Suggestion type').selectOption(draft.kind);
  await page.getByLabel('What needs attention?').fill(draft.message);
  await page.getByLabel('Primary source URL').fill(draft.sourceUrl);
  const requestKey = await page.locator('#request-key').inputValue();
  let reference = '';
  await page.route('**/api/submissions', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(201);
    reference = (await response.json()).reference;
    await route.abort();
  });
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not confirm');
  await page.unroute('**/api/submissions');
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { ...draft, requestKey });
  await expect(page.getByRole('button', { name: 'Keep draft with new reference' })).toBeVisible();
  const replay = page.waitForResponse(response => response.url().endsWith('/api/submissions'));
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const response = await replay; expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ reference, duplicate: true });
  await expect(page.locator('#receipt')).toContainText('previously saved suggestion');
  await expectDraft(page, { message: '', sourceUrl: '' });
  expect(await page.evaluate(() => sessionStorage.getItem('agentic-bible:synthetic-suggestion:v1'))).toBeNull();
  await expectAddedRecords(page, before, [reference]);
  expect(await storedItem(page, reference)).toMatchObject(draft);
});

test('reloading before a pending save responds retains newer fields for conflict recovery', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.21' });
  await login(page);
  const before = await newReferences(page);
  await page.goto('/contribute/?article=tool-use');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  const original = { articleId: 'tool-use', kind: 'correction', message: 'Synthetic navigation interruption: the first evidence commits before this page is reloaded.', sourceUrl: 'https://example.org/before-reload' };
  const newer = { articleId: 'ai-agent', kind: 'source', message: 'Synthetic pending navigation edits: preserve every newer field when reloading before receipt delivery.', sourceUrl: 'https://example.org/after-reload' };
  await page.getByLabel('What needs attention?').fill(original.message);
  await page.getByLabel('Primary source URL').fill(original.sourceUrl);
  const oldKey = await page.locator('#request-key').inputValue();
  const held = await holdCommittedSubmission(page, true);
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const first = await held.saved;
  try {
    await page.getByLabel('Article', { exact: true }).selectOption(newer.articleId);
    await page.getByLabel('Suggestion type').selectOption(newer.kind);
    await page.getByLabel('What needs attention?').fill(newer.message);
    await page.getByLabel('Primary source URL').fill(newer.sourceUrl);
    await expect(page.getByRole('button', { name: 'Saving suggestion…' })).toBeDisabled();
    await page.reload(); // The old document is destroyed while its committed response is still withheld.
  } finally { held.release(); }
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { ...newer, requestKey: oldKey });
  const conflict = page.waitForResponse(response => response.url().endsWith('/api/submissions'));
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('different content');
  await expectAddedRecords(page, before, [first.reference]);
  await page.getByRole('button', { name: 'Keep draft with new reference' }).click();
  const newKey = await page.locator('#request-key').inputValue(); expect(newKey).not.toBe(oldKey);
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { ...newer, requestKey: newKey });
  const save = page.waitForResponse(response => response.url().endsWith('/api/submissions'));
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const response = await save; expect(response.status()).toBe(201);
  const second = await response.json(); expect(second.reference).not.toBe(first.reference);
  await expect(page.locator('#receipt')).toContainText('Suggestion saved');
  await expectAddedRecords(page, before, [first.reference, second.reference]);
  expect(await storedItem(page, first.reference)).toMatchObject(original);
  expect(await storedItem(page, second.reference)).toMatchObject(newer);
});

test('clearing without replacement during a pending save stays cleared after completion and navigation', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.22' });
  await login(page);
  const before = await newReferences(page);
  await page.goto('/contribute/?article=tool-use');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  const original = { articleId: 'tool-use', kind: 'source', message: 'Synthetic clear-only interruption: retain the stored original but keep the deliberately cleared draft absent.', sourceUrl: 'https://example.org/clear-only' };
  await page.getByLabel('Suggestion type').selectOption(original.kind);
  await page.getByLabel('What needs attention?').fill(original.message);
  await page.getByLabel('Primary source URL').fill(original.sourceUrl);
  const oldKey = await page.locator('#request-key').inputValue();
  const held = await holdCommittedSubmission(page);
  await page.getByRole('button', { name: 'Send local suggestion' }).click();
  const first = await held.saved;
  let clearedKey = '';
  try {
    await page.getByRole('button', { name: 'Clear draft' }).click();
    clearedKey = await page.locator('#request-key').inputValue(); expect(clearedKey).not.toBe(oldKey);
    expect(await page.evaluate(() => sessionStorage.getItem('agentic-bible:synthetic-suggestion:v1'))).toBeNull();
  } finally { held.release(); }
  await expect(page.locator('#receipt')).toContainText(first.reference);
  await expectDraft(page, { message: '', sourceUrl: '', requestKey: clearedKey });
  expect(await page.evaluate(() => sessionStorage.getItem('agentic-bible:synthetic-suggestion:v1'))).toBeNull();
  await page.unroute('**/api/submissions');
  await page.reload();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { articleId: 'tool-use', kind: 'correction', message: '', sourceUrl: '' });
  expect(await page.evaluate(() => sessionStorage.getItem('agentic-bible:synthetic-suggestion:v1'))).toBeNull();
  await page.goto('/contribute/?article=model-context-protocol');
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expectDraft(page, { articleId: 'model-context-protocol', message: '', sourceUrl: '' });
  await expectAddedRecords(page, before, [first.reference]);
  expect(await storedItem(page, first.reference)).toMatchObject(original);
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
