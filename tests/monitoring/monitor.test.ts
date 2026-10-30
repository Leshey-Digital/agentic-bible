import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SqliteD1 } from '../editorial/sqlite.ts';
import { validateCatalog, sourceId, catalogSourceLimit } from '../../src/monitoring/catalog.ts';
import { MonitorStore } from '../../src/monitoring/store.ts';
import { runJob, runDue, scheduleChecks } from '../../src/monitoring/runner.ts';
import { fixtureTransport } from '../../src/monitoring/fixtures.ts';
import { publishQueued } from '../../src/monitoring/publication.ts';
import { limits, type FixtureTransport, type Scenario } from '../../src/monitoring/contracts.ts';

const catalog=await validateCatalog(JSON.parse(readFileSync('dist/source-catalog.json','utf8')));
const source=catalog.sources.find(source=>source.articleIds.length===1)!;
const start=1_792_168_000_000;
async function setup(path=':memory:',initialize=true) {
  const db=new SqliteD1(path,initialize);
  if(initialize)db.raw.exec(readFileSync('migrations/0002_source_monitoring.sql','utf8'));
  const store=new MonitorStore(db);await store.seed(catalog);return {db,store};
}
async function job(store:MonitorStore,scenario:Scenario,time=start) {return store.enqueue(source.id,scenario,crypto.randomUUID(),time);}
async function changed(store:MonitorStore,time=start) {
  await runJob(store,catalog,(await job(store,'baseline',time)).id,fixtureTransport,()=>time);
  await runJob(store,catalog,(await job(store,'change',time+1)).id,fixtureTransport,()=>time+1);
  return (await store.candidates())[0];
}

test('catalog comes from all twenty article metadata sets and rejects external/private/credential URLs',async()=>{
  assert.equal(catalog.articles.length,20);assert.equal(catalog.sources.length,50);
  const shared=catalog.sources.find(source=>source.url==='https://arxiv.org/abs/2210.03629v3');
  assert.ok(shared?.articleIds.includes('ai-agent'));assert.ok(shared?.articleIds.includes('agent-orchestration'));
  for(const url of ['http://127.0.0.1/','https://evil.invalid/','https://user:secret@www.anthropic.com/','https://www.anthropic.com:444/']) {
    const bad=structuredClone(catalog);bad.sources[0].url=url;await assert.rejects(validateCatalog(bad));
  }
});

test('metadata/local-fixture catalog enumerates all 64 bounded rows and refuses overflow without changing prior rows',async()=>{
  const {db,store}=await setup();const full=structuredClone(catalog);
  const synthetic=async(n:number)=>{const url=`https://docs.langchain.com/fixture-catalog/${n}`;return {id:await sourceId(url),url,title:'Supplied synthetic catalog capacity fixture',articleIds:['ai-agent']};};
  try{
    for(let n=0;full.sources.length<catalogSourceLimit;n++)full.sources.push(await synthetic(n));
    await validateCatalog(full);await store.seed(full);const before=await store.sources();assert.equal(before.length,catalogSourceLimit);assert.equal(new Set(before.map(s=>s.id)).size,catalogSourceLimit);
    const overflow={...full,sources:[...full.sources,await synthetic(100)]};await assert.rejects(validateCatalog(overflow));await assert.rejects(store.seed(overflow),{code:'catalog_capacity'});
    assert.deepEqual(await store.sources(),before);assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM monitor_sources').get()?.n,catalogSourceLimit);
  }finally{db.raw.close();}
});

