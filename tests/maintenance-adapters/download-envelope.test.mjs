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
 const before=await db.prepare('SELECT * FROM http_request_reservations').all();const oldJob=await db.prepare('SELECT * FROM http_check_jobs WHERE request_key=?').bind(oldKey).first();
 await migration('migrations/0026_http_download_envelope.sql');assert.deepEqual((await db.prepare('SELECT * FROM http_request_reservations').all()).results,before.results);assert.deepEqual(await db.prepare('SELECT * FROM http_check_jobs WHERE request_key=?').bind(oldKey).first(),oldJob);
 const html=large(512*1024),key=crypto.randomUUID();const packet=await acquireMaintenanceSource({sourceId:openai,requestKey:key},{enabled:true,db,send:async()=>response(html)});assert.equal(packet.source.raw.bytes.length,bytes(html).length);await verifyAcquiredSource(packet,{db});
 assert.equal((await db.prepare('SELECT actual_bytes FROM http_request_reservations WHERE request_key=?').bind(key).first()).actual_bytes,bytes(html).length);
 await assert.rejects(acquireMaintenanceSource({sourceId:openai,requestKey:key},{enabled:true,db,send:async()=>{throw Error('must not refetch');}}),{code:'adapter_existing_attempt_no_refetch'});
 const bad=crypto.randomUUID();await assert.rejects(acquireMaintenanceSource({sourceId:openai,requestKey:bad},{enabled:true,db,send:async()=>response('x'.repeat(1048577))}),{code:'body_too_large'});
 const job=await db.prepare('SELECT result FROM http_check_jobs WHERE request_key=?').bind(bad).first();const result=JSON.parse(job.result);assert.equal(result.error.bodyOverflow.complete,false);assert.equal(result.error.bodyOverflow.limitBytes,1048576);assert.equal((await db.prepare('SELECT actual_bytes FROM http_request_reservations WHERE request_key=?').bind(bad).first()).actual_bytes,null);
 await assert.rejects(db.prepare('UPDATE http_request_reservations SET actual_bytes=1048577 WHERE request_key=?').bind(key).run());
 }finally{await runtime.dispose();}
});
