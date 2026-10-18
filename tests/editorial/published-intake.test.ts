import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { articleIds } from '../../src/editorial/contracts.ts';
import { readingArticleIds } from '../../src/lib/article-ids.ts';
import { submissionInput, InputError } from '../../src/editorial/validation.ts';
import { buildCatalog, validateCatalog } from '../../src/monitoring/catalog.ts';
import { SqliteD1 } from './sqlite.ts';
import { D1EditorialStore } from '../../src/editorial/store.ts';
import worker from '../../src/editorial/worker.ts';

const origin = 'http://127.0.0.1:8788';
const suggestion = (articleId: string) => ({ requestKey: crypto.randomUUID(), articleId, kind: 'correction', message: `Synthetic correction for ${articleId}: clarify the cited execution boundary.`, sourceUrl: '', website: '' });
const post = (body: unknown, index = 0, requestOrigin = origin) => new Request(origin + '/api/submissions', { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${index + 1}` }, body: JSON.stringify(body) });

test('intake shares the complete canonical inventory, rather than a second article list', () => {
  assert.equal(articleIds, readingArticleIds);
  assert.equal(articleIds.length, 20);
  assert.deepEqual([...articleIds].sort(), readdirSync('src/content/articles').map(name => name.replace(/\.md$/, '')).sort());
  for (const articleId of articleIds) assert.equal(submissionInput(suggestion(articleId)).articleId, articleId);
  for (const articleId of ['unpublished-draft', 'synthetic-new-article', 'unknown', '__proto__', 'tool-use/../unknown']) {
    assert.throws(() => submissionInput(suggestion(articleId)), error => error instanceof InputError && !!error.fields.articleId);
  }
});

test('missing, duplicate, unknown and malformed source catalogs cannot expand the compiled published inventory', async () => {
  const articles = articleIds.map(id => ({ id, data: { title: id, sources: [{ title: 'Synthetic primary source', url: 'https://www.anthropic.com/engineering/building-effective-agents' }] } }));
  const catalog = await buildCatalog(articles);
  assert.deepEqual(catalog.articles.map(article => article.id), [...articleIds]);
  for (const value of [null, {}, { ...catalog, version: 2 }, { ...catalog, articles: catalog.articles.slice(0, 3) }, { ...catalog, articles: [...catalog.articles, { id: 'unpublished-draft', title: 'Unpublished' }] }, { ...catalog, articles: catalog.articles.map((article, index) => index === 19 ? catalog.articles[0] : article) }, { ...catalog, articles: catalog.articles.map((article, index) => index === 19 ? { id: 'unpublished-draft', title: 'Unpublished' } : article) }]) {
    await assert.rejects(validateCatalog(value));
  }
});

test('all twenty articles enter the same reviewed inbox with unchanged replay, moderation and fail-closed protections', async () => {
  const db = new SqliteD1();
  db.raw.exec(readFileSync('migrations/0007_reviewed_corrections.sql', 'utf8'));
  db.raw.exec('BEGIN;'+readFileSync('migrations/0017_published_contribution_intake.sql', 'utf8')+'COMMIT;');
  let assetReads = 0;
  const env = { EDITORIAL_DB: db, LOCAL_EDITORIAL_MODE: 'synthetic-only', PUBLISHED_ARTICLE_IDS: ['unpublished-draft'], ASSETS: { fetch: async () => { assetReads++; return Response.json({ version: 1, articles: [{ id: 'unpublished-draft', title: 'Forged asset authority' }] }); } } };
  const store = new D1EditorialStore(db);
  try {
    for (const [index, articleId] of articleIds.entries()) {
      const body = suggestion(articleId);
      const saved = await worker.fetch(post(body, index), env);
      assert.equal(saved.status, 201, articleId);
      const { reference } = await saved.json() as { reference: string };
      assert.equal((await store.get(reference))?.articleId, articleId);
      assert.equal((await store.get(reference))?.status, 'new');
      assert.deepEqual((await store.get(reference))?.tags, []);
      assert.equal((await worker.fetch(post(body, index), env)).status, 200);
      assert.equal((await worker.fetch(post({ ...body, message: body.message + ' A conflicting draft.' }, index), env)).status, 409);
      assert.equal((await store.audit(reference)).length, 1);
      assert.equal(await store.update(reference, { status: 'follow-up', tags: ['Evidence context'], version: 1 }, 'local-editor', Date.now()), true);
      assert.equal(await store.update(reference, { status: 'dismissed', tags: [], version: 1 }, 'local-editor', Date.now()), false);
      assert.equal((await store.get(reference))?.status, 'follow-up');
      assert.equal((await store.audit(reference)).length, 2);
    }
    const count = () => db.raw.prepare('SELECT COUNT(*) AS n FROM submissions').get()?.n;
    assert.equal(count(), 20);
    await assert.rejects(store.submit({ ...suggestion('unpublished-draft'), kind: 'correction' } as ReturnType<typeof submissionInput>, 'synthetic-direct', Date.now()), InputError);
    for (const articleId of ['unknown', 'unpublished-draft', 'synthetic-new-article']) assert.equal((await worker.fetch(post({ ...suggestion(articleId), articleIds: [articleId], catalog: { articles: [{ id: articleId }] } }), env)).status, 422);
    assert.equal((await worker.fetch(post(suggestion('agent-budgets'), 30, 'https://attacker.invalid'), env)).status, 403);
    assert.equal((await worker.fetch(post({ ...suggestion('agent-budgets'), website: 'synthetic-bot' }, 30), env)).status, 202);
    assert.equal((await worker.fetch(post({ ...suggestion('agent-budgets'), requestKey: 'invalid' }, 30), env)).status, 422);
    assert.equal((await worker.fetch(post({ ...suggestion('agent-budgets'), message: '<script>synthetic executable input</script>' }, 30), env)).status, 422);
    assert.equal((await worker.fetch(post({ ...suggestion('agent-budgets'), padding: 'x'.repeat(9000) }, 30), env)).status, 413);
    assert.equal((await worker.fetch(new Request('https://staging.agenticbible.si/api/submissions', { method: 'POST', headers: { Origin: 'https://staging.agenticbible.si', 'Content-Type': 'application/json' }, body: JSON.stringify(suggestion('agent-budgets')) }), env)).status, 503);
    assert.equal(count(), 20);
    assert.equal(assetReads, 0, 'Submission authority never comes from an asset response.');
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM submissions WHERE status='follow-up'").get()?.n, 20);
  } finally { db.raw.close(); }
});
