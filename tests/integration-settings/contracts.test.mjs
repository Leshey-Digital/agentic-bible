import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntegrationSettingsContract,integrationLimits} from '../../src/integration-settings/contracts.ts';
import {hostedOrigin} from '../../src/hosted/identity.ts';
import {updateInput} from '../../src/settings/contracts.ts';

// Generated disposable signing material and invented nonfunctional credentials only.
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'disposable',alg:'RS256',use:'sig'};
const trust=JSON.stringify({issuer:'https://gateway.invalid',audience:'synthetic-app',assertionHeader:'cf-access-jwt-assertion',subjects:['owner-a','owner-b'],keys:[jwk]});
const secretA='disposable-integration-secret-alpha-000000';
const secretB='disposable-integration-secret-bravo-000000';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function assertion(subject='owner-a',claims={}){
  const now=Math.floor(Date.now()/1000),header=encode({alg:'RS256',kid:'disposable',typ:'JWT'}),body=encode({iss:'https://gateway.invalid',aud:'synthetic-app',sub:subject,iat:now,exp:now+300,...claims}),message=header+'.'+body;
  return message+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(message))).toString('base64url');
}
async function request(body,options={}){
  const headers={'cf-access-jwt-assertion':await assertion(options.subject,options.claims),'x-agentic-bible-request':'admin',origin:hostedOrigin,'content-type':'application/json',...options.headers};
  return new Request(options.url??hostedOrigin+'/unmounted-contract',{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
}
const command=(operation='configure',revision=0,secret=secretA)=>({operation,integration:'github-content',revision,requestKey:crypto.randomUUID(),...(operation==='test'?{}:{secret})});

// The ONLY storage implementation in this change. Each test creates a fresh,
// disposable memory transaction with isolated draft secret + metadata and rollback.
class MemoryStorage{
  metadata=null;secret=null;tail=Promise.resolve();failWrite=false;
  transaction(_id,work){
    const operation=this.tail.then(async()=>{
      let metadata=structuredClone(this.metadata),secret=this.secret;
      const value=await work({read:async()=>structuredClone(metadata),replaceSecret:async next=>{secret=next;},write:async next=>{if(this.failWrite)throw Error(secret);metadata=structuredClone(next);}});
      this.metadata=metadata;this.secret=secret;return value;
    });
    this.tail=operation.catch(()=>{});return operation;
  }
}
function setup(testConnection=async()=> 'connected',storage=new MemoryStorage()){
  return {storage,handle:createIntegrationSettingsContract({trust,storage,testConnection})};
}
async function invoke(handle,body,options){const response=await handle(await request(body,options)),text=await response.text();return {status:response.status,headers:response.headers,value:JSON.parse(text),text};}
function redacted(value,...secrets){const serialized=JSON.stringify(value);for(const secret of secrets)assert.equal(serialized.includes(secret),false);}

test('write-only configure and explicit rotate return constant masks with value-free audit',async()=>{
  const {handle,storage}=setup();const initial=await invoke(handle);assert.deepEqual(initial.value,{integration:'github-content',configured:false,maskedSecret:null,revision:0,connection:'never',audit:[]});
  const saved=await invoke(handle,command());assert.equal(saved.status,200);assert.equal(storage.secret,secretA);assert.equal(saved.value.maskedSecret,'********');
  const rotated=await invoke(handle,command('rotate',1,secretB));assert.equal(rotated.status,200);assert.equal(rotated.value.revision,2);assert.equal(storage.secret,secretB);
  const state=await invoke(handle);assert.deepEqual(state.value,rotated.value);redacted([saved,rotated,state,storage.metadata.audit],secretA,secretB);
  assert.equal(state.headers.get('cache-control'),'no-store');assert.equal(state.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Object.keys(state.value.audit[0]).sort(),['at','eventId','operation','result','revision']);
});

test('status and mask are independent of credential bytes and test success',async()=>{
  const first=setup(async()=> 'rejected'),second=setup();
  const a=await invoke(first.handle,command()),b=await invoke(second.handle,command('configure',0,secretB));
  const shape=v=>({...v,audit:v.audit.map(({eventId,at,...event})=>event)});
  assert.deepEqual(shape(a.value),shape(b.value));
  const checked=await invoke(first.handle,command('test',1));assert.equal(checked.value.connection,'rejected');assert.equal(checked.value.configured,true);assert.equal(checked.value.maskedSecret,'********');
});

test('requires real signatures, configured trust, approved subjects and exact write origin/CSRF',async()=>{
  const {handle,storage}=setup();
  for(const options of [
    {headers:{'cf-access-jwt-assertion':'unsigned.role.admin'}},
    {subject:'outsider'},
    {claims:{aud:'wrong'}},
    {claims:{iss:'https://other.invalid'}},
    {claims:{exp:Math.floor(Date.now()/1000)-1}},
    {headers:{origin:'https://attacker.invalid'}},
    {headers:{'x-agentic-bible-request':''}},
    {headers:{'sec-fetch-site':'cross-site'}},
    {url:'https://attacker.invalid/contract'},
  ])assert.equal((await invoke(handle,command(),options)).status,403);
  const forged=await request(command());const token=forged.headers.get('cf-access-jwt-assertion').split('.');token[1]=encode({sub:'owner-b',role:'admin'});forged.headers.set('cf-access-jwt-assertion',token.join('.'));assert.equal((await handle(forged)).status,403);
  const unconfigured=createIntegrationSettingsContract({trust:'{}',storage,testConnection:async()=> 'connected'});assert.equal((await invoke(unconfigured,command())).status,503);assert.equal(storage.metadata,null);
});

test('rejects unknown fields, credential fields in test commands and caller authority',async()=>{
  const {handle,storage}=setup();
  const invalid=[{...command(),role:'admin'},{...command(),csrfVerified:true},{...command(),ownerRef:'signed-admin:'+'a'.repeat(64)},{...command(),integration:'arbitrary-url'},{...command('test',0),secret:secretA},{...command(),secret:'short'},{...command(),secret:secretA+'\n'},{...command(),secret:'x'.repeat(integrationLimits.secretBytes+1)},{...command(),revision:-1}];
  for(const body of invalid){const response=await invoke(handle,body);assert.equal(response.status,400);redacted(response,secretA);}
  assert.equal(storage.metadata,null);
});

test('bounded streaming reader checks actual bytes, declared length, media type and malformed JSON',async()=>{
  const {handle,storage}=setup();
  assert.equal((await invoke(handle,command(),{headers:{'content-length':'9000'}})).status,413);
  assert.equal((await invoke(handle,command(),{headers:{'content-type':'text/plain'}})).status,415);
  const headers=(await request(command())).headers;headers.delete('content-length');
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(' '.repeat(4096)));controller.enqueue(new TextEncoder().encode(' '.repeat(4097)));controller.close();}});
  const oversized=await handle(new Request(hostedOrigin+'/contract',{method:'POST',headers,body:stream,duplex:'half'}));assert.equal(oversized.status,413);
  for(const body of ['{invalid',new Uint8Array([255]),'[]','null']){const response=await handle(new Request(hostedOrigin+'/contract',{method:'POST',headers,body}));assert.equal(response.status,400);redacted(await response.text(),secretA);}
  assert.equal(storage.metadata,null);
});