test('baseline, conditional 304 and same hash never invent a change; changed source auto-publishes with a later review flag',async()=>{
  const {db,store}=await setup();let calls=0;
  const transport:FixtureTransport={mode:'fixture',fetch:async(url,options)=>{calls++;assert.equal(url,source.url);assert.equal(options.redirect,'manual');if(calls===2)assert.equal(options.headers.get('If-None-Match'),'"fixture-v1"');return fixtureTransport.fetch(url,options);}};
  await runJob(store,catalog,(await job(store,'baseline')).id,transport,()=>start);
  await runJob(store,catalog,(await job(store,'unchanged',start+1)).id,transport,()=>start+1);
  assert.equal((await store.candidates()).length,0);
  await runJob(store,catalog,(await job(store,'change',start+2)).id,transport,()=>start+2);
  const candidate=(await store.candidates())[0];assert.ok(candidate);assert.equal(candidate.state,'queued');
  const result=await publishQueued(store,catalog,start+3);assert.equal(result[0].state,'published');
  const published=(await store.candidate(candidate.id))!;assert.equal(published.reviewFlag,'flagged');
  assert.equal((await store.head(candidate.articleId))?.currentRevision,candidate.id);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM source_events').get()?.n,1);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM publication_revisions').get()?.n,1);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM monitor_reservations').get()?.n,3);
  assert.equal(await store.publish(candidate,start+4),false,'publication replay cannot add another revision');
  assert.equal(JSON.stringify(db.raw.prepare('SELECT * FROM source_events').all()).includes('Synthetic fixture version'),false,'source bodies are not stored');
  db.raw.close();
});

test('replayed job key, duplicate completion and repeated source hash do not duplicate events/candidates',async()=>{
  const {db,store}=await setup();const first=await changed(store);const original=(await store.jobs()).find(job=>job.scenario==='change')!;
  const count=(await store.candidates()).length;
  assert.equal((await runJob(store,catalog,original.id,fixtureTransport,()=>start+2)).dispatched,false);
  await runJob(store,catalog,(await job(store,'change',start+3)).id,fixtureTransport,()=>start+3);
  assert.equal((await store.candidates()).length,count);
  assert.equal((await store.candidate(first.id))?.state,'queued');
  const once=await store.enqueue(source.id,'unchanged','same-schedule-key',start+4);
  assert.equal((await store.enqueue(source.id,'unchanged','same-schedule-key',start+4)).id,once.id);
  await assert.rejects(store.enqueue(source.id,'change','same-schedule-key',start+4));db.raw.close();
});

test('temporary errors retry with backoff and stop after three; timeout aborts even an uncooperative transport',async()=>{
  const {db,store}=await setup();const transient=await job(store,'transient');
  await runJob(store,catalog,transient.id,fixtureTransport,()=>start);assert.equal((await store.job(transient.id))?.state,'retry');
  assert.equal((await store.job(transient.id))?.dueAt,start+1000);
  assert.equal((await runJob(store,catalog,transient.id,fixtureTransport,()=>start+999)).dispatched,false);
  await runJob(store,catalog,transient.id,fixtureTransport,()=>start+1000);
  await runJob(store,catalog,transient.id,fixtureTransport,()=>start+3000);
  assert.equal((await store.job(transient.id))?.state,'succeeded');assert.equal((await store.job(transient.id))?.attempts,3);
  const timeout=await job(store,'timeout',start+4000);
  for(const time of [start+4000,start+5000,start+7000])await runJob(store,catalog,timeout.id,fixtureTransport,()=>time,10);
  assert.equal((await store.job(timeout.id))?.state,'dead');assert.equal((await store.job(timeout.id))?.error,'timeout');
  db.raw.close();
});

test('missing baseline, malformed payloads, redirected/private destinations and overlarge streams fail explicitly with no source event',async()=>{
  const {db,store}=await setup();let calls=0;
  for(const scenario of ['not-modified','malformed','redirect'] as const) {
    const entry=await job(store,scenario);
    await runJob(store,catalog,entry.id,{mode:'fixture',fetch:async(url,options)=>{calls++;return fixtureTransport.fetch(url,options);}},()=>start);
    assert.equal((await store.job(entry.id))?.state,'dead');
  }
  assert.equal(calls,3,'redirect destination is never followed');
  const oversized=await job(store,'baseline');
  await runJob(store,catalog,oversized.id,{mode:'fixture',fetch:async()=>new Response('x'.repeat(limits.responseBytes+1),{headers:{'Content-Type':'text/plain'}})},()=>start);
  assert.equal((await store.job(oversized.id))?.error,'payload_too_large');
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM source_events').get()?.n,0);
  const unsafe=await job(store,'baseline');await db.prepare('UPDATE monitor_sources SET url=? WHERE id=?').bind('http://127.0.0.1/private',source.id).run();
  await runJob(store,catalog,unsafe.id,{mode:'fixture',fetch:async()=>{throw new Error('must not be called');}},()=>start);
  assert.equal((await store.job(unsafe.id))?.error,'source_not_allowlisted');
  await assert.rejects(runJob(store,catalog,unsafe.id,{...fixtureTransport,mode:'live'} as unknown as FixtureTransport,()=>start));db.raw.close();
});

