import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {enqueueIndexing,deliverIndexing,retryIndexing,disabledIndexing} from '../../src/seo/outbox.ts';
import {readingArticleIds} from '../../src/lib/article-ids.ts';
const config={enabled:true,provider:'indexnow',origin:'https://agenticbible.si',ownershipVerified:true};
const manifest={schemaVersion:1,mode:'canonical',origin:config.origin,entries:[{articleId:'tool-use',url:config.origin+'/articles/tool-use/',revision:'a'.repeat(64)}]};
test('disabled or unconfigured indexing has no SQL effects or provider calls',async()=>{
  const db={prepare(){throw Error('SQL forbidden');},batch(){throw Error('SQL forbidden');}};
  for(const settings of [undefined,disabledIndexing,{...config,provider:'google'},{...config,ownershipVerified:false},{...config,origin:'https://staging.agenticbible.si'}]){
    const queued=await enqueueIndexing(db,manifest,'disabled-test',settings);assert.notEqual(queued.status,'queued');assert.notEqual((await deliverIndexing(db,'a'.repeat(64),settings)).status,'acknowledged');
  }
  assert.equal((await deliverIndexing(db,'a'.repeat(64),config)).status,'provider-not-configured');
  assert.equal((await deliverIndexing(db,'a'.repeat(64),config,{id:'indexnow',origin:'https://other.example',ownershipVerified:true,supports:'canonical-article-updates',notify(){throw Error('forbidden');}})).status,'provider-not-configured');
});
test('eight-article events preserve the 96-notification cap atomically under concurrency and restart',{timeout:60000},async()=>{
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),path=join(git,'seo-eight-article-test');rmSync(path,{recursive:true,force:true});let runtime,db;
  async function start(){runtime=new Miniflare({...convertV4MiniflareOptions({name:'seo-eight-article-test',modules:true,script:'export default {fetch(){return new Response("local test")}}',compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'seo-eight-article-test'},outboundService(){throw Error('external fetch forbidden');}}),cf:false,resourcePersistencePath:path});db=await runtime.getD1Database('EDITORIAL_DB');}
  const expanded={...manifest,entries:readingArticleIds.slice(0,8).map(articleId=>({articleId,url:config.origin+`/articles/${articleId}/`,revision:'b'.repeat(64)}))};
  const rows=async()=>({receipts:(await db.prepare('SELECT * FROM indexing_enqueue_receipts ORDER BY event_key').all()).results,notifications:(await db.prepare('SELECT * FROM indexing_notifications ORDER BY id').all()).results});
  await start();try{
    for(const sql of readFileSync('migrations/0006_indexing_outbox.sql','utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
    const first=await enqueueIndexing(db,expanded,'eight-article-first',config);assert.equal(first.ids.length,8);
    for(let n=1;n<11;n++)await enqueueIndexing(db,expanded,'eight-article-release-'+n,config);
    const raced=await Promise.allSettled(['eight-article-race-one','eight-article-race-two'].map(key=>enqueueIndexing(db,expanded,key,config)));
    assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.find(r=>r.status==='rejected').reason.code,'indexing_capacity');
    const snapshot=await rows();assert.equal(snapshot.receipts.length,12);assert.equal(snapshot.notifications.length,96);for(const row of snapshot.receipts)assert.equal(JSON.parse(row.receipt).ids.length,8);
    await assert.rejects(enqueueIndexing(db,expanded,'eight-article-over-cap',config),{code:'indexing_capacity'});assert.deepEqual(await rows(),snapshot);assert.deepEqual(await enqueueIndexing(db,expanded,'eight-article-first',config),first);
    await runtime.dispose();await start();assert.deepEqual(await rows(),snapshot);assert.deepEqual(await enqueueIndexing(db,expanded,'eight-article-first',config),first);
  }finally{await runtime.dispose();}
});
test('fourteen-article manifests preserve capacity with partial room, concurrent admission and restart',{timeout:60000},async()=>{
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),path=join(git,'seo-fourteen-article-test');rmSync(path,{recursive:true,force:true});let runtime,db;
  async function start(){runtime=new Miniflare({...convertV4MiniflareOptions({name:'seo-fourteen-article-test',modules:true,script:'export default {fetch(){return new Response("local test")}}',compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'seo-fourteen-article-test'},outboundService(){throw Error('external fetch forbidden');}}),cf:false,resourcePersistencePath:path});db=await runtime.getD1Database('EDITORIAL_DB');}
  const expanded={...manifest,entries:readingArticleIds.slice(0,14).map(articleId=>({articleId,url:config.origin+`/articles/${articleId}/`,revision:'c'.repeat(64)}))};
  const rows=async()=>({receipts:(await db.prepare('SELECT * FROM indexing_enqueue_receipts ORDER BY event_key').all()).results,notifications:(await db.prepare('SELECT * FROM indexing_notifications ORDER BY id').all()).results});
  await start();try{
    for(const sql of readFileSync('migrations/0006_indexing_outbox.sql','utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
    const first=await enqueueIndexing(db,expanded,'fourteen-first',config);assert.equal(first.ids.length,14);
    for(let n=1;n<5;n++)await enqueueIndexing(db,expanded,'fourteen-release-'+n,config);
    const raced=await Promise.allSettled(['fourteen-race-one','fourteen-race-two'].map(key=>enqueueIndexing(db,expanded,key,config)));assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.find(r=>r.status==='rejected').reason.code,'indexing_capacity');
    const before=await rows();assert.equal(before.receipts.length,6);assert.equal(before.notifications.length,84);
    await assert.rejects(enqueueIndexing(db,expanded,'fourteen-no-room',config),{code:'indexing_capacity'});assert.deepEqual(await rows(),before);
    const remainder={...expanded,entries:expanded.entries.slice(0,12)},last=await enqueueIndexing(db,remainder,'fourteen-fill-remainder',config);assert.equal(last.ids.length,12);const snapshot=await rows();assert.equal(snapshot.notifications.length,96);
    await assert.rejects(enqueueIndexing(db,manifest,'fourteen-full',config),{code:'indexing_capacity'});assert.deepEqual(await rows(),snapshot);
    await runtime.dispose();await start();assert.deepEqual(await rows(),snapshot);assert.deepEqual(await enqueueIndexing(db,expanded,'fourteen-first',config),first);assert.deepEqual(await enqueueIndexing(db,remainder,'fourteen-fill-remainder',config),last);
  }finally{await runtime.dispose();}
});
test('twenty-article manifests preserve capacity with partial room, concurrent admission and restart',{timeout:60000},async()=>{
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),path=join(git,'seo-twenty-article-test');rmSync(path,{recursive:true,force:true});let runtime,db;
  async function start(){runtime=new Miniflare({...convertV4MiniflareOptions({name:'seo-twenty-article-test',modules:true,script:'export default {fetch(){return new Response("local test")}}',compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'seo-twenty-article-test'},outboundService(){throw Error('external fetch forbidden');}}),cf:false,resourcePersistencePath:path});db=await runtime.getD1Database('EDITORIAL_DB');}
  const expanded={...manifest,entries:readingArticleIds.slice(0,20).map(articleId=>({articleId,url:config.origin+`/articles/${articleId}/`,revision:'c'.repeat(64)}))};
  const rows=async()=>({receipts:(await db.prepare('SELECT * FROM indexing_enqueue_receipts ORDER BY event_key').all()).results,notifications:(await db.prepare('SELECT * FROM indexing_notifications ORDER BY id').all()).results});
  await start();try{
    for(const sql of readFileSync('migrations/0006_indexing_outbox.sql','utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
    const first=await enqueueIndexing(db,expanded,'twenty-first',config);assert.equal(first.ids.length,20);
    for(let n=1;n<3;n++)await enqueueIndexing(db,expanded,'twenty-release-'+n,config);
    const raced=await Promise.allSettled(['twenty-race-one','twenty-race-two'].map(key=>enqueueIndexing(db,expanded,key,config)));assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.find(r=>r.status==='rejected').reason.code,'indexing_capacity');
    const before=await rows();assert.equal(before.receipts.length,4);assert.equal(before.notifications.length,80);
    await assert.rejects(enqueueIndexing(db,expanded,'twenty-no-room',config),{code:'indexing_capacity'});assert.deepEqual(await rows(),before);
    const remainder={...expanded,entries:expanded.entries.slice(0,16)},last=await enqueueIndexing(db,remainder,'twenty-fill-remainder',config);assert.equal(last.ids.length,16);const snapshot=await rows();assert.equal(snapshot.notifications.length,96);
    await assert.rejects(enqueueIndexing(db,manifest,'twenty-full',config),{code:'indexing_capacity'});assert.deepEqual(await rows(),snapshot);
    await runtime.dispose();await start();assert.deepEqual(await rows(),snapshot);assert.deepEqual(await enqueueIndexing(db,expanded,'twenty-first',config),first);assert.deepEqual(await enqueueIndexing(db,remainder,'twenty-fill-remainder',config),last);
  }finally{await runtime.dispose();}
});
test('actual local D1 outbox migration/replay/concurrency/restart/faults and bounds preserve unrelated data',{timeout:120000},async()=>{
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),path=join(git,'seo-outbox-test');rmSync(path,{recursive:true,force:true});let runtime,db,calls=0;
  async function start(){runtime=new Miniflare({...convertV4MiniflareOptions({name:'seo-outbox-test',modules:true,script:'export default {fetch(){return new Response("read-only test")}}',compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'seo-outbox-test'},outboundService(){throw Error('external fetch forbidden');}}),cf:false,resourcePersistencePath:path});db=await runtime.getD1Database('EDITORIAL_DB');}
  await start();
  const rows=async()=>({receipts:(await db.prepare('SELECT * FROM indexing_enqueue_receipts ORDER BY event_key').all()).results,notifications:(await db.prepare('SELECT * FROM indexing_notifications ORDER BY id').all()).results});
  const provider={id:'indexnow',origin:config.origin,ownershipVerified:true,supports:'canonical-article-updates',async notify(){calls++;return {status:200};}};
  try{
    for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')&&f!=='0006_indexing_outbox.sql').sort())for(const sql of readFileSync(join('migrations',file),'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
    await db.prepare("UPDATE http_request_budget SET day=20000,used=7 WHERE id=1").run();
    const legacyTables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results.map(x=>x.name);const legacy=async()=>Object.fromEntries(await Promise.all(legacyTables.map(async table=>[table,(await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])));const before=await legacy();
    for(const sql of readFileSync('migrations/0006_indexing_outbox.sql','utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();assert.deepEqual(await legacy(),before);
    const empty=await rows();await db.prepare("CREATE TRIGGER synthetic_queue_failure BEFORE INSERT ON indexing_notifications BEGIN SELECT RAISE(ABORT,'synthetic rollback'); END").run();
    await assert.rejects(enqueueIndexing(db,manifest,'failed-enqueue-transaction',config));assert.deepEqual(await rows(),empty);await db.prepare('DROP TRIGGER synthetic_queue_failure').run();
    for(const input of [{...manifest,mode:'staging',origin:'https://staging.agenticbible.si',entries:[]},{...manifest,mode:'synthetic',origin:'https://staging.agenticbible.si',entries:[]}])assert.equal((await enqueueIndexing(db,input,'ineligible-build',config)).status,'ineligible-build');assert.equal((await rows()).receipts.length,0);
    const queued=await Promise.all([enqueueIndexing(db,manifest,'canonical-release-first',config),enqueueIndexing(db,manifest,'canonical-release-first',config)]);assert.deepEqual(queued[0],queued[1]);const first=queued[0],id=first.ids[0];
    assert.deepEqual(await enqueueIndexing(db,manifest,'canonical-release-first',config),first);
    const changed=structuredClone(manifest);changed.entries[0].revision='b'.repeat(64);await assert.rejects(enqueueIndexing(db,changed,'canonical-release-first',config),{code:'indexing_event_conflict'});
    assert.equal((await rows()).notifications.length,1);
    const results=await Promise.all([deliverIndexing(db,id,config,provider),deliverIndexing(db,id,config,provider)]);assert.ok(results.some(r=>r.status==='acknowledged'));assert.equal(calls,1);
    await runtime.dispose();await start();assert.equal((await deliverIndexing(db,id,config,provider)).status,'acknowledged');assert.equal(calls,1);assert.deepEqual(await enqueueIndexing(db,manifest,'canonical-release-first',config),first);
    const uncertain=(await enqueueIndexing(db,changed,'canonical-release-uncertain',config)).ids[0];const failing={...provider,async notify(){calls++;throw Error('untrusted diagnostic must not persist');}};
    assert.equal((await deliverIndexing(db,uncertain,config,failing)).status,'outcome-uncertain-explicit-recovery-required');assert.equal(calls,2);await deliverIndexing(db,uncertain,config,provider);assert.equal(calls,2);
    await retryIndexing(db,uncertain,1,config);assert.equal((await deliverIndexing(db,uncertain,config,provider)).indexed,'unknown');assert.equal(calls,3);
    const dead=(await enqueueIndexing(db,manifest,'canonical-release-inflight',config)).ids[0];await db.prepare("UPDATE indexing_notifications SET state='inflight',attempts=1,token='stopped-worker' WHERE id=?").bind(dead).run();await runtime.dispose();await start();await deliverIndexing(db,dead,config,provider);assert.equal(calls,3);await retryIndexing(db,dead,1,config);await deliverIndexing(db,dead,config,provider);assert.equal(calls,4);
    const exhausted=(await enqueueIndexing(db,manifest,'canonical-release-bounded',config)).ids[0];for(let attempt=1;attempt<=3;attempt++){await deliverIndexing(db,exhausted,config,failing);if(attempt<3)await retryIndexing(db,exhausted,attempt,config);}await assert.rejects(retryIndexing(db,exhausted,3,config),{code:'indexing_attempts_exhausted'});assert.equal(calls,7);
    // A timed-out adapter receives AbortSignal and cannot trigger an implicit second delivery.
    const timeout=(await enqueueIndexing(db,manifest,'canonical-release-timeout',config)).ids[0];let aborted=false;await deliverIndexing(db,timeout,config,{...provider,notify({signal}){calls++;signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});}});assert.equal(aborted,true);await deliverIndexing(db,timeout,config,provider);assert.equal(calls,8);
    const lost=(await enqueueIndexing(db,manifest,'canonical-release-lost-ack',config)).ids[0];await db.prepare("CREATE TRIGGER synthetic_ack_failure BEFORE UPDATE ON indexing_notifications WHEN NEW.state='acknowledged' BEGIN SELECT RAISE(ABORT,'synthetic ack failure'); END").run();assert.equal((await deliverIndexing(db,lost,config,provider)).status,'outcome-uncertain-explicit-recovery-required');assert.equal(calls,9);await db.prepare('DROP TRIGGER synthetic_ack_failure').run();await deliverIndexing(db,lost,config,provider);assert.equal(calls,9);await retryIndexing(db,lost,1,config);assert.equal((await deliverIndexing(db,lost,config,{...provider,async notify(){calls++;return {status:202};}})).acknowledgment,202);assert.equal(calls,10);
    for(let n=6;n<32;n++)await enqueueIndexing(db,manifest,'capacity-release-'+n,config);const snapshot=await rows();await assert.rejects(enqueueIndexing(db,manifest,'capacity-extra',config),{code:'indexing_capacity'});assert.deepEqual(await rows(),snapshot);assert.deepEqual(await enqueueIndexing(db,manifest,'canonical-release-first',config),first);assert.deepEqual(await legacy(),before);assert.equal(JSON.stringify(snapshot).includes('untrusted diagnostic'),false);
    await runtime.dispose();await start();assert.deepEqual(await rows(),snapshot);assert.deepEqual(await legacy(),before);
  }finally{await runtime.dispose();}
});
