import test from 'node:test';
import assert from 'node:assert/strict';
import {trust as generatedTrust} from './fixture.mjs';
import {policyPath} from '../../src/hosted/policy.ts';
import {contributionJson,intakeConfigured} from '../../src/hosted/contributions.ts';
const origin='https://staging.agenticbible.si';
test('streamed body deadline, actual byte and UTF-8 bounds are independent of declared length',async()=>{
  let cancelled=false;const slow=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
  const before=Date.now();await assert.rejects(contributionJson(new Request(origin,{method:'POST',headers:{'Content-Type':'application/json'},body:slow,duplex:'half'})),error=>error.code==='body_timeout');assert.equal(cancelled,true);assert.ok(Date.now()-before<2000);
  for(const body of ['x'.repeat(8193),'é'.repeat(4097)])await assert.rejects(contributionJson(new Request(origin,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'1'},body})),error=>error.code==='body_too_large');
  await assert.rejects(contributionJson(new Request(origin,{method:'POST',headers:{'Content-Type':'application/json'},body:new Uint8Array([255])})),error=>error.code==='invalid_request');
});
test('only complete server policy shapes can nominate intake readiness',()=>{
  const policy={termsPath:'/future-terms/',privacyPath:'/future-privacy/',policyRevision:'future-owner-policy',moderationReady:true};const clientKey=async()=>null;const trust=JSON.stringify(generatedTrust);
  assert.equal(intakeConfigured({trust,policy,clientKey}),true);
  for(const value of [undefined,{trust:'unused'},{trust:'unused',policy,clientKey},{trust,policy},{trust,policy:{...policy,moderationReady:false},clientKey},{trust,policy:{...policy,termsPath:'https://attacker.invalid/'},clientKey}])assert.equal(intakeConfigured(value),false);
});

test('shared server/browser policy path guard rejects protocol-relative and normalization aliases',()=>{for(const path of ['//foreign/','/terms//','/../terms/','/%74erms/','https://foreign/','/terms/?x=1','/terms/#anchor'])assert.equal(policyPath(path),false,path);for(const path of ['/terms/','/contribution-terms/','/policies/contributions/'])assert.equal(policyPath(path),true,path);});
