import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredPorts} from '../../src/hosted/configuration.ts';

const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const trust=JSON.stringify({issuer:'https://synthetic-jev-config.invalid',audience:'synthetic-jev-config',assertionHeader:'cf-access-jwt-assertion',subjects:['synthetic-admin'],keys:[{...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic-jev-config',alg:'RS256',use:'sig'}]});
const policy=()=>({enabled:false,model:'jev-1.14.0',inputTokensPerByte:1,outputTokenUpperBound:2048,currency:{schemaVersion:1,unit:'MICRO_USD',account:'synthetic-owner',runLimit:10,dayLimit:20,monthLimit:30,dayBaseline:0,monthBaseline:0,price:{id:'synthetic-jev-price',provider:'typesafe',model:'jev-1.14.0',tokenizer:'typesafe-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:1,outputPerMillion:0,requestFee:0,validFrom:Date.now()-60000,validUntil:Date.now()+86400000}}});
const env=(changes={})=>({ASSETS:{fetch:async()=>new Response()},EDITORIAL_DB:{prepare(){throw Error('synthetic DB must not be touched while configuring ports');}},HOSTED_ADMIN_TRUST:trust,INTEGRATION_VAULT_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),INTEGRATION_VAULT_KEY_ID:'synthetic-config-v1',JEV_DISPATCH_POLICY:JSON.stringify(policy()),...changes});

test('configuredPorts mounts only an explicitly complete, but disabled, owner-bound Jev port',async()=>{
  const ports=await configuredPorts(env());assert.equal(ports.jevDispatch?.state,'disabled');assert.equal(typeof ports.integrationSettings?.resolveJevCredential,'function');
  assert.equal((await configuredPorts(env({INTEGRATION_VAULT_KEY:undefined}))).jevDispatch,undefined);
  assert.equal((await configuredPorts(env({JEV_DISPATCH_POLICY:undefined}))).jevDispatch,undefined);
  const excessive=policy();excessive.enabled=true;excessive.currency.monthLimit=21000000;assert.equal((await configuredPorts(env({JEV_DISPATCH_POLICY:JSON.stringify(excessive)}))).jevDispatch,undefined);
  const invalid=policy();invalid.model='caller-selectable';assert.equal((await configuredPorts(env({JEV_DISPATCH_POLICY:JSON.stringify(invalid)}))).jevDispatch,undefined);
  const wrongPrice=policy();wrongPrice.currency.price.model='jev-1.13.0';assert.equal((await configuredPorts(env({JEV_DISPATCH_POLICY:JSON.stringify(wrongPrice)}))).jevDispatch?.state,'unconfigured');
});
