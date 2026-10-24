import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {HttpObservationStore} from '../../src/monitoring/http-store.ts';
import {createHostedRuntime} from '../../src/hosted/worker.ts';
const origin='https://staging.agenticbible.si',source='s-90f2bf11e4fb71c8f42ae128';
test('authenticated inspection reads original/extended receipts offline even without AI configuration',async()=>{
 const mf=new Miniflare({...convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("local")}}',compatibilityDate:'2026-10-16',d1Databases:{DB:'inspect-source'}}),cf:false});
 try{const db=await mf.getD1Database('DB');for(const file of ['0005_http_observations.sql','0026_http_download_envelope.sql'])await db.batch(readFileSync('migrations/'+file,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
 const store=new HttpObservationStore(db),key=crypto.randomUUID(),now=Date.now();await store.enqueue(source,key,now);const lease=await store.claim(key,now);await store.finish(lease,{ok:false,state:null,error:{code:'body_too_large',retryable:false}},now);
 const before=(await db.prepare('SELECT * FROM http_check_jobs').all()).results;let allowed=true;
 const runtime=createHostedRuntime({contributions:{},verifyAdmin:async()=>allowed?{subject:'signed-admin:'+ 'a'.repeat(64),role:'admin',csrfVerified:true,expiresAt:Date.now()+10000}:null});
 const env={EDITORIAL_DB:db,ASSETS:{fetch:async()=>{throw Error('unexpected outbound');}}};
 const get=(suffix=key,init={})=>runtime.fetch(new Request(origin+'/api/admin/drafts/attempt/'+suffix,init),env);
 const r=await get();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const value=await r.json();assert.equal(value.inspectionOnly,true);assert.equal(value.chargedAttempts,1);assert.equal(value.download.bytes,null);assert.equal(value.download.overflow,null);assert.equal(value.download.currentLimitBytes,1048576);assert.equal(value.failureCode,'body_too_large');assert.equal(value.url,'https://developers.openai.com/api/docs/guides/function-calling');assert.equal(value.token,undefined);
 assert.equal((await get('bad')).status,400);assert.equal((await get(crypto.randomUUID())).status,404);assert.equal((await get(key,{method:'POST'})).status,405);assert.equal((await get(key,{headers:{'sec-fetch-site':'cross-site'}})).status,403);allowed=false;assert.equal((await get()).status,403);allowed=true;
 assert.deepEqual((await db.prepare('SELECT * FROM http_check_jobs').all()).results,before);assert.equal((await db.prepare('SELECT used FROM http_request_budget').first()).used,1);
 const newer={status:'dead',ok:false,error:{code:'body_too_large',retryable:false,bodyOverflow:{stage:'stream',limitBytes:1048576,observedBytes:1048577,complete:false}}};await db.prepare('UPDATE http_check_jobs SET result=? WHERE request_key=?').bind(JSON.stringify(newer),key).run();assert.deepEqual((await (await get()).json()).download.overflow,newer.error.bodyOverflow);
 newer.error.code='<script>secret</script>';await db.prepare('UPDATE http_check_jobs SET result=? WHERE request_key=?').bind(JSON.stringify(newer),key).run();assert.equal((await (await get()).json()).failureCode,null);
 }finally{await mf.dispose();}
});
