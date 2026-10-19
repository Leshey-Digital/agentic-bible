import test from 'node:test';
import assert from 'node:assert/strict';
import {createJevDispatchPort} from '../../src/hosted/jev-dispatch.ts';

const now=Date.now(),currency={enabled:true,policy:{schemaVersion:1,unit:'MICRO_USD',account:'test-owner',runLimit:10,dayLimit:20,monthLimit:30,dayBaseline:0,monthBaseline:0,price:{id:'test-price',provider:'typesafe',model:'jev-1.14.0',tokenizer:'typesafe-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:1,outputPerMillion:1,requestFee:0,validFrom:now-60000,validUntil:now+86400000}}};
const configured={enabled:true,credential:async()=>{throw Error('credential must not be read by this test');},model:'jev-1.14.0',db:{prepare(){}},currency,tokenBounds:{inputUpperBound:()=>1,outputUpperBound:()=>1},transport:async()=>{throw Error('provider must not be called by this test');}};

test('Jev orchestration fails closed without dependencies or explicit enablement and never reads a credential during status setup',async()=>{
  let credentialCalls=0,providerCalls=0;
  const incomplete=createJevDispatchPort({enabled:true});assert.equal(incomplete.state,'unconfigured');
  await assert.rejects(incomplete.evaluate('bounded synthetic text'),error=>error.code==='jev_orchestration_unconfigured');
  const disabled=createJevDispatchPort({...configured,enabled:false,credential:async()=>{credentialCalls++;return 'synthetic-key-with-no-provider-access';},transport:async()=>{providerCalls++;return Response.json({});}});
  assert.equal(disabled.state,'disabled');
  await assert.rejects(disabled.evaluate('bounded synthetic text'),error=>error.code==='jev_disabled');
  assert.equal(credentialCalls,0);assert.equal(providerCalls,0);
});

test('enabled Jev orchestration remains unconfigured when any charged-execution dependency is absent',()=>{
  for(const missing of ['credential','model','db','currency','tokenBounds','transport']){
    const options={...configured};delete options[missing];assert.equal(createJevDispatchPort(options).state,'unconfigured',missing);
  }
});

test('complete Jev orchestration is configured but secret-resolution errors are redacted before provider transport',async()=>{
  let providerCalls=0;const port=createJevDispatchPort({...configured,credential:async()=>{throw Error('private secret source detail');},transport:async()=>{providerCalls++;return Response.json({});}});
  assert.equal(port.state,'configured');
  await assert.rejects(port.evaluate('bounded synthetic text'),error=>error.code==='jev_secret_unavailable'&&!error.message.includes('private'));
  assert.equal(providerCalls,0);
});