test('daily reservations stop dispatch before HTTP and allow bounded resumption the next day',async()=>{
  const {db,store}=await setup();let calls=0;const transport:FixtureTransport={mode:'fixture',fetch:async(url,options)=>{calls++;return fixtureTransport.fetch(url,options);}};
  for(let index=0;index<20;index++)await runJob(store,catalog,(await job(store,'baseline',start+index)).id,transport,()=>start+index);
  const blocked=await job(store,'change',start+30);await runJob(store,catalog,blocked.id,transport,()=>start+30);
  assert.equal(calls,20);assert.equal((await store.job(blocked.id))?.state,'budget_blocked');assert.equal((await store.job(blocked.id))?.attempts,0);
  const tomorrow=(Math.floor(start/86_400_000)+1)*86_400_000;
  await runJob(store,catalog,blocked.id,transport,()=>tomorrow);assert.equal(calls,21);assert.equal((await store.job(blocked.id))?.state,'succeeded');db.raw.close();
});

test('expired workers cannot commit; interrupted reservations are counted and a third interruption becomes terminal',async()=>{
  const {db,store}=await setup();const entry=await job(store,'baseline');
  const old=(await store.claim(entry.id,start))!;
  assert.equal(await store.claim(entry.id,start+1),null);
  const newer=(await store.claim(entry.id,start+limits.leaseMs))!;assert.equal(newer.job.attempts,2);
  assert.equal(await store.complete(old,{kind:'baseline',hash:'a'.repeat(64),etag:null,lastModified:null,bytes:1},start+limits.leaseMs+1),false);
  const third=(await store.claim(entry.id,start+2*limits.leaseMs))!;assert.equal(third.job.attempts,3);
  await runDue(store,catalog,fixtureTransport,()=>start+3*limits.leaseMs);
  assert.equal((await store.job(entry.id))?.state,'dead');
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM monitor_reservations WHERE outcome='abandoned'").get()?.n,3);db.raw.close();
});

test('missing evidence and malformed candidates are blocked without publishing or human-preapproval states',async()=>{
  for(const kind of ['evidence','malformed']) {
    const {db,store}=await setup();const candidate=await changed(store);const payload=JSON.parse(candidate.payload);
    if(kind==='evidence')payload.evidence=[];else payload.kind='arbitrary-article-html';
    await db.prepare('UPDATE publication_candidates SET payload=? WHERE id=?').bind(JSON.stringify(payload),candidate.id).run();
    await publishQueued(store,catalog,start+2);
    assert.equal((await store.candidate(candidate.id))?.state,kind==='evidence'?'blocked_evidence':'blocked_malformed');
    assert.equal((await store.head(candidate.articleId))?.currentRevision,null);
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM publication_revisions').get()?.n,0);db.raw.close();
  }
});

test('automatic local revisions support idempotent review flags, revert and restore with optimistic versions',async()=>{
  const {db,store}=await setup();const candidate=await changed(store);await publishQueued(store,catalog,start+2);
  let current=(await store.candidate(candidate.id))!;let head=(await store.head(candidate.articleId))!;
  const key=crypto.randomUUID();assert.equal(await store.transition(candidate.id,'clear-flag',head.version,current.version,key,'local-editor',start+3),true);
  assert.equal(await store.transition(candidate.id,'clear-flag',head.version,current.version,key,'local-editor',start+4),true);
  current=(await store.candidate(candidate.id))!;head=(await store.head(candidate.articleId))!;assert.equal(current.reviewFlag,'cleared');
  assert.equal(await store.transition(candidate.id,'revert',head.version,current.version,crypto.randomUUID(),'local-editor',start+5),true);
  assert.equal((await store.head(candidate.articleId))?.currentRevision,null);
  current=(await store.candidate(candidate.id))!;head=(await store.head(candidate.articleId))!;
  assert.equal(await store.transition(candidate.id,'restore',head.version-1,current.version,crypto.randomUUID(),'local-editor',start+6),false);
  assert.equal(await store.transition(candidate.id,'restore',head.version,current.version,crypto.randomUUID(),'local-editor',start+7),true);
  assert.equal((await store.head(candidate.articleId))?.currentRevision,candidate.id);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM publication_actions').get()?.n,4);db.raw.close();
});

