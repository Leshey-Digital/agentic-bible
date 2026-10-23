import test from 'node:test';
import assert from 'node:assert/strict';
import {createHttpPass} from '../../src/monitoring/http-core.ts';
import {sourceBodyLimit,httpLimits} from '../../src/monitoring/http-registry.ts';
import {extractMaintenanceSource} from '../../src/maintenance-adapters/extraction.ts';
import {document,bytes,openai,mcp} from './fixtures.mjs';
const response=(body,headers={})=>new Response(body,{headers:{'Content-Type':'text/html',...headers}});
const check=(make,id=openai)=>createHttpPass({fetch:async()=>make()}).check(id);
const large=(n)=>document(openai).replace('</head>','<!--'+ 'x'.repeat(n)+'--></head>');
test('OpenAI HTML envelope accepts complete large synthetic markup without expanding evidence',async()=>{
 const html=large(512*1024),raw=bytes(html);assert.equal(sourceBodyLimit(openai),1048576);assert.equal(sourceBodyLimit(mcp),32768);
 const r=await check(()=>response(html));assert.equal(r.ok,true);assert.equal(r.observation.bytes,raw.length);
 const p=await extractMaintenanceSource(openai,raw,'text/html');assert.ok(bytes(p.evidence.text).length<8192);assert.equal(p.raw.bytes.length,raw.length);
 assert.equal((await check(()=>response(html),mcp)).error.code,'body_too_large');
 const exact=large(1048576-bytes(large(0)).length);assert.equal(bytes(exact).length,1048576);assert.equal((await check(()=>response(exact))).ok,true);await extractMaintenanceSource(openai,bytes(exact),'text/html');
 await assert.rejects(extractMaintenanceSource(openai,bytes(exact+'x'),'text/html'),{code:'adapter_raw_limit'});
 await assert.rejects(extractMaintenanceSource(openai,bytes(document(openai,'x'.repeat(8193))),'text/html'),{code:'adapter_evidence_limit'});
 await assert.rejects(extractMaintenanceSource(openai,bytes(large(50000).slice(0,-8)),'text/html'),{code:'adapter_html_structure'});
});
test('declared and streamed overflow report bounded incomplete counts and cancel',async()=>{
 let cancelled=false;const limit=sourceBodyLimit(openai);
 const declared=await check(()=>response(new ReadableStream({cancel(){cancelled=true;}}),{'Content-Length':String(limit+1)}));
 assert.deepEqual(declared.error.bodyOverflow,{stage:'declared',limitBytes:limit,observedBytes:limit+1,complete:false});assert.equal(cancelled,true);
 cancelled=false;let chunks=0;const r=await check(()=>response(new ReadableStream({pull(c){chunks++;c.enqueue(new Uint8Array(65536));},cancel(){cancelled=true;}})));
 assert.equal(r.error.code,'body_too_large');assert.equal(r.error.retryable,false);assert.equal(r.error.bodyOverflow.stage,'stream');assert.equal(r.error.bodyOverflow.complete,false);assert.ok(r.error.bodyOverflow.observedBytes>limit);assert.ok(chunks<=18);assert.equal(cancelled,true);
});
test('compression, redirects, truncation and invalid encoding stay closed',async()=>{
 for(const [make,code] of [[()=>response('compressed',{'Content-Encoding':'gzip'}),'unsupported_content_encoding'],[()=>new Response(null,{status:302,headers:{Location:'https://example.com/'}}),'redirect_blocked'],[()=>response('short',{'Content-Length':'100'}),'content_length_mismatch'],[()=>response(new Uint8Array([255])),'malformed_body'],[()=>response('x',{'Content-Type':'image/png'}),'unsupported_content_type']])assert.equal((await check(make)).error.code,code);
 assert.equal(httpLimits.timeoutMs,2000);assert.equal(httpLimits.requests,4);
});

