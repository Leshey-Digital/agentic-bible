import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

function walk(root) { return readdirSync(root).flatMap(name => { const p = join(root, name); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const pages = walk('dist').filter(path => path.endsWith('.html'));
const html = path => readFileSync(path, 'utf8');
const attrs = (source, name) => [...source.matchAll(new RegExp(`\\b${name}="([^"]*)"`, 'g'))].map(m => m[1]);
const articlePages = pages.filter(p => p.startsWith('dist/articles/'));

test('all generated links and fragments resolve, including article citations', () => {
  for (const page of pages) {
    for (const href of attrs(html(page), 'href')) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [pathname, fragment] = href.split('#');
      let target = pathname ? (pathname.startsWith('/') ? resolve('dist', `.${pathname}`) : resolve(dirname(page), pathname)) : resolve(page);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
      assert.ok(existsSync(target), `${page}: missing ${href}`);
      if (fragment) assert.ok(attrs(html(target), 'id').includes(decodeURIComponent(fragment)), `${page}: missing fragment ${href}`);
    }
  }
});

test('three substantive articles include provenance, review status and connected ideas', () => {
  assert.equal(articlePages.length, 3);
  for (const page of articlePages) {
    const source = html(page);
    assert.match(source, /Editorial review pending/);
    assert.match(source, /AI-assisted project draft/);
    assert.match(source, /no reviewer assigned/);
    assert.match(source, /Sources &amp; context|Sources & context/);
    assert.ok(attrs(source, 'id').filter(id => id.startsWith('source-')).length >= 2);
    assert.ok(source.replace(/<[^>]*>/g, ' ').split(/\s+/).length > 400);
    assert.match(source, /Connected ideas/);
  }
});

test('staging pages are non-indexable, use staging canonicals, and contain no inline or external scripts', () => {
  for (const page of pages) {
    const source = html(page);
    assert.match(source, /name="robots" content="noindex, nofollow"/);
    assert.match(source, /rel="canonical" href="https:\/\/staging\.agenticbible\.si\//);
    assert.equal(attrs(source, 'id').length, new Set(attrs(source, 'id')).size, `${page}: duplicate ids`);
    for (const script of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      assert.match(script[1], /src="\/_astro\//, `${page}: script must be a local file`);
      assert.equal(script[2].trim(), '', `${page}: inline script violates CSP`);
    }
    assert.doesNotMatch(source, /<iframe|<form[^>]+action="https?:|<script[^>]+src="https?:/);
  }
  assert.match(html('dist/robots.txt'), /Disallow: \//);
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
