import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SqliteD1 } from './sqlite.ts';
import { D1EditorialStore } from '../../src/editorial/store.ts';
import { submissionInput, changeInput, validateSource, readJson, InputError, RateLimitError, ReplayConflictError, CapacityError, digest } from '../../src/editorial/validation.ts';
import { localMode, localSession, currentSession, sameOrigin } from '../../src/editorial/auth.ts';
import worker from '../../src/editorial/worker.ts';
import type { EditorialEnv } from '../../src/editorial/contracts.ts';

const now = 1_792_168_000_000;
const input = (message = 'Synthetic correction: clarify the documented client tool boundary.') => submissionInput({
  requestKey: crypto.randomUUID(), articleId: 'tool-use', kind: 'correction', message, sourceUrl: 'https://example.org/reference', website: '',
});
const assets = { fetch: async () => new Response('static') };

test('server validation rejects executable input, private/credential URLs, wrong types and oversized streaming JSON', async () => {
  for (const source of ['http://example.org', 'https://127.0.0.1', 'https://[::1]/', 'https://2130706433/', 'https://foo.local/', 'https://foo.local./', 'https://user:pass@example.org/', 'https://example.org:444/', 'javascript:alert(1)']) assert.throws(() => validateSource(source));
  assert.equal(validateSource('https://example.org/path#fragment'), 'https://example.org/path#fragment');
  assert.throws(() => submissionInput({ ...input(), sourceUrl: {} }), InputError);
  assert.throws(() => submissionInput({ ...input(), articleId: '__proto__' }), InputError);
  assert.throws(() => submissionInput({ ...input(), message: '<script>alert("synthetic")</script>' }), InputError);
  assert.throws(() => submissionInput({ ...input(), message: 'short' }), InputError);
  assert.throws(() => submissionInput({ ...input(), kind: 'source', sourceUrl: '' }), InputError);
  assert.throws(() => changeInput({ status: 'published', tags: '', version: 1 }), InputError);
  assert.throws(() => changeInput({ status: 'resolved', tags: '<script>', version: 1 }), InputError);
  assert.throws(() => changeInput({ status: 'resolved', tags: [], version: true }), InputError);
  assert.deepEqual(changeInput({ status: 'follow-up', tags: 'Tools, Tools, Source context', version: 1 }).tags, ['Tools', 'Source context']);
  await assert.rejects(readJson(new Request('http://local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(9000) }) })), error => error instanceof InputError && error.status === 413);
  await assert.rejects(readJson(new Request('http://local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })), error => error instanceof InputError && error.status === 400);
});

test('local intake capacity fails closed without a partial submission or audit event', async () => {
  const db = new SqliteD1(); const store = new D1EditorialStore(db);
  db.raw.exec(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO submissions (id,request_key,fingerprint,article_id,kind,message,last_event_id,created_at,updated_at)
    SELECT 'synthetic-'||n,'request-'||n,'fingerprint-'||n,'ai-agent','correction','Synthetic capacity fixture with no real user data.','event-'||n,1,1 FROM seq;`);
  await assert.rejects(store.submit(input(), 'synthetic-client', now), CapacityError);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM submissions').get()?.count, 1000);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM editorial_audit').get()?.count, 0);
  db.raw.close();
});

test('D1 adapter persists, deduplicates retries/content and rejects request-key reuse with different content', async () => {
  const db = new SqliteD1(); const store = new D1EditorialStore(db); const first = input();
  const receipt = await store.submit(first, 'synthetic-client', now);
  assert.equal((await store.get(receipt.id))?.message, first.message);
  assert.deepEqual(await store.submit(first, 'synthetic-client', now), { id: receipt.id, duplicate: true });
  assert.equal((await store.submit({ ...first, requestKey: crypto.randomUUID() }, 'synthetic-client', now)).id, receipt.id);
  await assert.rejects(store.submit({ ...first, message: 'A materially different synthetic correction with a reused key.' }, 'synthetic-client', now), ReplayConflictError);
  assert.equal((await store.list('new')).items.length, 1);
  assert.equal((await store.audit(receipt.id)).length, 1);
  db.raw.close();
});

test('atomic rate windows accept five new suggestions, stop the sixth and reset after ten minutes', async () => {
  const db = new SqliteD1(); const store = new D1EditorialStore(db);
  for (let index = 0; index < 5; index++) await store.submit(input(`Synthetic distinct suggestion number ${index}, with evidence context.`), 'same-client', now);
  await assert.rejects(store.submit(input('Sixth synthetic suggestion should hit the local rate boundary.'), 'same-client', now), RateLimitError);
  assert.equal((await store.list('new')).items.length, 5);
  await store.submit(input('The next window permits another synthetic suggestion safely.'), 'same-client', now + 600_000);
  assert.equal((await store.list('new')).items.length, 6);
  db.raw.close();
});

test('review update and audit commit together; stale writes cannot overwrite or add phantom events', async () => {
  const db = new SqliteD1(); const store = new D1EditorialStore(db);
  const { id } = await store.submit(input(), 'synthetic-client', now);
  assert.equal(await store.update(id, { status: 'follow-up', tags: ['Source context'], version: 1 }, 'local-editor', now + 1), true);
  assert.equal(await store.update(id, { status: 'dismissed', tags: [], version: 1 }, 'local-editor', now + 2), false);
  assert.equal((await store.get(id))?.status, 'follow-up');
  assert.equal((await store.audit(id)).length, 2);
  // Deliberately break audit insertion: the item update must roll back too.
  db.raw.exec("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON editorial_audit BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
  await assert.rejects(store.update(id, { status: 'resolved', tags: [], version: 2 }, 'local-editor', now + 3));
  assert.equal((await store.get(id))?.version, 2);
  assert.equal((await store.get(id))?.status, 'follow-up');
  db.raw.close();
});

test('bounded pagination is stable and local records survive closing and reopening SQLite', async () => {
  const dir = mkdtempSync('.git/editorial-unit-'); const path = join(dir, 'synthetic.sqlite');
  let db = new SqliteD1(path); let store = new D1EditorialStore(db);
  try {
    for (let index = 0; index < 23; index++) await store.submit(input(`Synthetic pagination record ${index} with sufficient evidence context.`), `synthetic-client-${index}`, now + index);
    const page = await store.list('new'); assert.equal(page.items.length, 20); assert.ok(page.next);
    const next = await store.list('new', page.next!); assert.equal(next.items.length, 3); assert.equal(next.next, null);
    assert.equal(new Set([...page.items, ...next.items].map(item => item.id)).size, 23);
    db.raw.close(); db = new SqliteD1(path, false); store = new D1EditorialStore(db);
    assert.equal((await store.list('new')).items.length, 20);
  } finally { db.raw.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('local sessions are hashed, role-scoped, expire and are revoked on sign-out', async () => {
  const db = new SqliteD1(); const store = new D1EditorialStore(db);
  const created = await localSession('local-editor', store); assert.ok(created);
  const cookie = created.cookie.split(';')[0]; const request = new Request('http://127.0.0.1:8788/admin/', { headers: { Cookie: cookie } });
  assert.equal((await currentSession(request, store))?.role, 'admin');
  assert.match(created.cookie, /HttpOnly; SameSite=Strict/);
  assert.equal(await currentSession(request, store, Date.now() + 1_200_001), null);
  await store.removeSession(created.session.tokenHash);
  assert.equal(await currentSession(request, store), null);
  assert.equal(await localSession('browser-claimed-admin', store), null);
  assert.equal(await currentSession(new Request(request.url, { headers: { Cookie: 'ab_local_editorial=' + 'f'.repeat(64) } }), store), null);
  db.raw.close();
});

test('all remote/unconfigured admin and API paths fail closed even with fixture flags and forged roles', async () => {
  const db = new SqliteD1(); const env: EditorialEnv = { EDITORIAL_DB: db, ASSETS: assets, LOCAL_EDITORIAL_MODE: 'synthetic-only' };
  for (const path of ['/admin/', '/admin/sign-in/', '/api/admin/submissions', '/api/submissions']) {
    const response = await worker.fetch(new Request(`https://staging.agenticbible.si${path}`, { headers: { 'X-Role': 'admin', 'X-Local-Test-Identity': 'local-editor' } }), env);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(localMode(new Request('http://localhost:8788/'), env), false, 'only the fixed loopback origin is enabled');
  assert.equal(sameOrigin(new Request('http://127.0.0.1:8788/', { headers: { Origin: 'https://attacker.invalid' } })), false);
  const anonymous = await worker.fetch(new Request('http://127.0.0.1:8788/api/admin/submissions'), env);
  assert.equal(anonymous.status, 401);
  const reader = await localSession('local-reader', new D1EditorialStore(db)); assert.ok(reader);
  const denied = await worker.fetch(new Request('http://127.0.0.1:8788/api/admin/submissions', { headers: { Cookie: reader.cookie.split(';')[0] } }), env);
  assert.equal(denied.status, 403);
  const missing = await worker.fetch(new Request('http://127.0.0.1:8788/api/submissions', { method: 'POST', headers: { Origin: 'http://127.0.0.1:8788' }, body: '{}' }), { ...env, EDITORIAL_DB: undefined });
  assert.equal(missing.status, 503);
  db.raw.close();
});

test('cross-origin writes, missing CSRF and HTML payloads cannot mutate or leak data', async () => {
  const db = new SqliteD1(); const env: EditorialEnv = { EDITORIAL_DB: db, ASSETS: assets, LOCAL_EDITORIAL_MODE: 'synthetic-only' };
  const store = new D1EditorialStore(db); const receipt = await store.submit(input(), await digest('synthetic'), now);
  const session = await localSession('local-editor', store); assert.ok(session);
  const url = `http://127.0.0.1:8788/api/admin/submissions/${receipt.id}`;
  const request = (origin: string, csrf?: string) => new Request(url, { method: 'PATCH', headers: { Origin: origin, Cookie: session.cookie.split(';')[0], 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, body: JSON.stringify({ status: 'resolved', tags: '', version: 1 }) });
  assert.equal((await worker.fetch(request('https://attacker.invalid', session.session.csrf), env)).status, 403);
  assert.equal((await worker.fetch(request('http://127.0.0.1:8788'), env)).status, 403);
  assert.equal((await store.get(receipt.id))?.version, 1);
  assert.equal((await worker.fetch(request('http://127.0.0.1:8788', session.session.csrf), env)).status, 200);
  assert.equal((await worker.fetch(request('http://127.0.0.1:8788', session.session.csrf), env)).status, 409);
  db.raw.close();
});
