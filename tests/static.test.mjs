import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import './article-inventory/inventory.test.mjs';
import './article-inventory/static-build.test.mjs';

function walk(root) { return readdirSync(root).flatMap(name => { const p = join(root, name); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const pages = walk('dist').filter(path => path.endsWith('.html'));
const html = path => readFileSync(path, 'utf8');
const attrs = (source, name) => [...source.matchAll(new RegExp(`\\b${name}="([^"]*)"`, 'g'))].map(m => m[1]);
const sourceCommit=JSON.parse(readFileSync('dist/release-source.json','utf8')).commit;
assert.match(sourceCommit,/^[a-f0-9]{40}$/);
const articlePages = pages.filter(p => p.startsWith('dist/articles/'));

test('all generated links and fragments resolve, including article citations', () => {
  for (const page of pages) {
    for (const href of attrs(html(page), 'href')) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const parsed = new URL(href, 'https://staging.agenticbible.si/' + page.replace(/^dist\//, ''));
      const pathname = href.startsWith('#') ? '' : parsed.pathname;
      const fragment = parsed.hash.slice(1);
      // The sole dynamic HTML entry is authenticated and covered by the Worker/browser suite.
      if (pathname === '/admin/') continue;
      let target = pathname ? (pathname.startsWith('/') ? resolve('dist', `.${pathname}`) : resolve(dirname(page), pathname)) : resolve(page);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
      assert.ok(existsSync(target), `${page}: missing ${href}`);
      if (fragment) assert.ok(attrs(html(target), 'id').includes(decodeURIComponent(fragment)), `${page}: missing fragment ${href}`);
    }
  }
});

test('twenty substantive articles include provenance, review status and connected ideas', () => {
  assert.equal(articlePages.length, 20);
  for (const page of articlePages) {
    const source = html(page);
    assert.match(source, /Editorial review pending/);
    assert.match(source, /AI-assisted project draft/);
    assert.match(source, /Human editorial certification pending/);
    assert.match(source, /Pending\. No human editorial certification is recorded\./);
    assert.match(source, /This records source consultation, not editorial certification\./);
    assert.match(source, /Claim verification was sampled; this does not certify every factual claim\./);
    assert.match(source, /Sources &amp; context|Sources & context/);
    assert.ok(attrs(source, 'id').filter(id => id.startsWith('source-')).length >= 2);
    assert.ok(source.replace(/<[^>]*>/g, ' ').split(/\s+/).length > 400);
    assert.match(source, /Connected ideas/);
  }
});

test('new genuine entries have substantive prose, audited citations and actual GitHub history', () => {
  const record=JSON.parse(readFileSync('docs/review/encyclopedia-source-verification.json','utf8'));
  assert.equal(record.independentEditorialReview,'pending');
  for(const id of ['agent-orchestration','agent-memory','retrieval-augmented-generation','agent-evaluation','prompt-injection']){
    const source=html(`dist/articles/${id}/index.html`),body=/<div class="prose"[^>]*>([^]*?)<\/div>/.exec(source)?.[1]??'';
    assert.ok(body.replace(/<[^>]*>/g,' ').split(/\s+/).length>500,`${id}: substantive article body`);
    assert.match(source,new RegExp(`/commits/${sourceCommit}/src/content/articles/${id}\\.md`));
    assert.doesNotMatch(source,/Published local demonstration|Supplied local demonstration|Bound original bytes/);
    const claims=record.claims.filter(claim=>claim.articleId===id);assert.equal(claims.length,3);
    for(const claim of claims){assert.ok(body.includes(`href="#source-${claim.citationId}"`));assert.ok(source.includes(`href="${claim.url}"`));assert.ok(claim.sectionsChecked&&claim.supports&&claim.limits&&claim.versionContext);}
    assert.ok(attrs(source,'href').filter(href=>/^\/articles\//.test(href)).length>=4);
  }
});

test('six operating-principles entries retain genuine provenance, source dates, primary evidence and current file history',()=>{
  const record=JSON.parse(readFileSync('docs/review/operating-principles-source-verification.json','utf8'));
  assert.equal(record.independentEditorialReview,'pending');assert.equal(record.checkedOn,'2026-10-17');
  for(const id of ['agent-planning','durable-agent-execution','tool-permissions','agent-sandboxing','agent-observability','human-oversight']){
    const source=html(`dist/articles/${id}/index.html`),body=/<div class="prose"[^>]*>([^]*?)<\/div>/.exec(source)?.[1]??'';
    assert.ok(body.replace(/<[^>]*>/g,' ').split(/\s+/).length>550,id);assert.match(source,/datetime="2026-10-17"[^>]*>17 October 2026/);
    assert.doesNotMatch(source,/<dt\b[^>]*>Prepared<\/dt>|Published local demonstration|Supplied local demonstration|Bound original bytes/);
    assert.ok(source.includes(`/commits/${sourceCommit}/src/content/articles/${id}.md`));
    const claims=record.claims.filter(claim=>claim.articleId===id);assert.equal(claims.length,3);for(const claim of claims){assert.ok(body.includes(`href="#source-${claim.citationId}"`));assert.ok(source.includes(`href="${claim.url}"`));assert.ok(claim.sectionsChecked&&claim.supports&&claim.limits&&claim.versionContext);}
  }
});

test('staging pages are non-indexable, use staging canonicals, and contain no inline or external scripts', () => {
  for (const page of pages) {
    const source = html(page);
    assert.match(source, /name="robots" content="noindex, nofollow"/);
    if(/(?:search|contribute|404|history|review)(?:\/|\.html)/.test(page))assert.doesNotMatch(source,/rel="canonical"/);
    else assert.match(source, /rel="canonical" href="https:\/\/staging\.agenticbible\.si\//);
    assert.equal(attrs(source, 'id').length, new Set(attrs(source, 'id')).size, `${page}: duplicate ids`);
    for (const script of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      assert.match(script[1], /src="\/_astro\//, `${page}: script must be a local file`);
      assert.equal(script[2].trim(), '', `${page}: inline script violates CSP`);
    }
    assert.doesNotMatch(source, /<iframe|<form[^>]+action="https?:|<script[^>]+src="https?:/);
  }
  assert.match(html('dist/robots.txt'), /Allow: \//);
  assert.doesNotMatch(html('dist/robots.txt'), /Disallow:|Sitemap:/);
  assert.match(html('dist/_headers'), /X-Robots-Tag: noindex, nofollow/);
  assert.ok(!existsSync('dist/sitemap.xml'), 'preview must not publish a sitemap');
});

test('Pagefind artifacts and the isolated static-only staging configuration exist', () => {
  assert.ok(existsSync('dist/pagefind/pagefind.js'));
  assert.ok(walk('dist/pagefind').some(p => p.includes('/wasm.') && p.endsWith('.pagefind')));
  const config = JSON.parse(html('wrangler.staging.jsonc'));
  assert.equal(config.name, 'agentic-bible-staging');
  assert.equal(config.account_id, 'c370be29e4065365de03bc8652da2cdc');
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  for (const key of ['main', 'routes', 'd1_databases', 'kv_namespaces', 'ai', 'triggers', 'secrets']) assert.ok(!(key in config), `unexpected ${key}`);
});

test('twenty-entry inventory has eighteen scoped primary records for final six working drafts',()=>{
  const record=JSON.parse(readFileSync('docs/review/mvp-twenty-source-verification.json','utf8'));
  assert.equal(record.independentEditorialReview,'pending');assert.equal(record.checkedOn,'2026-10-17');assert.equal(record.claims.length,18);
  for(const id of ["context-engineering", "structured-outputs", "agent-identity", "agent-to-agent-communication", "agent-budgets", "computer-use-agents"]){const source=html(`dist/articles/${id}/index.html`),body=/<div class="prose"[^>]*>([^]*?)<\/div>/.exec(source)?.[1]??'';
    assert.ok(body.replace(/<[^>]*>/g,' ').split(/\s+/).length>550,id);assert.match(source,/datetime="2026-10-17"[^>]*>17 October 2026/);
    assert.ok(source.includes(`/commits/${sourceCommit}/src/content/articles/${id}.md`));
    const claims=record.claims.filter(c=>c.articleId===id);assert.equal(claims.length,3);for(const c of claims){assert.ok(body.includes(`href="#source-${c.citationId}"`));assert.ok(source.includes(`href="${c.url}"`));assert.ok(c.sectionsChecked&&c.supports&&c.limits&&c.versionContext);}
  }
  const catalog=JSON.parse(html('dist/source-catalog.json'));assert.equal(catalog.articles.length,20);assert.equal(catalog.sources.length,50);
  // AI agent now pins the same ReAct v3 source as orchestration: one shared
  // primary record, rather than separate unversioned/versioned URL records.
  assert.ok(html('dist/articles/ai-agent/index.html').includes('href="https://arxiv.org/abs/2210.03629v3"'));
  assert.ok(html('dist/articles/agent-orchestration/index.html').includes('href="https://arxiv.org/abs/2210.03629v3"'));
  assert.ok(Buffer.byteLength(html('dist/source-catalog.json'))<=32768,'current catalog remains inside frozen V1 reader contract');
});

test('rendered numeric claim citations point to their matching source-list ordinal',()=>{
  for(const page of articlePages){const source=html(page),ids=attrs(source,'id').filter(id=>id.startsWith('source-'));
    for(const [,id,label]of source.matchAll(/<a href="#(source-[^"]+)">(\d+)<\/a>/g))assert.equal(Number(label),ids.indexOf(id)+1,`${page}: ${id}`);
  }
});

test('contribution choices exactly match the published source catalog while static intake stays disabled', () => {
  const page = html('dist/contribute/index.html');
  const catalog = JSON.parse(readFileSync('dist/source-catalog.json', 'utf8'));
  const select = /<select\b[^>]*id="article-id"[^>]*>([^]*?)<\/select>/.exec(page)?.[1] ?? '';
  const choices = [...select.matchAll(/<option\b[^>]*value="([^"]+)"/g)].map(match => match[1]);
  assert.equal(choices.length, 20);
  assert.deepEqual(choices.sort(), catalog.articles.map(article => article.id).sort());
  assert.match(page, /<form\b[^>]*hidden/);
  assert.match(page, /<fieldset\b[^>]*disabled/);
  assert.match(page, /Reader submissions are currently closed/);
  assert.match(page, /This page cannot send a suggestion/);
  assert.doesNotMatch(page, /only.*AI agent, Tool use, and Model Context Protocol/);
});
