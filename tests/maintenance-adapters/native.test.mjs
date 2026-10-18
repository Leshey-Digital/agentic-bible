import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {document,mcp,openai,urls} from './fixtures.mjs';
import {createAcquiredQualitySourcePort} from '../../src/maintenance-adapters/quality-source.ts';
import {verifyAcquiredSource,verifyAcquiredSourceReference} from '../../src/maintenance-adapters/acquisition.ts';

test('native Worker acquisition preserves charged original bytes and receipt verification across D1 restart',{timeout:120000},async()=>{
 const path=resolve('.git/maintenance-adapters-native-state');rmSync(path,{recursive:true,force:true});mkdirSync(path,{recursive:true});
 const bundled=await build({entryPoints:['tests/maintenance-adapters/entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*']});
 let runtime,db,calls=[],respond=()=>new Response(document(),{headers:{'Content-Type':'text/html; charset=utf-8',ETag:'"controlled-v1"'}});
 async function start(){runtime=new Miniflare({...convertV4MiniflareOptions({name:'maintenance-adapters-controlled-test',modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'maintenance-adapters-controlled'},d1Persist:path,
  outboundService:async request=>{
   const reserved=await db.prepare("SELECT COUNT(*) n FROM http_request_reservations WHERE outcome='reserved'").first();assert.ok(reserved.n>0,'real D1 charge precedes native fetch');
   calls.push({url:request.url,method:request.method,headers:Object.fromEntries(request.headers)});return respond(request);
  }}),cf:false,resourcePersistencePath:path});db=await runtime.getD1Database('EDITORIAL_DB');}
 const action=async input=>{const response=await runtime.dispatchFetch('http://localhost/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,value:await response.json()};};
 const acquire=(sourceId=mcp,requestKey=crypto.randomUUID(),extra={})=>action({enabled:true,selection:{sourceId,requestKey},...extra});
 const sql=statement=>db.prepare(statement).run();
 const reset=async()=>{await sql('DELETE FROM http_request_reservations');await sql('DELETE FROM http_check_jobs');await sql('DELETE FROM http_source_state');await sql('UPDATE http_request_budget SET day=0,used=0');calls=[];};
 const count=async()=>({jobs:(await db.prepare('SELECT COUNT(*) n FROM http_check_jobs').first()).n,reservations:(await db.prepare('SELECT COUNT(*) n FROM http_request_reservations').first()).n,used:(await db.prepare('SELECT used FROM http_request_budget').first()).used});
 try{
  await start();for(const statement of readFileSync('migrations/0005_http_observations.sql','utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await sql(statement);
  assert.equal((await acquire(mcp,crypto.randomUUID(),{enabled:false})).value.error,'adapter_disabled');
  assert.equal((await acquire('https://127.0.0.1/private')).value.error,'adapter_profile_not_registered');
  assert.equal((await action({enabled:true,selection:{sourceId:mcp,requestKey:crypto.randomUUID(),url:urls[openai]}})).value.error,'adapter_invalid_shape');
  assert.equal(calls.length,0);assert.deepEqual(await count(),{jobs:0,reservations:0,used:0});

  const key=crypto.randomUUID(),first=await acquire(mcp,key);assert.equal(first.status,200,JSON.stringify(first.value));
  assert.equal(new TextDecoder().decode(Uint8Array.from(first.value.source.raw.bytes)),document());
  assert.equal(first.value.source.lineage.provenance,'unknown');assert.deepEqual(first.value.source.lineage.originIds,[]);
  assert.equal(calls.length,1);assert.equal(calls[0].url,urls[mcp]);assert.equal(calls[0].method,'GET');assert.equal(calls[0].headers.authorization,undefined);assert.equal(calls[0].headers.cookie,undefined);assert.equal(calls[0].headers['accept-encoding'],'identity');
  assert.deepEqual((await action({action:'verify',packet:first.value})).value,first.value);
  const before=await count();await runtime.dispose();await start();
  assert.deepEqual((await action({action:'verify',packet:first.value})).value,first.value);assert.deepEqual(await count(),before);
  const captured={...first.value.source,raw:{...first.value.source.raw,bytes:Uint8Array.from(first.value.source.raw.bytes)}};
  const reference=await verifyAcquiredSourceReference({source:captured,requestKey:key},{db});
  assert.equal(reference.receipt.reservationToken,first.value.receipt.reservationToken);
  const sourcePort=createAcquiredQualitySourcePort({db}),qualitySource=await sourcePort({citationId:'mcp-tools',source:captured,requestKey:key});
  assert.equal(qualitySource.bodyHash,first.value.source.raw.hash);assert.equal(qualitySource.extraction.extractedHash,first.value.source.evidence.hash);
  assert.equal(new TextDecoder().decode(qualitySource.bytes),document());assert.deepEqual(qualitySource.lineage,{originIds:[],provenance:'unknown'});
  assert.deepEqual(await count(),before);assert.equal(calls.length,1,'native capture to quality consumer does not refetch or recharge');
  await assert.rejects(sourcePort({citationId:'mcp-tools',source:captured,requestKey:crypto.randomUUID()}),{code:'adapter_uncharged_body'});
  const later=first.value.receipt.observedAt+86400001,clock=()=>later;
  await assert.rejects(verifyAcquiredSourceReference({source:captured,requestKey:key},{db,clock}),{code:'adapter_stale_observation'});
  const historical=await verifyAcquiredSourceReference({source:captured,requestKey:key},{db,clock,historicalReplay:true});
  assert.deepEqual(historical.receipt,reference.receipt);
  assert.deepEqual((await verifyAcquiredSource(historical,{db,clock,historicalReplay:true})).receipt,reference.receipt);
  await assert.rejects(verifyAcquiredSourceReference({source:captured,requestKey:key},{db,clock:()=>reference.receipt.observedAt-1}),{code:'adapter_stale_observation'});
  assert.deepEqual((await verifyAcquiredSourceReference({source:captured,requestKey:key},{db,clock:()=>reference.receipt.observedAt-1,historicalReplay:true})).receipt,reference.receipt);
  assert.equal((await createAcquiredQualitySourcePort({db,clock,historicalReplay:true})({citationId:'mcp-tools',source:captured,requestKey:key})).bodyHash,qualitySource.bodyHash);
  await assert.rejects(sourcePort({citationId:'mcp-tools',source:captured,requestKey:key,historicalReplay:true}),{code:'adapter_invalid_shape'});
  const tampered=structuredClone(captured);tampered.raw.hash='0'.repeat(64);
  await assert.rejects(verifyAcquiredSourceReference({source:tampered,requestKey:key},{db,clock,historicalReplay:true}));
  assert.deepEqual(await count(),before);assert.equal(calls.length,1,'historical integrity reads retain raw authority without admission or network');
  assert.equal((await acquire(mcp,key)).value.error,'adapter_existing_attempt_no_refetch');assert.equal(calls.length,1);
  const forged=structuredClone(first.value);forged.source.lineage.provenance='original';forged.source.lineage.originIds=['caller-origin'];assert.equal((await action({action:'verify',packet:forged})).status,503);
  const wrongReceipt=structuredClone(first.value);wrongReceipt.receipt.requestKey=crypto.randomUUID();assert.equal((await action({action:'verify',packet:wrongReceipt})).value.error,'adapter_uncharged_body');
  const changedReceipt=structuredClone(first.value);changedReceipt.receipt.observedAt++;assert.equal((await action({action:'verify',packet:changedReceipt})).value.error,'adapter_receipt_binding_mismatch');
  assert.equal((await action({action:'verify',packet:first.value,now:first.value.receipt.observedAt+86400001})).value.error,'adapter_stale_observation');

  for(const [make,code] of [
   [()=>new Response(null,{status:302,headers:{Location:'https://example.invalid/copied'}}),'redirect_blocked'],
   [()=>new Response(document().replace(urls[mcp],urls[openai]),{headers:{'Content-Type':'text/html'}}),'adapter_source_identity'],
   [()=>new Response('{"evidence":"invented JSON source profile"}',{headers:{'Content-Type':'application/json'}}),'adapter_profile_content_type'],
   [()=>new Response('{broken',{headers:{'Content-Type':'application/json'}}),'malformed_body'],
   [()=>new Response(new TextEncoder().encode('\ufeff'+document()),{headers:{'Content-Type':'text/html'}}),'adapter_raw_bom'],
   [()=>new Response('x'.repeat(32769),{headers:{'Content-Type':'text/html'}}),'body_too_large'],
   [()=>new Response('x',{headers:{'Content-Type':'text/html','Content-Length':'32769'}}),'body_too_large'],
   [()=>new Response(document(),{headers:{'Content-Type':'text/html','Content-Encoding':'gzip'}}),'unsupported_content_encoding'],
   [async()=>{await new Promise(resolve=>setTimeout(resolve,2200));return new Response(document(),{headers:{'Content-Type':'text/html'}});},'http_timeout'],
   [()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('<html>'));setTimeout(()=>{try{controller.close();}catch{}},2200);}}),{headers:{'Content-Type':'text/html'}}),'http_timeout'],
  ]){
   respond=make;const badKey=crypto.randomUUID(),previous=await db.prepare('SELECT * FROM http_source_state WHERE source_id=?').bind(mcp).first(),n=calls.length;
   const result=await acquire(mcp,badKey);assert.equal(result.value.error,code,JSON.stringify(result));assert.equal(calls.length,n+1);
   assert.deepEqual(await db.prepare('SELECT * FROM http_source_state WHERE source_id=?').bind(mcp).first(),previous);
   assert.equal((await acquire(mcp,badKey)).value.error,'adapter_existing_attempt_no_refetch');assert.equal(calls.length,n+1);
  }
  assert.ok(calls.every(call=>Object.values(urls).includes(call.url)),'no redirect target or contributed URL dispatched');

  await reset();respond=()=>new Response(document(),{headers:{'Content-Type':'text/html',ETag:'"v2"'}});const original=await acquire();assert.equal(original.status,200);
  respond=()=>new Response(null,{status:304});const notModified=await acquire();assert.equal(notModified.value.error,'adapter_original_200_required');
  assert.deepEqual((await action({action:'verify',packet:original.value})).value,original.value,'old original-200 receipt retains its exact raw evidence');

  await reset();await db.prepare('UPDATE http_request_budget SET day=?,used=20').bind(Math.floor(Date.now()/86400000)).run();respond=()=>new Response(document(),{headers:{'Content-Type':'text/html'}});
  assert.equal((await acquire()).value.error,'adapter_http_not_admitted');assert.equal(calls.length,0);
  assert.equal((await count()).used,20);await runtime.dispose();await start();assert.equal((await acquire()).value.error,'adapter_http_not_admitted');assert.equal(calls.length,0);
  await reset();await sql('DROP TABLE http_request_budget');assert.equal((await acquire()).status,503);assert.equal(calls.length,0);
 }finally{if(runtime)await runtime.dispose();}
});
