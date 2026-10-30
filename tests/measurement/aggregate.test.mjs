import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecorder,aggregatePreview} from '../../src/measurement/aggregate.ts';
const base={origin:'https://agenticbible.si',pathname:'/',consent:'granted'};
const now=()=>Date.UTC(2026,9,30,21);
function fixture(enabled=true){const aggregate=aggregatePreview();return {aggregate,record:createRecorder({enabled,origin:base.origin,sink:aggregate.sink,now})};}
test('explicit enablement, current consent and origin are required; private/unknown/query paths fail closed',()=>{
 const f=fixture(false);assert.equal(f.record({event:'page_view'},base),false);
 for(const context of [{...base,consent:'denied'},{...base,dnt:'1'},{...base,gpc:true},{...base,origin:'https://staging.agenticbible.si'},...['/admin/','/api/admin/settings','/articles/not-published/','/?email=private','/search/#q=private','/favicon.svg'].map(pathname=>({...base,pathname}))])assert.equal(fixture().record({event:'page_view'},context),false);
 assert.deepEqual(f.aggregate.snapshot(),[]);
});
test('event contracts reject raw queries, errors, proposal text and identifiers rather than retaining them',()=>{
 const f=fixture();
 for(const signal of [{event:'page_view',ip:'192.0.2.1'},{event:'search_complete',results:'few',expanded:false,query:'private text'},{event:'reader_error',component:'search',message:'token=private'},{event:'contribution_result',outcome:'saved',reference:'private'},null,[],{event:'search_select',article:'private'}])assert.equal(f.record(signal,{...base,pathname:'/search/'}),false);
 assert.deepEqual(f.aggregate.snapshot(),[]);
 assert.equal(f.record({event:'search_complete',results:'none',expanded:false},{...base,pathname:'/search/'}),true);
 assert.equal(f.record({event:'search_select',article:'tool-use'},{...base,pathname:'/search/'}),true);
 assert.equal(f.record({event:'contribution_result',outcome:'unconfirmed'},{...base,pathname:'/contribute/'}),true);
 assert.deepEqual(Object.keys(f.aggregate.snapshot()[0].measurement).sort(),['day','page','schemaVersion','signal']);
 assert.equal(f.aggregate.snapshot()[0].measurement.day,'2026-10-30');
});
test('coercible objects cannot cross enum fields into a sink',()=>{
 const rows=[],record=createRecorder({enabled:true,origin:base.origin,sink:row=>rows.push(row),now});
 assert.equal(record({event:'search_complete',results:{toString:()=> 'none',private:'raw'},expanded:false},{...base,pathname:'/search/'}),false);
 assert.equal(record({event:'contribution_result',outcome:{toString:()=> 'saved',private:'raw'}},{...base,pathname:'/contribute/'}),false);
 assert.deepEqual(rows,[]);
});
test('revocation is immediate, events stay on their own route and failures do not cause retries',()=>{
 const f=fixture();assert.equal(f.record({event:'page_view'},base),true);
 assert.equal(f.record({event:'page_view'},{...base,consent:'denied'}),false);
 assert.equal(f.record({event:'search_complete',results:'few',expanded:true},base),false);
 assert.equal(f.record({event:'reader_error',component:'search'},base),false);
 let calls=0;const record=createRecorder({enabled:true,origin:base.origin,now,sink:()=>{++calls;throw Error('unknown sink outcome');}});
 assert.doesNotThrow(()=>record({event:'page_view'},base));record({event:'page_view'},base);assert.equal(calls,1);
});
test('finite page budget and immutable aggregate snapshots; events are not unique visitors',()=>{
 const f=fixture();for(let i=0;i<40;i++)assert.equal(f.record({event:'page_view'},base),i<32);
 const snapshot=f.aggregate.snapshot();assert.equal(snapshot[0].count,32);snapshot[0].count=1000;snapshot[0].measurement.page='/private/';
 assert.equal(f.aggregate.snapshot()[0].count,32);assert.equal(f.aggregate.snapshot()[0].measurement.page,'/');
 for(const instant of [NaN,-1,Infinity])assert.equal(createRecorder({enabled:true,origin:base.origin,sink:()=>assert.fail(),now:()=>instant})({event:'page_view'},base),false);
});
test('unsupported async sink is consumed as unknown and stops without another dispatch',async()=>{
 let calls=0;const record=createRecorder({enabled:true,origin:base.origin,now,sink:async()=>{++calls;throw Error('unknown outcome');}});
 assert.equal(record({event:'page_view'},base),false);assert.equal(record({event:'page_view'},base),false);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
});
