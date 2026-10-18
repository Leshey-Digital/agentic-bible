import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
const sourceCommit=JSON.parse(readFileSync('dist/release-source.json','utf8')).commit;

test('reading, source anchors, related links and topic navigation work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Begin with AI agent' }).click();
  await expect(page.getByRole('heading', { name: 'AI agent', exact: true })).toBeVisible();
  await page.locator('.prose a[href="#source-patterns"]').first().click();
  await expect(page.locator('#source-patterns')).toBeInViewport();
  await page.locator('.related').getByRole('link', { name: 'Capabilities Tool use' }).click();
  await expect(page.getByRole('heading', { name: 'Tool use', exact: true })).toBeVisible();
  const codeBlockWidths=await page.locator('.prose pre').evaluateAll(elements=>elements.map(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth})));
  expect(codeBlockWidths.length).toBeGreaterThan(0);
  expect(codeBlockWidths.filter(({scrollWidth,clientWidth})=>scrollWidth>clientWidth)).toEqual([]);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Topics' }).click();
  await page.getByRole('link', { name: /03.*Protocols/ }).click();
  await expect(page.getByRole('heading', { name: 'Protocols', exact: true })).toBeVisible();
  await expect(page.locator('.article-list li')).toHaveCount(4);
});

test('real Pagefind supports success, empty, no-results, punctuation and rapid replacement', async ({ page }) => {
  await page.goto('/search/');
  const input = page.getByRole('searchbox');
  await expect(page.getByRole('status')).toContainText('Enter a word');
  await input.fill('MCP');
  await expect(page.locator('#search-results a')).not.toHaveCount(0);
  await expect(page.locator('#search-results')).toContainText('Model Context Protocol');
  await input.fill('zzunfindablewordzz');
  await expect(page.getByRole('heading', { name: 'No connections yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(input).toHaveValue('');
  await input.fill('???');
  await expect(page.getByRole('heading', { name: 'No connections yet.' })).toBeVisible();
  await input.fill('agent');
  await input.fill('JSON-RPC');
  await expect(page.getByRole('status')).toContainText('“JSON-RPC”');
  await expect(page.locator('#search-results')).toContainText('Model Context Protocol');
  await input.press('Escape');
  await expect(page.getByRole('status')).toContainText('Enter a word');
  await page.goto('/search/#q=capabilities');
  await expect(input).toHaveValue('capabilities');
  await expect(page.locator('#search-results a')).not.toHaveCount(0);
});

test('missing index has a useful fallback and retry action', async ({ page },info) => {
  await page.route('**/pagefind/**', route => route.abort());
  await page.goto('/search/');
  await page.getByRole('searchbox').fill('agent');
  await expect(page.getByRole('heading', { name: 'Search is unavailable' })).toBeVisible();
  await expect(page.locator('#search-results')).toHaveAttribute('aria-busy','false');
  await expect(page.getByRole('link', { name: 'AI agent Foundations' })).toBeVisible();
  await page.screenshot({path:info.outputPath('search-unavailable.png'),fullPage:true});
  await page.unroute('**/pagefind/**');
  await page.getByRole('button', { name: 'Retry search' }).click();
  await expect(page.locator('#search-results a')).not.toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveValue('agent');
});

// Fixed coverage: the same 24 pages, once per desktop/mobile project, with unchanged 30-second per-test and axe/viewport assertions.
const accessibilityPages = ['/', '/articles/ai-agent/', '/articles/tool-use/', '/articles/model-context-protocol/', '/articles/agent-orchestration/', '/articles/agent-memory/', '/articles/retrieval-augmented-generation/', '/articles/agent-evaluation/', '/articles/prompt-injection/', '/articles/agent-planning/', '/articles/durable-agent-execution/', '/articles/tool-permissions/', '/articles/agent-sandboxing/', '/articles/agent-observability/', '/articles/human-oversight/', '/articles/context-engineering/', '/articles/structured-outputs/', '/articles/agent-identity/', '/articles/agent-to-agent-communication/', '/articles/agent-budgets/', '/articles/computer-use-agents/', '/topics/', '/about/', '/search/'] as const;
for (const path of accessibilityPages) {
  test(`automated accessibility and viewport: ${path}`, async ({ page, browser }, testInfo) => {
    if (path === '/') {
      const runtime = { project: testInfo.project.name, version: browser.version() };
      console.log('Browser runtime: ' + JSON.stringify(runtime));
      await testInfo.attach('browser-runtime', { body: JSON.stringify(runtime), contentType: 'application/json' });
    }
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations, `${path}: accessibility violations`).toEqual([]);
  });
}

test('five new topics are discoverable through actual Pagefind and connected reading',async({page})=>{
  for(const [query,id,title]of [
    ['orchestrator','agent-orchestration','Agent orchestration'],
    ['MemGPT','agent-memory','Agent memory'],
    ['RAG-Sequence','retrieval-augmented-generation','Retrieval-augmented generation'],
    ['τ-bench','agent-evaluation','Agent evaluation'],
    ['AgentDojo','prompt-injection','Prompt injection'],
  ]){
    await page.goto('/search/');await expect(page.getByRole('searchbox')).toBeEnabled();await page.getByRole('searchbox').fill(query);
    const result=page.locator(`#search-results a[href="/articles/${id}/"]`);await expect(result).toBeVisible();await result.click();
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.locator('.article-status')).toContainText('Working draft');
    await page.locator('.prose a[href^="#source-"]').first().click();await expect(page.locator(':target')).toBeInViewport();
    await page.locator('.related a').first().click();await expect(page.getByRole('heading',{name:'AI agent',exact:true})).toBeVisible();
  }
  await page.goto('/');await expect(page.locator('.article-list li')).toHaveCount(20);
});

test('six operating-principles topics connect actual Pagefind, evidence and revision context',async({page})=>{
  for(const [query,id,title]of [
    ['Tree of Thoughts','agent-planning','Agent planning'],['idempotency','durable-agent-execution','Durable agent execution'],
    ['RFC 8707','tool-permissions','Tool permissions'],['Gofer','agent-sandboxing','Agent sandboxing'],
    ['OpenTelemetry','agent-observability','Agent observability'],['Amershi','human-oversight','Human oversight'],
  ]){
    await page.goto('/search/');await expect(page.getByRole('searchbox')).toBeEnabled();await page.getByRole('searchbox').fill(query);
    const result=page.locator(`#search-results a[href="/articles/${id}/"]`);await expect(result).toBeVisible();await result.click();
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.locator('#sources time')).toHaveText('17 October 2026');
    await expect(page.locator('#revision a.text-link')).toHaveAttribute('href',new RegExp(`/commits/${sourceCommit}/src/content/articles/${id}\\.md$`));
    await page.locator('.prose a[href^="#source-"]').first().click();await expect(page.locator(':target')).toBeInViewport();
    await page.locator('.related a').first().click();await expect(page.getByRole('heading',{name:'AI agent',exact:true})).toBeVisible();
  }
});

