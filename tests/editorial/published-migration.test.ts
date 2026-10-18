import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { articleIds } from '../../src/editorial/contracts.ts';

const origin = 'http://127.0.0.1:8788';
const sql = (file: string) => readFileSync('migrations/' + file, 'utf8').replace(/--[^\n]*/g, '').split(';').map(part => part.trim()).filter(Boolean);

test('actual Worker/D1 upgrades populated intake atomically, retains foreign keys through rollback/restart and admits all twenty canonical articles', { timeout: 60000 }, async () => {
  const state = mkdtempSync(resolve('.git/published-intake-worker-'));
  const script = (await build({ entryPoints: ['src/editorial/worker.ts'], bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022' })).outputFiles[0].text;
  let runtime!: Miniflare;
  let db: Awaited<ReturnType<Miniflare['getD1Database']>>;
  let outbound = 0;
  const start = async () => {
    runtime = new Miniflare({ ...convertV4MiniflareOptions({ name: 'published-intake', modules: true, script, compatibilityDate: '2026-10-16', bindings: { LOCAL_EDITORIAL_MODE: 'synthetic-only' }, d1Databases: { EDITORIAL_DB: 'published-intake' }, serviceBindings: { ASSETS: () => Response.json({ articles: [{ id: 'unpublished-draft' }] }) }, outboundService() { outbound++; throw Error('External fetch forbidden'); } }), cf: false, resourcePersistencePath: state });
    db = await runtime.getD1Database('EDITORIAL_DB');
  };
  const body = (articleId: string) => ({ articleId, requestKey: crypto.randomUUID(), kind: 'correction', message: `Synthetic native intake for ${articleId}: preserve evidence and review.`, sourceUrl: '', website: '' });
  const submit = (value: ReturnType<typeof body>, index: number) => runtime.dispatchFetch(origin + '/api/submissions', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${index + 1}` }, body: JSON.stringify(value) });
  const rows = async () => Object.fromEntries(await Promise.all(['submissions', 'editorial_audit', 'correction_operations', 'rate_windows', 'local_sessions'].map(async table => [table, (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])));
  await start();
  try {
    for (const file of ['0001_editorial.sql', '0007_reviewed_corrections.sql']) await db.batch(sql(file).map(statement => db.prepare(statement)));
    const original = body('tool-use');
    const response = await submit(original, 25); assert.equal(response.status, 201);
    const { reference } = await response.json() as { reference: string };
    await db.prepare("INSERT INTO correction_operations (id,fingerprint,submission_id,submission_version,reviewer,kind,command_json,state,created_at) VALUES(?,?,?,1,'local-editor','apply','{}','approved',1)").bind(crypto.randomUUID(), 'synthetic-fingerprint', reference).run();
    await db.prepare("INSERT INTO local_sessions VALUES('synthetic-token','local-editor','admin','synthetic-csrf',9999999999999)").run();
    const before = await rows();
    assert.equal((await submit(body('agent-budgets'), 26)).status, 503, 'Reproduce the legacy three-ID storage restriction.');
    const migration = sql('0017_published_contribution_intake.sql');
    await assert.rejects(db.batch([...migration.map(statement => db.prepare(statement)), db.prepare("INSERT INTO local_sessions VALUES('synthetic-token','local-editor','admin','synthetic-csrf',9999999999999)")]));
    assert.deepEqual(await rows(), before, 'A runtime uniqueness failure after the replacement rolls every dependent row back.');
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('submissions_published','intake_audit_backup','intake_corrections_backup')").first())?.n, 0);
    assert.equal((await submit(body('agent-budgets'), 26)).status, 503);
    await db.batch(migration.map(statement => db.prepare(statement)));
    assert.deepEqual(await rows(), before);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
    assert.equal((await db.prepare('PRAGMA foreign_key_list(editorial_audit)').all()).results[0].table, 'submissions');
    assert.equal((await db.prepare('PRAGMA foreign_key_list(correction_operations)').all()).results[0].table, 'submissions');
    await assert.rejects(db.prepare('DELETE FROM submissions WHERE id=?').bind(reference).run(), 'Dependent foreign keys stay enforced.');
    for (const [requestKey, fingerprint] of [[original.requestKey, 'synthetic-new-fingerprint'], [crypto.randomUUID(), String((before.submissions[0] as { fingerprint: string }).fingerprint)]]) await assert.rejects(db.prepare("INSERT INTO submissions SELECT id||'-copy',?,?,article_id,kind,message,source_url,status,tags,version,last_event_id,created_at,updated_at FROM submissions WHERE id=?").bind(requestKey, fingerprint, reference).run(), 'Each uniqueness constraint remains enforced.');
    await runtime.dispose(); await start();
    assert.deepEqual(await rows(), before);
    assert.equal((await submit(original, 25)).status, 200);
    for (const [index, articleId] of articleIds.entries()) {
      const value = body(articleId);
      const saved = await submit(value, index); assert.equal(saved.status, 201, articleId);
      assert.equal((await submit(value, index)).status, 200);
    }
    assert.equal((await submit(body('unpublished-draft'), 29)).status, 422);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM submissions').first())?.n, 21);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM editorial_audit').first())?.n, 21);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
    for (let index = 0; index < 5; index++) { const value = body('agent-budgets'); value.message += ` Distinct rate fixture ${index}.`; assert.equal((await submit(value, 35)).status, 201); }
    const sixth = body('agent-budgets'); sixth.message += ' Distinct sixth rate fixture.';
    assert.equal((await submit(sixth, 35)).status, 429);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM submissions').first())?.n, 26);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM editorial_audit').first())?.n, 26);
    assert.equal(outbound, 0);
  } finally { await runtime.dispose(); rmSync(state, { recursive: true, force: true }); }
});