test('ownership, explicit rotation, stale revision and replay reject without credential changes',async()=>{
  const {handle,storage}=setup(),input=command();
  assert.equal((await invoke(handle,command('rotate',0))).status,409);
  assert.equal((await invoke(handle,input)).status,200);
  assert.equal((await invoke(handle,input)).value.error,'request_replayed');
  assert.equal((await invoke(handle,{...command('rotate',1,secretB),requestKey:input.requestKey})).value.error,'request_replayed');
  assert.equal((await invoke(handle,command('configure',1,secretB))).status,409);
  assert.equal((await invoke(handle,command('rotate',0,secretB))).value.error,'stale_revision');
  for(const body of [undefined,command('rotate',1,secretB),command('test',1)])assert.equal((await invoke(handle,body,{subject:'owner-b'})).status,403);
  assert.equal(storage.secret,secretA);assert.equal(storage.metadata.audit.length,1);
});

test('body deadline cancels a stalled stream and never mutates storage',async()=>{
  const {handle,storage}=setup();let cancelled=false;
  const headers=(await request(command())).headers;
  const stream=new ReadableStream({cancel(){cancelled=true;}});
  const response=await handle(new Request(hostedOrigin+'/contract',{method:'POST',headers,body:stream,duplex:'half'}));
  assert.equal(response.status,408);assert.equal(cancelled,true);assert.equal(storage.metadata,null);
});