test('populated native D1 migration preserves old receipts and records complete large-source bytes and overflow',async()=>{
 const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');const {readFileSync}=await import('node:fs');const {acquireMaintenanceSource,verifyAcquiredSource}=await import('../../src/maintenance-adapters/acquisition.ts');
 const runtime=new Miniflare({...convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("local");}}',compatibilityDate:'2026-10-16',d1Databases:{DB:'envelope-test'}}),cf:false});
 try{const db=await runtime.getD1Database('DB');const migration=async path=>db.batch(readFileSync(path,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
 await migration('migrations/0005_http_observations.sql');
 const oldKey=crypto.randomUUID();await assert.rejects(acquireMaintenanceSource({sourceId:mcp,requestKey:oldKey},{enabled:true,db,send:async()=>response('x'.repeat(32769))}),{code:'body_too_large'});
 await db.batch([db.prepare('CREATE TABLE envelope_child(token TEXT REFERENCES http_request_reservations(token) ON DELETE CASCADE)'),db.prepare('CREATE TABLE envelope_audit(n INTEGER)'),db.prepare('CREATE INDEX envelope_explicit_index ON http_request_reservations(day)'),db.prepare('CREATE TRIGGER envelope_delete AFTER DELETE ON http_request_reservations BEGIN INSERT INTO envelope_audit VALUES(1); END'),db.prepare('INSERT INTO envelope_child SELECT token FROM http_request_reservations')]);
 const dependencies=(await db.prepare("SELECT name,sql FROM sqlite_master WHERE name IN ('envelope_child','envelope_explicit_index','envelope_delete') ORDER BY name").all()).results;
 const before=await db.prepare('SELECT * FROM http_request_reservations').all();const oldJob=await db.prepare('SELECT * FROM http_check_jobs WHERE request_key=?').bind(oldKey).first();
 await migration('migrations/0026_http_download_envelope.sql');assert.deepEqual((await db.prepare('SELECT * FROM http_request_reservations').all()).results,before.results.map(row=>({...row,actual_download_bytes:null})));assert.deepEqual(await db.prepare('SELECT * FROM http_check_jobs WHERE request_key=?').bind(oldKey).first(),oldJob);
 assert.deepEqual((await db.prepare("SELECT name,sql FROM sqlite_master WHERE name IN ('envelope_child','envelope_explicit_index','envelope_delete') ORDER BY name").all()).results,dependencies);assert.equal((await db.prepare('SELECT COUNT(*) n FROM envelope_child').first()).n,1);assert.equal((await db.prepare('SELECT COUNT(*) n FROM envelope_audit').first()).n,0);
 const html=large(512*1024),key=crypto.randomUUID();const packet=await acquireMaintenanceSource({sourceId:openai,requestKey:key},{enabled:true,db,send:async()=>response(html)});assert.equal(packet.source.raw.bytes.length,bytes(html).length);await verifyAcquiredSource(packet,{db});
 assert.equal((await db.prepare('SELECT actual_download_bytes FROM http_request_reservations WHERE request_key=?').bind(key).first()).actual_download_bytes,bytes(html).length);
 await assert.rejects(acquireMaintenanceSource({sourceId:openai,requestKey:key},{enabled:true,db,send:async()=>{throw Error('must not refetch');}}),{code:'adapter_existing_attempt_no_refetch'});
 const bad=crypto.randomUUID();await assert.rejects(acquireMaintenanceSource({sourceId:openai,requestKey:bad},{enabled:true,db,send:async()=>response('x'.repeat(1048577))}),{code:'body_too_large'});
 const job=await db.prepare('SELECT result FROM http_check_jobs WHERE request_key=?').bind(bad).first();const result=JSON.parse(job.result);assert.equal(result.error.bodyOverflow.complete,false);assert.equal(result.error.bodyOverflow.limitBytes,1048576);assert.equal((await db.prepare('SELECT actual_bytes FROM http_request_reservations WHERE request_key=?').bind(bad).first()).actual_bytes,null);
 await assert.rejects(db.prepare('UPDATE http_request_reservations SET actual_download_bytes=1048577 WHERE request_key=?').bind(key).run());
 const bigRow=await db.prepare('SELECT * FROM http_request_reservations WHERE request_key=?').bind(key).first();assert.equal(bigRow.actual_bytes,null);
 // Execute the exact retained rollback store: explicit INSERT columns tolerate the additive schema.
 const {execFileSync}=await import('node:child_process');const {build}=await import('esbuild');const {resolve}=await import('node:path');
 const oldSource=execFileSync('git',['show','466d308bd3c93ccfff0c70b8d4f6c079cabef0fb:src/monitoring/http-store.ts'],{encoding:'utf8'});
 const bundle=await build({stdin:{contents:oldSource,resolveDir:resolve('src/monitoring'),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});const {HttpObservationStore}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));const oldStore=new HttpObservationStore(db);const rollbackKey=crypto.randomUUID(),now=Date.now();await oldStore.enqueue(mcp,rollbackKey,now);const lease=await oldStore.claim(rollbackKey,now);assert.ok(lease);const oldResult=await check(()=>response(document(mcp)),mcp);assert.equal(await oldStore.finish(lease,oldResult,now),true);const oldRow=await db.prepare('SELECT * FROM http_request_reservations WHERE request_key=?').bind(rollbackKey).first();assert.equal(oldRow.actual_download_bytes,null);assert.equal(oldRow.actual_bytes,bytes(document(mcp)).length);assert.deepEqual(await db.prepare('SELECT * FROM http_request_reservations WHERE request_key=?').bind(key).first(),bigRow);
 }finally{await runtime.dispose();}
});
