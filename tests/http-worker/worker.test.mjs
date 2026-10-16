import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {HttpObservationStore} from '../../src/monitoring/http-store.ts';
import {httpSources} from '../../src/monitoring/http-registry.ts';

test('actual workerd/D1 HTTP observations survive restart with atomic budgets, retries and last-good failures',{timeout:120000},async()=>{
  const path=resolve('.git/http-observation-worker-state');rmSync(path,{recursive:true,force:true});mkdirSync(path,{recursive:true});
  const bundled=await build({entryPoints:['tests/http-worker/entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*']});
  let mf;let db;let calls=[];let respond=()=>new Response('Synthetic documentation',{headers:{'Content-Type':'text/plain',ETag:'"v1"','Last-Modified':'Thu, 01 Oct 2026 00:00:00 GMT'}});
  async function start(){mf=new Miniflare({...convertV4MiniflareOptions({name:'http-observations-test',modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'http-observations'},d1Persist:path,
    outboundService:async request=>{calls.push({url:request.url,headers:Object.fromEntries(request.headers),method:request.method});return respond(request);}}),resourcePersistencePath:path});db=await mf.getD1Database('EDITORIAL_DB');}
  async function stop(){await mf.dispose();mf=undefined;}
  const sql=statement=>db.prepare(statement).run();
  const rows=async(table)=> (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
  const action=(id,key,extra={})=>mf.dispatchFetch('http://localhost/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,key,...extra})});
  const check=async(id,key)=>{const r=await action(id,key);const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};
  const s=httpSources[0].id;const key=()=>crypto.randomUUID();
  const reset=async()=>{await sql('DELETE FROM http_request_reservations');await sql('DELETE FROM http_check_jobs');await sql('UPDATE http_request_budget SET used=0');calls=[];};
  const due=async k=>db.prepare('UPDATE http_check_jobs SET due_at=0 WHERE request_key=?').bind(k).run();
  try{
    await start();
    // Apply the real migration stack, then assert the HTTP migration preserves populated prior data.
    for(const name of readdirSync('migrations').filter(name=>name.endsWith('.sql')&&name!=='0005_http_observations.sql').sort()){
      for(const statement of readFileSync('migrations/'+name,'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await sql(statement);
    }
    await sql("INSERT INTO rate_windows(client_hash,window,count) VALUES('synthetic-http-upgrade',1,2)");
    const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results.map(r=>r.name);
    const before=Object.fromEntries(await Promise.all(tables.map(async table=>[table,await rows(table)])));
    for(const statement of readFileSync('migrations/0005_http_observations.sql','utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await sql(statement);
    for(const table of tables)assert.deepEqual(await rows(table),before[table]);
    assert.deepEqual(await(await mf.dispatchFetch('http://localhost/probe')).json(),{unsupported:true,lookupCalled:false});assert.equal(calls.length,0);calls=[];
    for(const id of ['https://127.0.0.1/','https://169.254.169.254/',httpSources[0].url,'https://user:pass@developers.openai.com/'])assert.equal((await action(id,key())).status,503);
    assert.equal(calls.length,0);assert.equal((await rows('http_check_jobs')).length,0);

    const firstKey=key();const baseline=await check(s,firstKey);assert.equal(baseline.status,'succeeded');assert.equal(baseline.observation.kind,'baseline');assert.equal(calls[0].url,httpSources[0].url);assert.equal(calls[0].method,'GET');assert.equal(calls[0].headers['accept-encoding'],'identity');assert.equal(calls[0].headers.cookie,undefined);assert.equal(calls[0].headers.authorization,undefined);
    const saved=await rows('http_source_state');assert.equal(JSON.stringify(saved).includes('Synthetic documentation'),false);
    await stop();await start();assert.deepEqual(await check(s,firstKey),baseline);assert.equal(calls.length,1);
    respond=request=>{assert.equal(request.headers.get('if-none-match'),'"v1"');assert.equal(request.headers.get('if-modified-since'),null);return new Response(null,{status:304,headers:{ETag:'W/"v2"'}});};
    const cached=await check(s,key());assert.equal(cached.status,'succeeded');assert.equal(cached.observation.kind,'not-modified');assert.equal(cached.state.hash,baseline.state.hash);assert.equal(cached.state.etag,'W/"v2"');
    const good=await rows('http_source_state');
    for(const [make,code] of [
      [()=>new Response('redirect',{status:302,headers:{Location:'http://169.254.169.254/private'}}),'redirect_blocked'],
      [()=>new Response('x'.repeat(32769),{headers:{'Content-Type':'text/plain'}}),'body_too_large'],
      [()=>new Response('x',{headers:{'Content-Type':'text/plain','Content-Length':'32769'}}),'body_too_large'],
      [()=>new Response('x',{headers:{'Content-Type':'text/plain','Content-Encoding':'gzip'}}),'unsupported_content_encoding'],
      [()=>new Response('x',{headers:{'Content-Type':'text/plain','X-Oversized':'x'.repeat(8192)}}),'headers_too_large'],
      [async()=>{await new Promise(r=>setTimeout(r,2200));return new Response('too late',{headers:{'Content-Type':'text/plain'}});},'http_timeout'],
      [()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('partial'));setTimeout(()=>{try{c.close();}catch{}},2200);}}),{headers:{'Content-Type':'text/plain'}}),'http_timeout'],
    ]){
      respond=make;const count=calls.length;const result=await check(s,key());assert.equal(result.error.code,code);assert.equal(result.status,code==='http_timeout'?'retry':'dead');assert.equal(calls.length,count+1);assert.deepEqual(await rows('http_source_state'),good);
    }
    assert.equal(calls.some(call=>!httpSources.some(source=>source.url===call.url)),false);
    // Last-Modified fallback and unexpected 304 in actual runtime.
    await reset();respond=()=>new Response('date baseline',{headers:{'Content-Type':'text/plain','Last-Modified':'Thu, 01 Oct 2026 00:00:00 GMT'}});await check(s,key());
    respond=request=>{assert.equal(request.headers.get('if-none-match'),null);assert.equal(request.headers.get('if-modified-since'),'Thu, 01 Oct 2026 00:00:00 GMT');return new Response(null,{status:304});};assert.equal((await check(s,key())).observation.kind,'not-modified');
    respond=()=>new Response(null,{status:304});assert.equal((await check(httpSources[1].id,key())).error.code,'unexpected_not_modified');

    // Retry metadata survives restart; no retry before due, three charged attempts total.
    await reset();respond=()=>new Response('temporary',{status:503});const retryKey=key();const retry1=await check(s,retryKey);assert.equal(retry1.status,'retry');assert.deepEqual(await check(s,retryKey),retry1);assert.equal(calls.length,1);
    // Extend only this synthetic backoff so runtime startup cannot consume the one-second assertion window.
    await db.prepare('UPDATE http_check_jobs SET due_at=? WHERE request_key=?').bind(Date.now()+60000,retryKey).run();
    await stop();await start();assert.deepEqual(await check(s,retryKey),retry1);assert.equal(calls.length,1);await due(retryKey);assert.equal((await check(s,retryKey)).status,'retry');await due(retryKey);const dead=await check(s,retryKey);assert.equal(dead.status,'dead');assert.deepEqual(await check(s,retryKey),dead);assert.equal(calls.length,3);assert.equal((await rows('http_request_budget'))[0].used,3);
    assert.equal((await action(httpSources[1].id,retryKey)).status,503);assert.equal(calls.length,3);

    // Only one caller for a shared key/source dispatches while its response is outstanding.
    await reset();let release;const gate=new Promise(r=>{release=r;});respond=async()=>{await gate;return new Response('parallel',{headers:{'Content-Type':'text/plain'}});};
    const shared=key();const pending=check(s,shared);while(!calls.length)await new Promise(r=>setTimeout(r,10));
    const same=await Promise.all(Array.from({length:6},()=>check(s,shared)));assert.ok(same.every(result=>result.status==='busy'));
    assert.equal((await check(s,key())).status,'blocked');assert.equal(calls.length,1);release();assert.equal((await pending).status,'succeeded');
    // Four different active leases globally; a fifth cannot dispatch.
    await reset();let releaseAll;const allGate=new Promise(r=>{releaseAll=r;});respond=async()=>{await allGate;return new Response('bounded concurrency',{headers:{'Content-Type':'text/plain'}});};
    const active=httpSources.slice(0,4).map(source=>check(source.id,key()));while(calls.length<4)await new Promise(r=>setTimeout(r,10));assert.equal((await check(httpSources[4].id,key())).status,'blocked');assert.equal(calls.length,4);releaseAll();assert.ok((await Promise.all(active)).every(r=>r.status==='succeeded'));
    // Nineteen prior reservations leave exactly one slot even across simultaneous callers.
    await reset();await sql('UPDATE http_request_budget SET used=19');respond=()=>new Response('budget',{headers:{'Content-Type':'text/plain'}});
    const budget=await Promise.all(httpSources.map(source=>check(source.id,key())));assert.equal(budget.filter(r=>r.status==='succeeded').length,1);assert.equal(calls.length,1);assert.equal((await rows('http_request_budget'))[0].used,20);
    await stop();await start();assert.equal((await check(s,key())).status,'blocked');assert.equal(calls.length,1);

    // Crash after reservation is charged; restart recovery uses another attempt and fences old completion.
    await reset();const crashKey=key();const old=await(await action(s,crashKey,{action:'claim'})).json();assert.equal(old.attempt,1);assert.equal((await rows('http_request_budget'))[0].used,1);await stop();await start();
    await db.prepare('UPDATE http_check_jobs SET lease_until=0 WHERE request_key=?').bind(crashKey).run();const recovered=await check(s,crashKey);assert.equal(recovered.status,'succeeded');assert.equal(calls.length,1);assert.equal((await rows('http_request_budget'))[0].used,2);assert.equal((await rows('http_request_reservations'))[0].outcome,'abandoned');
    const persisted=await rows('http_source_state');const store=new HttpObservationStore(db);assert.equal(await store.finish(old,{ok:true,state:{...recovered.state,etag:'"stale"'},observation:recovered.observation},Date.now()),false);assert.deepEqual(await rows('http_source_state'),persisted);
    const finished=(await rows('http_check_jobs'))[0];const reservations=await rows('http_request_reservations');
    assert.equal(await store.finish({...old,token:finished.finished_token},{ok:false,state:recovered.state,error:{code:'http_network_failed',retryable:true}},Date.now()),false);
    assert.deepEqual(await rows('http_request_reservations'),reservations,'Repeated stale completion cannot rewrite charged outcome.');
    // Three interrupted attempts stop permanently, preserving last good.
    await reset();const interrupted=key();for(let attempt=1;attempt<=3;attempt++){const lease=await(await action(s,interrupted,{action:'claim'})).json();assert.equal(lease.attempt,attempt);await db.prepare('UPDATE http_check_jobs SET lease_until=0 WHERE request_key=?').bind(interrupted).run();}
    const exhausted=await check(s,interrupted);assert.equal(exhausted.error,'http_attempts_exhausted');assert.equal(calls.length,0);assert.equal((await rows('http_request_budget'))[0].used,3);assert.deepEqual(await rows('http_source_state'),persisted);
    // Reservation failure rolls the whole batch back; completion failure cannot advance cache state.
    await reset();await sql("CREATE TRIGGER synthetic_http_reserve_failure BEFORE INSERT ON http_request_reservations BEGIN SELECT RAISE(ABORT,'synthetic reserve failure'); END");
    const rollbackKey=key();assert.equal((await action(s,rollbackKey)).status,503);assert.equal(calls.length,0);assert.equal((await rows('http_request_budget'))[0].used,0);assert.equal((await rows('http_check_jobs'))[0].attempts,0);await sql('DROP TRIGGER synthetic_http_reserve_failure');
    respond=()=>new Response('changed after atomic failure',{headers:{'Content-Type':'text/plain',ETag:'"atomic"'}});
    await sql("CREATE TRIGGER synthetic_http_finish_failure BEFORE UPDATE OF state ON http_check_jobs WHEN NEW.state='succeeded' BEGIN SELECT RAISE(ABORT,'synthetic finish failure'); END");
    assert.equal((await action(s,rollbackKey)).status,503);assert.equal(calls.length,1);assert.deepEqual(await rows('http_source_state'),persisted);assert.equal((await rows('http_request_budget'))[0].used,1);
    await stop();await start();await sql('DROP TRIGGER synthetic_http_finish_failure');await db.prepare('UPDATE http_check_jobs SET lease_until=0 WHERE request_key=?').bind(rollbackKey).run();assert.equal((await check(s,rollbackKey)).status,'succeeded');assert.equal(calls.length,2);assert.equal((await rows('http_request_budget'))[0].used,2);
    // Capacity and missing accounting fail before dispatch; no receipt eviction or counter rollback.
    await reset();await sql('UPDATE http_request_budget SET day=day+1,used=20');assert.equal((await check(s,key())).status,'blocked');assert.equal(calls.length,0);
    await reset();await sql('UPDATE http_request_budget SET day=0');
    for(let i=0;i<128;i++)await new HttpObservationStore(db).enqueue(s,key(),Date.now());assert.equal((await action(s,key())).status,503);assert.equal(calls.length,0);assert.equal((await rows('http_check_jobs')).length,128);
    await reset();await sql('DROP TABLE http_request_budget');assert.equal((await action(s,key())).status,503);assert.equal(calls.length,0);
  }finally{if(mf)await stop();}
});
