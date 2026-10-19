import {test} from 'node:test';import assert from 'node:assert/strict';
import {createCloudflareProseAdapter,cloudflareProseModel,cloudflareProseLimits} from '../../src/maintenance-adapters/cloudflare-prose.ts';
import {MaintenanceBudget} from '../../src/wiki-bridge/maintenance-budget.ts';
import {demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
import {ledgerFixture,policy,control} from '../maintenance-currency/helpers.mjs';

const text='Controlled prose draft for editorial review only.';
const prosePolicy={...demonstrationPolicy,runCost:10240,dayCost:81920,monthCost:163840};
function currencyPolicy(){const now=Date.now();return policy({price:{id:'cloudflare-llama32-1b-rate-v1',provider:'cloudflare-workers-ai',model:cloudflareProseModel,tokenizer:'cloudflare-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:27000,outputPerMillion:201000,requestFee:0,validFrom:now-86400000,validUntil:now+86400000}});}
function adapter(db,overrides={}){return createCloudflareProseAdapter({enabled:true,ai:{async run(){return {response:text,usage:{input_tokens:12,output_tokens:12}};}},db,currency:control(currencyPolicy()),policy:prosePolicy,usageReader:value=>({inputTokens:value.input_tokens,outputTokens:value.output_tokens}),inputTokenUpperBound:prompt=>new TextEncoder().encode(prompt).byteLength,...overrides});}

test('Workers AI adapter pins the documented model contract and settles upper-bound reservation',async()=>{
 const f=await ledgerFixture('cloudflare-prose-success');try{const p=currencyPolicy();let calls=0;const prose=adapter(f.db,{currency:control(p),ai:{async run(model,request){calls++;assert.equal(model,cloudflareProseModel);assert.deepEqual(Object.keys(request).sort(),['max_tokens','prompt']);assert.equal(request.max_tokens,prosePolicy.maxOutputTokens);return {response:text,usage:{input_tokens:12,output_tokens:12}};}}});
  const result=await prose.generate('A short controlled prompt.');assert.equal(result.kind,'unverified-prose-draft');assert.equal(result.text,text);assert.equal(result.model,cloudflareProseModel);assert.equal(calls,1);
  const row=await new MaintenanceBudget(f.db,control(p)).job(result.eventId);assert.equal(row.state,'complete');assert.equal(row.currency_state,'settled');assert.equal(row.input_tokens,new TextEncoder().encode('A short controlled prompt.').byteLength);assert.ok(row.currency_actual<=row.currency_reserved);
  await assert.rejects(prose.generate('A short controlled prompt.'));assert.equal(calls,1);
 }finally{await f.close();}
});

test('disabled or missing usage configuration makes zero binding calls',async()=>{
 const f=await ledgerFixture('cloudflare-prose-disabled');try{let calls=0;const ai={async run(){calls++;return {response:text,usage:{input_tokens:30,output_tokens:12}};}};
  await assert.rejects(createCloudflareProseAdapter({ai,db:f.db,policy:prosePolicy,currency:control(currencyPolicy()),usageReader:value=>value,inputTokenUpperBound:value=>value.length}).generate('A short prompt.'),{code:'cloudflare_prose_disabled'});
  await assert.rejects(createCloudflareProseAdapter({enabled:true,ai,db:f.db,policy:prosePolicy,currency:control(currencyPolicy())}).generate('A short prompt.'),{code:'cloudflare_prose_usage_unconfigured'});
  assert.equal(calls,0);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM maintenance_proposals').first()).n,0);
 }finally{await f.close();}
});

test('bad or missing usage after dispatch retains maximum reservation and replay does not call binding',async()=>{
 const f=await ledgerFixture('cloudflare-prose-uncertain');try{let calls=0;const prose=adapter(f.db,{ai:{async run(){calls++;return {response:text,usage:{unknown_input:30,unknown_output:12}};}},usageReader:value=>{if(!Number.isSafeInteger(value?.input_tokens)||!Number.isSafeInteger(value?.output_tokens))throw Error('unknown_usage');return {inputTokens:value.input_tokens,outputTokens:value.output_tokens};}});
  await assert.rejects(prose.generate('A short controlled prompt.'));const row=await f.db.prepare("SELECT * FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first();assert.equal(row.state,'uncertain');assert.equal(row.currency_state,'uncertain');assert.equal(row.currency_actual,null);assert.ok(row.currency_reserved>0);assert.equal(calls,1);
  await f.restart();await assert.rejects(prose.generate('A short controlled prompt.'));assert.equal(calls,1);
 }finally{await f.close();}
});

test('prompt bytes and configured caps are bounded before provider dispatch',async()=>{
 const f=await ledgerFixture('cloudflare-prose-limits');try{let calls=0;const prose=adapter(f.db,{ai:{async run(){calls++;return {response:text,usage:{input_tokens:12,output_tokens:12}};}}});
  await assert.rejects(prose.generate('x'.repeat(cloudflareProseLimits.promptBytes+1)),{code:'cloudflare_prose_prompt_limit'});assert.equal(calls,0);
 }finally{await f.close();}
});
