import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredPorts} from '../../src/hosted/configuration.ts';
import {trust} from '../production-hosted/fixture.mjs';
import {demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
const currency=()=>({schemaVersion:1,unit:'MICRO_USD',account:'synthetic-owner',runLimit:1000,dayLimit:10000,monthLimit:18000000,dayBaseline:0,monthBaseline:0,price:{id:'synthetic-cloudflare',provider:'cloudflare-workers-ai',model:'@cf/meta/llama-3.2-1b-instruct',tokenizer:'cloudflare-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:27000,outputPerMillion:201000,requestFee:0,validFrom:Date.now()-60000,validUntil:Date.now()+86400000}});
const config=()=>({enabled:true,currency:currency(),policy:demonstrationPolicy});
const env=(changes={})=>({ASSETS:{fetch(){throw Error('no read on configuration');}},EDITORIAL_DB:{prepare(){throw Error('no DB on configuration');}},HOSTED_ADMIN_TRUST:JSON.stringify(trust),HOSTED_PRIVATE_INBOX:'enabled',AI:{run(){throw Error('no AI on configuration');}},CLOUDFLARE_DRAFT_POLICY:JSON.stringify(config()),...changes});
const reviewSource=async()=>{throw Error('no source on configuration');};
test('draft configuration requires private inbox, AI binding, immutable source and explicit bounded policy without I/O',async()=>{
 assert.equal((await configuredPorts(env(),undefined,reviewSource)).cloudflareDrafts.state,'configured');
 assert.equal((await configuredPorts(env({HOSTED_PRIVATE_INBOX:undefined}),undefined,reviewSource)).cloudflareDrafts,undefined);
 assert.equal((await configuredPorts(env(),undefined)).cloudflareDrafts,undefined);
 assert.equal((await configuredPorts(env({AI:undefined}),undefined,reviewSource)).cloudflareDrafts.state,'unconfigured');
 assert.equal((await configuredPorts(env({CLOUDFLARE_DRAFT_POLICY:undefined}),undefined,reviewSource)).cloudflareDrafts,undefined);
 const disabled=config();disabled.enabled=false;assert.equal((await configuredPorts(env({CLOUDFLARE_DRAFT_POLICY:JSON.stringify(disabled)}),undefined,reviewSource)).cloudflareDrafts.state,'disabled');
 const excessive=config();excessive.currency.monthLimit=21000000;assert.equal((await configuredPorts(env({CLOUDFLARE_DRAFT_POLICY:JSON.stringify(excessive)}),undefined,reviewSource)).cloudflareDrafts.state,'unconfigured');
});
