import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createMeasurementCollector,measurementPolicy,analyticsEngineTransport,d1MeasurementQuota,configuredMeasurement,measurementRuntime} from '../../src/measurement/collector.ts';
const at=Date.UTC(2026,9,30,12),policy=measurementPolicy(JSON.stringify({schemaVersion:1,enabled:true,policyRevision:'aggregate-v1',origin:'https://agenticbible.si',hourEvents:1000,monthEvents:100000}));
const event={page:'/search/',signal:{event:'search_complete',results:'none',expanded:false}},batch=(events=[event])=>({schemaVersion:1,policyRevision:'aggregate-v1',consent:'granted',events});
function req(value=batch(),headers={},init={}){return new Request('https://agenticbible.si/api/measurement',{method:'POST',headers:{Origin:'https://agenticbible.si','Content-Type':'application/json',...headers},body:JSON.stringify(value),...init});}
function fixture(overrides={}){const points=[],claims=[];const collector=createMeasurementCollector({policy,quota:{async reserve(v){claims.push(v);return true;}},transport:analyticsEngineTransport({writeDataPoint(p){points.push(p);}}),now:()=>at,...overrides});return {collector,points,claims};}
async function dbFixture(){const mf=new Miniflare({...convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fixture");}}',compatibilityDate:'2026-10-16',d1Databases:{QUOTA:'controlled-measurement-quota'}}),cf:false});const db=await mf.getD1Database('QUOTA');await db.prepare(readFileSync('measurement-migrations/0001_aggregate_quota.sql','utf8')).run();return {db,close:()=>mf.dispose()};}
test('disabled and incomplete configuration never calls quota/provider; runtime wrapper preserves assets',async()=>{
 for(const opts of [{},{policy},{policy,quota:{reserve(){throw Error('forbidden');}}}])assert.equal((await createMeasurementCollector(opts)(req())).status,503);
 assert.equal((await configuredMeasurement({EDITORIAL_DB:{prepare(){throw Error('no editorial fallback');}}})(req())).status,503);
 const wrapper=measurementRuntime({fetch:async()=>new Response('reader')});assert.equal(await(await wrapper.fetch(new Request('https://agenticbible.si/'))).text(),'reader');assert.equal((await wrapper.fetch(req())).status,503);
 for(const raw of [undefined,'{}',JSON.stringify({...policy,enabled:false}),JSON.stringify({...policy,origin:'https://staging.agenticbible.si'}),JSON.stringify({...policy,monthEvents:100001}),JSON.stringify({...policy,extra:'secret'})])assert.equal(measurementPolicy(raw),undefined);
});
test('consent, browser opt-outs, origin/method/schema/private routes fail before quota and contain no echo',async()=>{
 const f=fixture();for(const bad of [{...batch(),consent:'denied'},{...batch(),schemaVersion:2},{...batch(),policyRevision:'changed'}, {...batch(),userId:'secret'},batch([{...event,page:'/admin/'}]),batch([{...event,page:'/search/?q=private'}]),batch([{...event,signal:{...event.signal,query:'private'}}]),batch([{...event,signal:{event:'reader_error',component:'search',message:'secret'}}]),batch([event,{...event,page:'/unknown/'}])]){const r=await f.collector(req(bad));assert.equal(r.status,400);assert.ok(!(await r.text()).includes('private'));}
 for(const headers of [{Origin:'https://other.example'},{DNT:'1'},{'Sec-GPC':'1'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.collector(req(batch(),headers))).status,403);
 assert.equal((await f.collector(new Request('https://agenticbible.si/api/measurement',{headers:{Origin:'https://agenticbible.si'}}))).status,405);assert.equal(f.points.length,0);assert.equal(f.claims.length,0);
});
test('strict streamed byte/count/encoding limits reject without partial collection',async()=>{
 const f=fixture();for(const r of [req(batch(Array(9).fill(event))),req({...batch(),unknown:'x'.repeat(5000)}),req(batch(),{'Content-Encoding':'gzip'}),req(batch(),{'Content-Type':'text/plain'}),req(batch(),{'Content-Length':'-1'}),req(batch(),{'Content-Length':'99999'})])assert.equal((await f.collector(r)).status,400);
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array([255]));c.close();}});assert.equal((await f.collector(req(null,{}, {body:stream,duplex:'half'}))).status,400);
 assert.equal(f.claims.length,0);assert.equal(f.points.length,0);
});
test('never-ending streamed request is stopped by the original two-second read bound',{timeout:5000},async()=>{
 const f=fixture(),started=performance.now(),stream=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){return new Promise(()=>{});}});assert.equal((await f.collector(req(null,{}, {body:stream,duplex:'half'}))).status,400);assert.ok(performance.now()-started<3000);assert.equal(f.claims.length,0);
});
test('only finite projections/counts reach native binding,202 does not claim durable ingestion',async()=>{
 const f=fixture(),r=await f.collector(req(batch([event,event,{page:'/articles/tool-use/',signal:{event:'page_view'}}])));assert.equal(r.status,202);assert.deepEqual(await r.json(),{schemaVersion:1,state:'submitted_unconfirmed'});assert.equal(f.claims[0].events,3);assert.deepEqual(f.points,[{blobs:['1','2026-10-30','/search/','search_complete','none','','0'],doubles:[2],indexes:['/search/']},{blobs:['1','2026-10-30','/articles/tool-use/','page_view','','','0'],doubles:[1],indexes:['/articles/tool-use/']}]);
 assert.throws(()=>analyticsEngineTransport({writeDataPoint(){assert.fail();}}).submit({schemaVersion:1,day:'2026-10-30',page:'/search/',signal:{...event.signal,query:'secret'}},1));
 for(const value of [{page:{toString:()=>'/search/'}},{day:{toString:()=>'2026-10-30'}}])assert.throws(()=>analyticsEngineTransport({writeDataPoint(){assert.fail();}}).submit({schemaVersion:1,day:'2026-10-30',page:'/search/',signal:event.signal,...value},1));
});
test('actual D1 atomic hourly/monthly cap survives concurrency and backward clock without identities',{timeout:30000},async()=>{
 const f=await dbFixture();try{let now=at;const p={...policy,hourEvents:8,monthEvents:9},points=[],collect=createMeasurementCollector({policy:p,quota:d1MeasurementQuota(f.db),transport:analyticsEngineTransport({writeDataPoint(p){points.push(p);}}),now:()=>now});
 const results=await Promise.all(Array.from({length:16},()=>collect(req())));assert.equal(results.filter(r=>r.status===202).length,8);assert.equal(results.filter(r=>r.status===429).length,8);assert.equal(points.length,8);
 now+=3600000;assert.equal((await collect(req())).status,202);assert.equal((await collect(req())).status,429);now=at;assert.equal((await collect(req())).status,429);
 const row=await f.db.prepare('SELECT * FROM public_measurement_quota').first();assert.equal(row.month_events,9);assert.deepEqual(Object.keys(row).sort(),['high_water','hour','hour_events','month','month_events','policy_revision','singleton']);
 }finally{await f.close();}
});
test('lost quota response or partially dispatched failure retains all allowance, never retries',{timeout:30000},async()=>{
 const f=await dbFixture();try{const quota=d1MeasurementQuota(f.db),p={...policy,hourEvents:8,monthEvents:8};let calls=0;
 const lost=createMeasurementCollector({policy:p,quota:{async reserve(v){await quota.reserve(v);throw Error('lost reply');}},transport:{submit(){calls++;}},now:()=>at});assert.equal((await lost(req(batch([event,event])))).status,503);assert.equal(calls,0);
 const unknown=createMeasurementCollector({policy:p,quota,transport:{submit(){calls++;throw Error('unknown provider');}},now:()=>at});assert.equal((await unknown(req(batch([event,{page:'/',signal:{event:'page_view'}}])))).status,503);assert.equal(calls,1);assert.equal((await f.db.prepare('SELECT month_events n FROM public_measurement_quota').first()).n,4);
 assert.equal((await createMeasurementCollector({policy:p,quota,transport:analyticsEngineTransport({writeDataPoint(){calls++;return Promise.reject(Error('unknown'));}}),now:()=>at})(req())).status,503);assert.equal(calls,2);assert.equal((await f.db.prepare('SELECT month_events n FROM public_measurement_quota').first()).n,5);
 }finally{await f.close();}
});
test('period rollover or clock reversal while quota response is awaited cannot dispatch',async()=>{
 for(const change of [3600000,-1]){let clock=at,calls=0;const collect=createMeasurementCollector({policy,quota:{async reserve(){clock=at+change;return true;}},transport:{submit(){calls++;}},now:()=>clock});assert.equal((await collect(req())).status,503);assert.equal(calls,0);}
});
test('unconfirmed quota timeout cannot later dispatch even if admission completes',{timeout:5000},async()=>{
 let complete,calls=0;const hold=new Promise(r=>complete=r);const collect=createMeasurementCollector({policy,quota:{reserve(){return hold;}},transport:{submit(){calls++;}},now:()=>at});const response=await collect(req());assert.equal(response.status,503);complete(true);await Promise.resolve();assert.equal(calls,0);
});
test('actual hosted router exposes only explicitly configured minimized collection without editorial authority',{timeout:30000},async()=>{
 const {createHostedRuntime}=await import('../../src/hosted/worker.ts'),f=await dbFixture(),points=[];
 try{const env={ASSETS:{fetch(){throw Error('no assets needed');}},PUBLIC_MEASUREMENT_POLICY:JSON.stringify(policy),PUBLIC_MEASUREMENT_DB:f.db,PUBLIC_MEASUREMENT:{writeDataPoint(p){points.push(p);}},get EDITORIAL_DB(){throw Error('editorial authority not required or reused');}};
 assert.equal((await createHostedRuntime().fetch(req(),env)).status,202);assert.equal(points.length,1);const wrong=new Request('https://staging.agenticbible.si/api/measurement',{method:'POST',headers:{Origin:'https://staging.agenticbible.si','Content-Type':'application/json'},body:JSON.stringify(batch())});assert.equal((await createHostedRuntime().fetch(wrong,env)).status,403);assert.equal(points.length,1);
 }finally{await f.close();}
});