test('hourly planner is bounded and deduplicated, and persisted work survives database reopen',async()=>{
  const dir=mkdtempSync('.git/monitor-restart-');const path=join(dir,'fixture.sqlite');let {db,store}=await setup(path);
  try {
    assert.equal((await scheduleChecks(store,catalog,start)).length,4);
    assert.equal((await scheduleChecks(store,catalog,start)).length,4);
    let scheduled=8;
    while(true){const batch=await scheduleChecks(store,catalog,start);assert.ok(batch.length<=4);if(!batch.length)break;scheduled+=batch.length;}
    assert.equal(scheduled,catalog.sources.length);assert.equal((await scheduleChecks(store,catalog,start)).length,0);
    await runDue(store,catalog,fixtureTransport,()=>start);
    await runJob(store,catalog,(await job(store,'baseline',start+1)).id,fixtureTransport,()=>start+1);
    await runJob(store,catalog,(await job(store,'change',start+2)).id,fixtureTransport,()=>start+2);
    await publishQueued(store,catalog,start+3);const candidate=(await store.candidates())[0];assert.ok(candidate);
    const count=(await store.jobs()).length;
    db.raw.close();({db,store}=await setup(path,false));assert.equal((await store.jobs()).length,count);
    assert.equal((await store.candidate(candidate.id))?.state,'published');
    assert.equal((await store.candidate(candidate.id))?.reviewFlag,'flagged');
    assert.equal((await store.head(candidate.articleId))?.currentRevision,candidate.id);
    await runDue(store,catalog,fixtureTransport,()=>start+1);
    assert.equal((await store.sources()).filter(source=>source.hash).length,8);
  } finally {db.raw.close();rmSync(dir,{recursive:true,force:true});}
});

test('a 200 response with identical bytes is unchanged and Last-Modified is used when no ETag is stored',async()=>{
  const {db,store}=await setup();await runJob(store,catalog,(await job(store,'baseline')).id,fixtureTransport,()=>start);
  const original=await fixtureTransport.fetch(source.url,{headers:new Headers(),redirect:'manual',signal:new AbortController().signal,scenario:'baseline',attempt:1});
  const body=await original.text();const date='Thu, 01 Oct 2026 00:00:00 GMT';
  const unchanged=await job(store,'unchanged',start+1);
  await runJob(store,catalog,unchanged.id,{mode:'fixture',fetch:async()=>new Response(body,{headers:{'Content-Type':'text/plain','Last-Modified':date}})},()=>start+1);
  assert.equal((await store.job(unchanged.id))?.result,'unchanged');assert.equal((await store.source(source.id))?.version,1);
  const conditional=await job(store,'unchanged',start+2);
  await runJob(store,catalog,conditional.id,{mode:'fixture',fetch:async(_url,options)=>{assert.equal(options.headers.get('If-Modified-Since'),date);assert.equal(options.headers.get('If-None-Match'),null);return new Response(null,{status:304});}},()=>start+2);
  assert.equal((await store.job(conditional.id))?.result,'not-modified');assert.equal((await store.candidates()).length,0);db.raw.close();
});

test('malformed UTF-8, invalid validators and unsupported types stop without retaining source payloads or calling global fetch',async()=>{
  const {db,store}=await setup();const originalFetch=globalThis.fetch;let outside=0;
  globalThis.fetch=async()=>{outside++;throw new Error('outside HTTP is forbidden');};
  try {
    for(const [response,reason] of [
      [new Response(new Uint8Array([255]),{headers:{'Content-Type':'text/plain'}}),'malformed_payload'],
      [new Response('synthetic',{headers:{'Content-Type':'application/octet-stream'}}),'malformed_content_type'],
      [new Response('synthetic',{headers:{'Content-Type':'text/plain',ETag:'invalid-unquoted'}}),'malformed_validator'],
      [new Response('synthetic missing page',{status:404}),'http_404'],
    ] as const) {
      const entry=await job(store,'baseline');await runJob(store,catalog,entry.id,{mode:'fixture',fetch:async()=>response},()=>start);
      assert.equal((await store.job(entry.id))?.error,reason);assert.equal((await store.job(entry.id))?.state,'dead');
    }
    await runJob(store,catalog,(await job(store,'baseline')).id,fixtureTransport,()=>start);
    assert.equal(outside,0);
  } finally {globalThis.fetch=originalFetch;db.raw.close();}
});

