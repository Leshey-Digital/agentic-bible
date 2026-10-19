import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {adminTrust,verifySignedAdmin} from '../../src/hosted/identity.ts';
import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {createJevDecisionAdapter} from '../../src/maintenance-adapters/jev.ts';
import {createJevDispatchPort} from '../../src/hosted/jev-dispatch.ts';

const origin='https://staging.agenticbible.si',path='/api/admin/jev/evaluate';
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const trustValue={issuer:'https://controlled-jev-issuer.invalid',audience:'controlled-jev-admin',assertionHeader:'cf-access-jwt-assertion',subjects:['controlled-jev-admin'],keys:[{...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'controlled-jev-key',alg:'RS256',use:'sig'}]};
const trust=adminTrust(JSON.stringify(trustValue));assert.ok(trust);
async function assertion(subject='controlled-jev-admin'){
  const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const signing=encode({alg:'RS256',kid:'controlled-jev-key',typ:'JWT'})+'.'+encode({iss:trustValue.issuer,aud:trustValue.audience,sub:subject,iat:now,exp:now+300});
  return signing+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(signing))).toString('base64url');
}
function request(token,body={content:'synthetic editorial text'},overrides={}){
  return new Request(origin+path,{method:'POST',headers:{Origin:origin,'X-Agentic-Bible-Request':'admin','Content-Type':'application/json','cf-access-jwt-assertion':token,...overrides.headers},body:JSON.stringify(body),...overrides});
}
const env={ASSETS:{fetch:async()=>new Response('assets')}};

test('Jev runtime route requires a valid signed admin and a configured server port before any transport or charge',async()=>{
  let calls=0;const runtime=createHostedRuntime({verifyAdmin:request=>verifySignedAdmin(request,trust),jevDispatch:{state:'configured',evaluate:async()=>{calls++;return {};}}});
  assert.equal((await runtime.fetch(request('invalid'),env)).status,403);
  const outsider=await assertion('outsider');assert.equal((await runtime.fetch(request(outsider),env)).status,403);
  const signed=await assertion();assert.equal((await runtime.fetch(request(signed,{content:'x',model:'caller-choice'}),env)).status,400);
  assert.equal((await runtime.fetch(request(signed,{content:'synthetic editorial text',extra:'x'}),env)).status,400);
  assert.equal((await runtime.fetch(request(signed,{content:'x'.repeat(16385)}),env)).status,413);
  assert.equal(calls,0);

  const unconfigured=createHostedRuntime({verifyAdmin:request=>verifySignedAdmin(request,trust),jevDispatch:createJevDispatchPort({enabled:true})});
  assert.equal((await unconfigured.fetch(request(signed),env)).status,503);
  assert.equal((await createHostedRuntime().fetch(request(signed),env)).status,503);
});

test('signed same-origin Jev evaluation reaches only the injected fake transport and returns advisory output',async()=>{
  let transports=0,reservations=0;const model='jev-1.14.0';
  const adapter=createJevDecisionAdapter({enabled:true,apiKey:'synthetic-jev-key-not-a-credential',model,transport:async(url,init)=>{
    transports++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
    const body=JSON.parse(init.body);assert.equal(body.model,model);assert.equal(body.state.untrusted,true);assert.equal(body.state.content,'synthetic editorial text');
    assert.equal(body.questions.needs_editorial_attention.type,'noul');
    return Response.json({model,answers:{needs_editorial_attention:{type:'noul',noul:0.25}},usage:{input_tokens:8,output_tokens:0}});
  },chargedExecution:{execute:async(_request,dispatch)=>{reservations++;await dispatch();}}});
  const expectedOwner='signed-admin:'+await (async()=>{const {createHash}=await import('node:crypto');return createHash('sha256').update(JSON.stringify({audience:trustValue.audience,issuer:trustValue.issuer,subject:'controlled-jev-admin'})+'\n').digest('hex');})();
  const runtime=createHostedRuntime({verifyAdmin:request=>verifySignedAdmin(request,trust),jevDispatch:{state:'configured',evaluate:(content,ownerRef,signal)=>{assert.equal(ownerRef,expectedOwner);return adapter.evaluate(content,signal);}}}),signed=await assertion();
  const response=await runtime.fetch(request(signed),env);assert.equal(response.status,200);const value=await response.json();
  assert.deepEqual(value.decision,{capability:'structured-decision',advisoryOnly:true,model,answers:{needs_editorial_attention:{type:'noul',noul:0.25}},usage:{inputTokens:8,outputTokens:0}});
  assert.equal(reservations,1);assert.equal(transports,1);assert.doesNotMatch(JSON.stringify(value),/synthetic editorial text|synthetic-jev-key/);
  const crossSite=await runtime.fetch(request(signed,{content:'synthetic editorial text'},{headers:{'Sec-Fetch-Site':'cross-site'}}),env);assert.equal(crossSite.status,403);assert.equal(transports,1);
  const wrongOrigin=await runtime.fetch(request(signed,{content:'synthetic editorial text'},{headers:{Origin:'https://attacker.invalid'}}),env);assert.equal(wrongOrigin.status,403);assert.equal(transports,1);
  const unexpected=createHostedRuntime({verifyAdmin:request=>verifySignedAdmin(request,trust),jevDispatch:{state:'configured',evaluate:async()=>({capability:'structured-decision',advisoryOnly:true,secret:'must-not-be-projected'})}});
  const rejected=await unexpected.fetch(request(signed),env);assert.equal(rejected.status,503);assert.doesNotMatch(await rejected.text(),/must-not-be-projected/);
});

test('one failed synthetic Jev dispatch is redacted and never automatically retried',async()=>{
  let attempts=0;const adapter=createJevDecisionAdapter({enabled:true,apiKey:'synthetic-jev-test-key',model:'jev-1.14.0',transport:async()=>{attempts++;throw Error('synthetic credential and response detail');},chargedExecution:{execute:async(_charge,dispatch)=>{await dispatch();}}});
  await assert.rejects(adapter.evaluate('synthetic bounded test'),error=>error.code==='jev_transport_failed'&&!error.message.includes('synthetic credential'));
  assert.equal(attempts,1);
});
