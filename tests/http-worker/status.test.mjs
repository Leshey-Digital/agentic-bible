import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {httpSources} from '../../src/monitoring/http-registry.ts';

test('actual workerd/D1 expired budget-blocked leases preserve accounting and retry only when eligible',{timeout:120000},async()=>{
  const path=resolve('.git/http-status-worker-state');rmSync(path,{recursive:true,force:true});mkdirSync(path,{recursive:true});
  const bundled=await build({entryPoints:['tests/http-worker/entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*']});
  let mf;let db;let fetches=0;let temporary=true;
  async function start(){mf=new Miniflare({...convertV4MiniflareOptions({name:'http-status-test',modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'http-status'},d1Persist:path,
    outboundService:()=>{fetches++;return temporary?new Response('temporary',{status:503}):new Response('Synthetic status recovery',{headers:{'Content-Type':'text/plain'}});}}),resourcePersistencePath:path});db=await mf.getD1Database('EDITORIAL_DB');}
  async function restart(){await mf.dispose();mf=undefined;await start();}
  const source=httpSources[0].id;const key=crypto.randomUUID();const now=Date.UTC(2030,0,1,12);const day=Math.floor(now/86400000);const nextDay=(day+1)*86400000;
  const action=async(time,extra={})=>{const response=await mf.dispatchFetch('http://localhost/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:source,key,now:time,...extra})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};
  const rows=async table=>(await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
  const accounting=async()=>({budget:await rows('http_request_budget'),reservations:await rows('http_request_reservations')});
  try{
    await start();
    for(const statement of readFileSync('migrations/0005_http_observations.sql','utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
    const lease=await action(now,{action:'claim'});assert.equal(lease.attempt,1);assert.equal(fetches,0);
    const expiry=now+10000;await db.prepare('UPDATE http_request_budget SET used=20').run();
    const charged=await accounting();const lastGood=await rows('http_source_state');
    assert.deepEqual(await action(expiry-1),{status:'busy',error:'http_in_progress',attempts:1});
    assert.deepEqual(await accounting(),charged);assert.equal(fetches,0);
    // At the exact lease boundary no worker is active; the exhausted budget still forbids a new reservation.
    const blocked={status:'blocked',error:'http_not_due_or_budget',attempts:1};
    assert.deepEqual(await action(expiry),blocked);
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM http_check_jobs WHERE state='running' AND lease_until>?").bind(expiry).first()).count,0);
    const abandoned=await accounting();assert.equal(abandoned.budget[0].used,20);assert.equal(abandoned.reservations.length,1);assert.equal(abandoned.reservations[0].outcome,'abandoned');assert.equal(abandoned.reservations[0].actual_bytes,null);
    await restart();
    for(const time of [expiry,expiry+1,nextDay-1]){assert.deepEqual(await action(time),blocked);assert.deepEqual(await accounting(),abandoned);assert.equal(fetches,0);assert.deepEqual(await rows('http_source_state'),lastGood);}
    // The explicit next-day retry charges only attempt two and preserves the original ambiguous charge.
    const retry=await action(nextDay);assert.equal(retry.status,'retry');assert.equal(retry.error.code,'http_503');assert.equal(retry.retryAt,nextDay+2000);assert.equal(fetches,1);
    const waiting=await accounting();assert.equal(waiting.budget[0].day,day+1);assert.equal(waiting.budget[0].used,1);assert.equal(waiting.reservations.length,2);assert.deepEqual(waiting.reservations[0],abandoned.reservations[0]);assert.equal(waiting.reservations[1].outcome,'failed');
    await restart();
    for(const time of [nextDay,nextDay+1999]){assert.deepEqual(await action(time),retry);assert.deepEqual(await accounting(),waiting);assert.equal(fetches,1);}
    temporary=false;const success=await action(nextDay+2000);assert.equal(success.status,'succeeded');assert.equal(fetches,2);
    const completed=await accounting();assert.equal(completed.budget[0].used,2);assert.equal(completed.reservations.length,3);assert.deepEqual(completed.reservations.map(r=>r.outcome),['abandoned','failed','succeeded']);
    await restart();assert.deepEqual(await action(nextDay+3000),success);assert.deepEqual(await accounting(),completed);assert.equal(fetches,2);assert.equal((await rows('http_check_jobs'))[0].attempts,3);
  }finally{if(mf)await mf.dispose();}
});