test('keyboard skip link, search shortcut, 404 and staging headers work', async ({ page, request }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.keyboard.press('/');
  await page.waitForURL('**/search/');
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  const response = await request.get('/missing-entry/');
  expect(response.status()).toBe(404);
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  await page.goto('/missing-entry/');
  await expect(page.getByRole('heading', { name: /off the shelf/ })).toBeVisible();
});

test('read and search send no external requests and have no runtime or CSP errors', async ({ page }) => {
  const failures: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:8787/') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto('/articles/ai-agent/');
  await page.goto('/search/#q=agent');
  await expect(page.locator('#search-results a')).not.toHaveCount(0);
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
});

test('articles, sources and browse fallback work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport:{width:390,height:844} });
  const page = await context.newPage();
  await page.goto('/articles/tool-use/');
  await expect(page.getByRole('heading', { name: 'Tool use', exact: true })).toBeVisible();
  await page.locator('[data-article-contents] summary').click();
  await page.getByRole('navigation',{name:'On this page'}).getByRole('link',{name:'Anatomy of a tool call'}).click();
  await expect(page.locator('#anatomy-of-a-tool-call')).toBeInViewport();
  await page.locator('.prose a[href="#source-openai"]').first().click();
  await expect(page.locator('#source-openai')).toBeInViewport();
  await page.goto('/search/');
  await expect(page.getByRole('status')).toContainText('Full-text search needs JavaScript.');
  await expect(page.getByRole('searchbox')).toBeDisabled();
  await page.getByRole('link', { name: 'AI agent Foundations' }).click();
  await expect(page.getByRole('heading', { name: 'AI agent', exact: true })).toBeVisible();
  await context.close();
});

test('static staging keeps public intake closed and has no exposed admin page', async ({ page, request }) => {
  await page.goto('/contribute/');
  await expect(page.getByLabel('What needs attention?')).toBeDisabled();
  await expect(page.locator('#intake-status')).toContainText('Public submissions are on hold');
  await expect(page.locator('#editorial-inbox-link')).toBeHidden();
  expect((await request.get('/admin/')).status()).toBe(404);
});

// New topics are exercised in the real static preview on both viewport projects.
test('final six topics connect real search, citation anchors, revision history and related reading',async({page})=>{
  // Together with the retained five/six-topic cases and MCP query, every genuine entry has a real search assertion.
  for(const [query,id]of [['AI agent','ai-agent'],['Tool use','tool-use']]){await page.goto('/search/');await expect(page.getByRole('searchbox')).toBeEnabled();await page.getByRole('searchbox').fill(query);await expect(page.locator(`#search-results a[href="/articles/${id}/"]`)).toBeVisible();}

  for(const [query,id,title]of [["Lost in the Middle", "context-engineering", "Context engineering"], ["JSON Schema 2020-12", "structured-outputs", "Structured outputs"], ["SPIFFE ID", "agent-identity", "Agent identity and delegation"], ["A2A", "agent-to-agent-communication", "Agent-to-agent communication"], ["MaxTurnsExceeded", "agent-budgets", "Agent budgets and termination"], ["OSWorld", "computer-use-agents", "Computer-use agents"]]){
    await page.goto('/search/');await expect(page.getByRole('searchbox')).toBeEnabled();await page.getByRole('searchbox').fill(query);
    const result=page.locator(`#search-results a[href="/articles/${id}/"]`);await expect(result).toBeVisible();await result.click();
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.locator('.article-status')).toContainText('Working draft');
    await expect(page.locator('#sources time')).toHaveText('17 October 2026');await expect(page.locator('#revision')).toContainText('Pending.');await expect(page.locator('#revision')).toContainText('No human editorial certification is recorded');
    await expect(page.locator('#revision a.text-link')).toHaveAttribute('href',new RegExp(`/commits/${sourceCommit}/src/content/articles/${id}\\.md$`));
    await page.locator('.prose a[href^="#source-"]').first().click();await expect(page.locator(':target')).toBeInViewport();
    await page.locator('.related a').first().click();await expect(page.getByRole('heading',{name:'AI agent',exact:true})).toBeVisible();
  }
});
