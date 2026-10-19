import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createJevCurrencyAuthority} from '../../src/maintenance-adapters/jev-currency.ts';
import {createJevDecisionAdapter,jevEndpoint} from '../../src/maintenance-adapters/jev.ts';
import {MaintenanceBudget} from '../../src/wiki-bridge/maintenance-budget.ts';
import {ledgerFixture,policy,control} from '../maintenance-currency/helpers.mjs';

const model='jev-1.14.0',key='controlled-jevcurrency-secret-value';
function currencyPolicy(){const now=Date.now();return policy({price:{id:'typesafe-jev-rate-v1',provider:'typesafe',model,tokenizer:'typesafe-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:42000,outputPerMillion:0,requestFee:0,validFrom:now-86400000,validUntil:now+86400000}});}
function reply(usage={input_tokens:120,output_tokens:20}){return {model,answers:{needs_editorial_attention:{type:'noul',noul:0.25}},usage};}
function adapter(db,p,overrides={}){const authority=createJevCurrencyAuthority({enabled:true,currency:control(p),db,tokenBounds:{inputUpperBound:json=>new TextEncoder().encode(json).byteLength,outputUpperBound:()=>2048}});return createJevDecisionAdapter({enabled:true,apiKey:key,model,chargedExecution:authority,transport:async()=>Response.json(reply()),...overrides});}

test('Jev uses actual D1 maximum reservations, model-specific pricing and validated usage settlement',async()=>{
 const f=await ledgerFixture('jev-actual-charge');try{const p=currencyPolicy(),result=await adapter(f.db,p).evaluate('A controlled charge-bound request with bounded synthetic content.');
  assert.equal(result.advisoryOnly,true);const event='jev-'+(await f.db.prepare("SELECT event_id FROM maintenance_proposals WHERE event_id LIKE 'jev-%'").first()).event_id.slice(4);
  const row=await new MaintenanceBudget(f.db,control(p)).job(event);assert.equal(row.state,'complete');assert.equal(row.currency_state,'settled');
  assert.ok(row.currency_reserved>row.currency_actual);assert.equal(JSON.parse(row.currency_usage).inputTokens,120);assert.equal(JSON.parse(row.currency_usage).outputTokens,20);
  assert.equal(JSON.parse(row.currency_policy).price.provider,'typesafe');assert.equal(JSON.parse(row.currency_policy).price.model,model);
  await assert.rejects(adapter(f.db,p).evaluate('A controlled charge-bound request with bounded synthetic content.'),{code:'jev_charge_rejected'});
 }finally{await f.close();}
});

test('oversize Jev request and missing monetary authority fail before transport',async()=>{
 const f=await ledgerFixture('jev-charge-disabled');try{let calls=0;const disabled=createJevDecisionAdapter({enabled:true,apiKey:key,model,chargedExecution:createJevCurrencyAuthority({db:f.db,currency:control(currencyPolicy())}),transport:async()=>{calls++;return Response.json(reply());}});
  await assert.rejects(disabled.evaluate('A bounded request.'));assert.equal(calls,0);
  const bounded=adapter(f.db,currencyPolicy(),{transport:async()=>{calls++;return Response.json(reply());}});
  await assert.rejects(bounded.evaluate('x'.repeat(9000)),{code:'jev_charge_rejected'});assert.equal(calls,0);
 }finally{await f.close();}
});

test('invalid reported usage remains fully reserved and cannot be retried',async()=>{
 const f=await ledgerFixture('jev-charge-uncertain');try{const p=currencyPolicy();let calls=0;const charged=adapter(f.db,p,{transport:async(url,init)=>{calls++;assert.equal(url,jevEndpoint);return Response.json(reply({input_tokens:9000,output_tokens:20}));}});
  await assert.rejects(charged.evaluate('A controlled charge-bound request with bounded synthetic content.'));
  const row=await f.db.prepare("SELECT * FROM maintenance_proposals WHERE event_id LIKE 'jev-%'").first();assert.equal(row.state,'uncertain');assert.equal(row.currency_state,'uncertain');assert.ok(row.currency_reserved>0);assert.equal(row.currency_actual,null);assert.equal(calls,1);
  await f.restart();await assert.rejects(charged.evaluate('A controlled charge-bound request with bounded synthetic content.'),{code:'jev_charge_rejected'});assert.equal(calls,1);
 }finally{await f.close();}
});
