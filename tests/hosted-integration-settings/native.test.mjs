import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {configuredPorts} from '../../src/hosted/configuration.ts';

const origin='https://staging.agenticbible.si',path='/api/admin/settings/integrations/github-content';
const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicKey={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'disposable-native',alg:'RS256',use:'sig'};
const trust=JSON.stringify({issuer:'https://native-gateway.invalid',audience:'disposable-settings',assertionHeader:'cf-access-jwt-assertion',subjects:['owner-a','owner-b'],keys:[publicKey]});
const secret='disposable-native-secret-not-a-credential',replacement='disposable-replacement-not-a-credential';
const bundles=await Promise.all(['tests/hosted-integration-settings/entry.ts','src/hosted/worker.ts'].map(entry=>build({entryPoints:[entry],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022'})));
async function assertion(subject='owner-a',claims={}){
  const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const input=encode({alg:'RS256',kid:'disposable-native',typ:'JWT'})+'.'+encode({iss:'https://native-gateway.invalid',aud:'disposable-settings',sub:subject,iat:now,exp:now+300,...claims});
  return input+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(input))).toString('base64url');
}
const command=(operation='configure',revision=0,value=secret)=>({integration:'github-content',operation,revision,requestKey:crypto.randomUUID(),...(operation==='test'?{}:{secret:value})});
async function fixture(shipped=false){
  const directory=mkdtempSync(join(git,'hosted-integration-settings-'));let assets=0,outbound=0;
  const bindings={TEST_SIGNED_TRUST:trust,HOSTED_ADMIN_TRUST:trust,GITHUB_CONTENT_TOKEN:secret,LOCAL_EDITORIAL_MODE:'synthetic-only',LOCAL_CORRECTIONS_MODE:'reviewed-notes',INTEGRATION_SETTINGS:'enabled',INTEGRATION_SETTINGS_STORAGE:'memory',integrationSettings:{trust,storage:'untrusted-env-data',testConnection:'enabled'}};
  const runtime=new Miniflare({...convertV4MiniflareOptions({modules:true,script:bundles[shipped?1:0].outputFiles[0].text,compatibilityDate:'2026-10-16',bindings,d1Databases:{EDITORIAL_DB:'disposable-settings-closed'},serviceBindings:{ASSETS:async()=>{assets++;return new Response('assets must not receive admin settings');}},outboundService:()=>{outbound++;throw Error('unexpected controlled outbound request');}}),cf:false,resourcePersistencePath:directory});
  async function request(body,options={}){
    const response=await runtime.dispatchFetch(options.url??origin+(options.path??path),{method:options.method??(body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',Origin:origin,'X-Agentic-Bible-Request':'admin','Cf-Access-Jwt-Assertion':await assertion(options.subject,options.claims),...options.headers},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();assert.equal(text.includes(secret),false);assert.equal(text.includes(replacement),false);
    assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('referrer-policy'),'same-origin');
    return {status:response.status,headers:response.headers,value:text?JSON.parse(text):null};
  }
  return {request,dispatch:(suffix)=>runtime.dispatchFetch(origin+suffix),close:async(expectedAssets=0)=>{await runtime.dispose();assert.equal(assets,expectedAssets);assert.equal(outbound,0);}};
}

test('actual shipped entrypoint stays closed with valid existing trust/D1/token and lookalike env/request flags',{timeout:20000},async()=>{
  const ports=await configuredPorts({HOSTED_ADMIN_TRUST:trust,GITHUB_CONTENT_TOKEN:secret,EDITORIAL_DB:{},integrationSettings:{trust,storage:'memory'}});
  assert.equal(Object.hasOwn(ports,'integrationSettings'),false);
  const app=await fixture(true);try{
    for(const body of [undefined,command(),command('test',1),{...command(),role:'admin',csrfVerified:true,integrationSettings:{enabled:true}}]){
      const response=await app.request(body,{headers:{Cookie:'ab_local_editorial='+'a'.repeat(64),'X-Role':'admin','X-Controlled-Admin':'test-admin','X-Integration-Settings':'enabled'}});
      assert.equal(response.status,503);assert.deepEqual(response.value,{error:'integration_settings_unconfigured'});
    }
  }finally{await app.close();}
});

test('exact route enforces path/origin/method boundaries without assets or adapter fallback',{timeout:20000},async()=>{
  const app=await fixture();try{
    for(const variant of [path+'/',path+'/extra',path.replace('github-content','other'),path.replace('github-content','github%2dcontent'),path.replace('github-content','%67ithub-content'),path.replace('github-content','github-content%2F'),path.replace('/api/','/%61pi/'),path.replace('/api/admin/','/api%2fadmin/'),path.replace('/settings/','%2fsettings/'),'/api/admin/settings','/api/admin/settings/integrations'])assert.equal((await app.request(command(),{path:variant})).status,503);
    assert.equal((await app.request(command(),{path:path+'?operation=configure'})).status,400);
    assert.equal((await app.request(command(),{url:'https://attacker.invalid'+path})).status,403);
    for(const method of ['PUT','PATCH','DELETE','OPTIONS','HEAD']){const response=await app.request(undefined,{method});assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET, POST');}
    const state=await app.request();assert.equal(state.status,200);assert.equal(state.value.configured,false);assert.equal(state.value.revision,0);
  }finally{await app.close();}
});

test('once-decoded namespace rejection leaves ordinary encoded assets and malformed encodings unchanged',{timeout:20000},async()=>{
  const app=await fixture();try{
    for(const suffix of ['/images/%61sset.svg','/images/%ZZ.svg']){
      const response=await app.dispatch(suffix);assert.equal(response.status,200);assert.equal(await response.text(),'assets must not receive admin settings');
    }
    assert.equal((await app.request(undefined,{path:'/api/admin/settings/%ZZ'})).status,503);
  }finally{await app.close(2);}
});

test('real workerd route rejects unsigned authority and forged legacy verifier/local identity',{timeout:20000},async()=>{
  const app=await fixture();try{
    for(const options of [
      {headers:{'Cf-Access-Jwt-Assertion':'unsigned-admin','X-Role':'admin',Cookie:'ab_local_editorial='+'a'.repeat(64)}},
      {subject:'outsider'},
      {claims:{aud:'foreign'}},
      {claims:{exp:Math.floor(Date.now()/1000)-1}},
      {headers:{Origin:'https://attacker.invalid'}},
      {headers:{'X-Agentic-Bible-Request':''}},
      {headers:{'Sec-Fetch-Site':'cross-site'}},
    ])assert.equal((await app.request(command(),options)).status,403);
    const token=await assertion(),parts=token.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
    assert.equal((await app.request(command(),{headers:{'Cf-Access-Jwt-Assertion':parts.join('.')}})).status,403);
    assert.equal((await app.request()).value.configured,false);
  }finally{await app.close();}
});

test('native signed configure/rotate preserves ownership, revision, replay and masked status',{timeout:20000},async()=>{
  const app=await fixture();try{
    const input=command(),configured=await app.request(input);assert.equal(configured.status,200);assert.equal(configured.value.configured,true);assert.equal(configured.value.maskedSecret,'********');assert.equal(configured.value.revision,1);
    for(const body of [undefined,command('rotate',1,replacement),command('test',1)])assert.equal((await app.request(body,{subject:'owner-b'})).status,403);
    assert.equal((await app.request(input)).value.error,'request_replayed');assert.equal((await app.request(command('rotate',0,replacement))).value.error,'stale_revision');
    const rotated=await app.request(command('rotate',1,replacement));assert.equal(rotated.status,200);assert.equal(rotated.value.revision,2);assert.equal(rotated.value.connection,'never');assert.equal(rotated.value.maskedSecret,'********');
    const state=await app.request();assert.deepEqual(state.value,rotated.value);assert.equal(state.value.audit.length,2);assert.deepEqual(Object.keys(state.value.audit[0]).sort(),['at','eventId','operation','result','revision']);
  }finally{await app.close();}
});

test('native route retains strict body fields/limits and bounds redacted adapter results/errors',{timeout:20000},async()=>{
  const app=await fixture();try{
    assert.equal((await app.request({...command(),ownerRef:'caller-authority'})).status,400);
    assert.equal((await app.request({...command(),secret:'x'.repeat(9000)})).status,413);
    assert.equal((await app.request(command())).status,200);
    assert.equal((await app.request({...command('test',1),secret})).status,400);
    const expected=['connected','unavailable','unavailable','rejected'];
    for(const connection of expected){const input=command('test',1),response=await app.request(input);assert.equal(response.status,200);assert.equal(response.value.connection,connection);assert.equal(response.value.configured,true);assert.equal((await app.request(input)).value.error,'request_replayed');}
    assert.equal((await app.request()).value.audit.length,9);
  }finally{await app.close();}
});