test('atomic competing rotations have one winner and failed metadata write rolls back secret',async()=>{
  const {handle,storage}=setup();await invoke(handle,command());
  const responses=await Promise.all([invoke(handle,command('rotate',1,secretB)),invoke(handle,command('rotate',1,'disposable-third-credential-00000000'))]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(storage.metadata.revision,2);assert.equal(storage.metadata.audit.length,2);
  const retained=storage.secret;storage.failWrite=true;const failed=await invoke(handle,command('rotate',2,secretA));assert.equal(failed.status,503);redacted(failed,secretA,retained);assert.equal(storage.secret,retained);assert.equal(storage.metadata.revision,2);
});

test('connection tests accept only result enums and redact returned/error payloads',async()=>{
  for(const adapter of [async()=>({result:'connected',token:secretA}),async()=>secretA,async()=>{throw Error(secretA);},()=>{throw {error:secretA};}]){
    const {handle,storage}=setup(adapter);await invoke(handle,command());const response=await invoke(handle,command('test',1));assert.equal(response.status,200);assert.equal(response.value.connection,'unavailable');redacted([response,storage.metadata.audit],secretA);
  }
});

test('deadline aborts the test and bounds response without awaiting an uncooperative adapter',async()=>{
  let signal;const {handle,storage}=setup(async input=>{signal=input.signal;return new Promise(()=>{});});await invoke(handle,command());
  const start=performance.now(),response=await invoke(handle,command('test',1));assert.equal(response.status,200);assert.equal(response.value.connection,'timeout');assert.equal(signal.aborted,true);assert.ok(performance.now()-start<integrationLimits.testMs+1500);assert.equal(storage.metadata.testsUsed,1);redacted(response,secretA);
});

test('test reservation survives handler replacement; replay never dispatches twice',async()=>{
  let calls=0,release,started;const wait=new Promise(resolve=>{started=resolve;});const {handle,storage}=setup(async()=>{calls++;started();return new Promise(resolve=>{release=resolve;});});await invoke(handle,command());
  const input=command('test',1),pending=invoke(handle,input);await wait;
  const restarted=setup(async()=>{calls++;return 'connected';},storage).handle;
  assert.equal((await invoke(restarted,input)).value.error,'request_replayed');assert.equal((await invoke(restarted,command('test',1))).value.error,'test_in_progress');
  release('connected');assert.equal((await pending).value.connection,'connected');assert.equal(calls,1);
});

test('expiry queued before reservation response prevents dispatch and retains pending budget',async()=>{
  const storage=new MemoryStorage();let calls=0;const {handle}=setup(async()=>{calls++;return 'connected';},storage);
  await invoke(handle,command());const input=command('test',1),req=await request(input);
  const expiry=JSON.parse(Buffer.from(req.headers.get('cf-access-jwt-assertion').split('.')[1],'base64url')).exp*1000;
  const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
  const original=storage.transaction.bind(storage);
  storage.transaction=async(id,work)=>{const value=await original(id,work);if(storage.metadata.pendingTest)queueMicrotask(()=>{clock=expiry;});return value;};
  try{
    const response=await handle(req);assert.equal(response.status,403);assert.equal(calls,0);
    assert.equal(storage.metadata.lastTest,'pending');assert.equal(storage.metadata.testsUsed,1);assert.equal(storage.metadata.audit.length,2);assert.equal(storage.metadata.requestKeys.includes(input.requestKey),true);
  }finally{Date.now=realNow;}
});

test('an expiry microtask cannot run between dispatch freshness check and adapter invocation',async()=>{
  const storage=new MemoryStorage();let calls=0,expiredCalls=0,expiry;
  const {handle}=setup(async()=>{calls++;if(Date.now()>=expiry)expiredCalls++;return 'connected';},storage);
  await invoke(handle,command());const req=await request(command('test',1));
  expiry=JSON.parse(Buffer.from(req.headers.get('cf-access-jwt-assertion').split('.')[1],'base64url')).exp*1000;
  const realNow=Date.now;let clock=realNow(),scheduled=false;
  Date.now=()=>{if(storage.metadata.pendingTest&&!scheduled){scheduled=true;queueMicrotask(()=>{clock=expiry;});}return clock;};
  try{
    const response=await handle(req);assert.equal(scheduled,true);assert.equal(calls,1);assert.equal(expiredCalls,0);assert.equal(response.status,403);
    assert.equal(storage.metadata.lastTest,'pending');assert.equal(storage.metadata.testsUsed,1);assert.equal(storage.metadata.audit.length,2);
  }finally{Date.now=realNow;}
});

test('failed completion retains its reservation and cannot repeat provider work',async()=>{
  let calls=0;const storage=new MemoryStorage();
  const {handle}=setup(async()=>{calls++;storage.failWrite=true;return 'connected';},storage);
  await invoke(handle,command());const input=command('test',1),failed=await invoke(handle,input);
  assert.equal(failed.status,503);redacted(failed,secretA);assert.equal(storage.metadata.lastTest,'pending');assert.equal(storage.metadata.testsUsed,1);assert.equal(storage.metadata.audit.length,2);
  storage.failWrite=false;assert.equal((await invoke(handle,input)).value.error,'request_replayed');assert.equal(calls,1);
});

test('rotation during a test prevents stale completion from overwriting new status',async()=>{
  let release,started;const wait=new Promise(resolve=>{started=resolve;});const {handle,storage}=setup(async()=>{started();return new Promise(resolve=>{release=resolve;});});await invoke(handle,command());
  const pending=invoke(handle,command('test',1));await wait;const rotated=await invoke(handle,command('rotate',1,secretB));assert.equal(rotated.status,200);release('connected');assert.equal((await pending).value.error,'stale_revision');
  const state=await invoke(handle);assert.equal(state.value.revision,2);assert.equal(state.value.connection,'never');assert.equal(storage.secret,secretB);redacted(state,secretA,secretB);
});

test('connection quota and audit/request retention are finite and fail closed',async()=>{
  let calls=0;const {handle,storage}=setup(async()=>{calls++;return 'connected';});await invoke(handle,command());
  for(let i=0;i<integrationLimits.tests;i++)assert.equal((await invoke(handle,command('test',1))).status,200);
  assert.equal((await invoke(handle,command('test',1))).value.error,'capacity_reached');assert.equal(calls,integrationLimits.tests);
  while(storage.metadata.audit.length<integrationLimits.events)assert.equal((await invoke(handle,command('rotate',storage.metadata.revision))).status,200);
  const before=structuredClone(storage.metadata);assert.equal((await invoke(handle,command('rotate',before.revision))).value.error,'capacity_reached');assert.deepEqual(storage.metadata,before);
});

test('unexpected secret-bearing storage metadata and adapter errors never get projected',async()=>{
  const {handle,storage}=setup();await invoke(handle,command());storage.metadata.secret=secretA;
  const corrupt=await invoke(handle);assert.equal(corrupt.status,503);redacted(corrupt,secretA);
  const broken=setup(undefined,{transaction:async()=>{throw Error(secretA);}});const failed=await invoke(broken.handle);assert.deepEqual(failed.value,{error:'contract_unavailable'});redacted(failed,secretA);
});

test('analytics ID validation remains separate and rejects integration credential fields',()=>{
  const input={group:'google',version:1,requestKey:crypto.randomUUID(),values:{tagId:'',ga4Id:'',enabled:false,secret:secretA}};
  assert.throws(()=>updateInput(input));
});