test('a newer source revision supersedes an older queued candidate and clearing a historical review flag cannot move the head',async()=>{
  const {db,store}=await setup();const first=await changed(store);
  await runJob(store,catalog,(await job(store,'baseline',start+2)).id,fixtureTransport,()=>start+2);
  const second=(await store.candidates()).find(candidate=>candidate.id!==first.id)!;
  await store.publish(second,start+3);await publishQueued(store,catalog,start+4);
  assert.equal((await store.candidate(first.id))?.state,'superseded');
  assert.equal((await store.head(second.articleId))?.currentRevision,second.id);db.raw.close();
  const next=await setup();const older=await changed(next.store);await publishQueued(next.store,catalog,start+2);
  await runJob(next.store,catalog,(await job(next.store,'baseline',start+3)).id,fixtureTransport,()=>start+3);await publishQueued(next.store,catalog,start+4);
  const head=(await next.store.head(older.articleId))!;const olderNow=(await next.store.candidate(older.id))!;
  assert.notEqual(head.currentRevision,older.id);
  assert.equal(await next.store.transition(older.id,'clear-flag',head.version,olderNow.version,crypto.randomUUID(),'local-editor',start+5),true);
  assert.deepEqual(await next.store.head(older.articleId),head);next.db.raw.close();
});

test('an audit failure rolls back automatic publication and leaves a retryable queued candidate',async()=>{
  const {db,store}=await setup();
  await runJob(store,catalog,(await job(store,'baseline')).id,fixtureTransport,()=>start);
  const previousHash=(await store.source(source.id))!.hash;
  const change=await job(store,'change',start+1);
  db.raw.exec("CREATE TRIGGER synthetic_ingest_failure BEFORE INSERT ON publication_candidates BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  await runJob(store,catalog,change.id,fixtureTransport,()=>start+1);
  assert.equal((await store.job(change.id))?.error,'storage_failure');
  assert.equal((await store.source(source.id))?.hash,previousHash);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM source_events').get()?.n,0);
  db.raw.exec('DROP TRIGGER synthetic_ingest_failure');
  await runJob(store,catalog,change.id,fixtureTransport,()=>start+1001);
  const candidate=(await store.candidates())[0];assert.ok(candidate);
  db.raw.exec("CREATE TRIGGER synthetic_publication_failure BEFORE INSERT ON publication_actions BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  await assert.rejects(publishQueued(store,catalog,start+2));
  assert.equal((await store.candidate(candidate.id))?.state,'queued');assert.equal((await store.head(candidate.articleId))?.currentRevision,null);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM publication_revisions').get()?.n,0);
  db.raw.exec('DROP TRIGGER synthetic_publication_failure');await publishQueued(store,catalog,start+3);
  assert.equal((await store.candidate(candidate.id))?.state,'published');db.raw.close();
});

test('one shared source change produces one event and one automatic candidate/revision per affected article',async()=>{
  const {db,store}=await setup();const shared=catalog.sources.find(source=>source.articleIds.length>1)!;assert.ok(shared);
  for(const [index,scenario] of (['baseline','change'] as const).entries()) {
    const entry=await store.enqueue(shared.id,scenario,crypto.randomUUID(),start+index);
    await runJob(store,catalog,entry.id,fixtureTransport,()=>start+index);
  }
  const candidates=await store.candidates();assert.equal(candidates.length,shared.articleIds.length);
  assert.deepEqual(new Set(candidates.map(candidate=>candidate.articleId)),new Set(shared.articleIds));
  await publishQueued(store,catalog,start+2);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM source_events').get()?.n,1);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM publication_revisions').get()?.n,shared.articleIds.length);db.raw.close();
});
