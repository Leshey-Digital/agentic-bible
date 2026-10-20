import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,input} from './fixture.mjs';
import {D1EditorialStore} from '../../src/editorial/store.ts';

test('explicit private inbox completes review and draft readback with public intake closed',async()=>{
 const f=await fixture({shipped:true,runtimeBindings:{HOSTED_PRIVATE_INBOX:'enabled'}});try{
  const publicBefore=await f.request('/api/submissions',input());assert.equal(publicBefore.status,503);
  assert.equal((await f.request('/api/admin/submissions')).status,200);
  const seeded=await new D1EditorialStore(f.db).submit(input('tool-use','Synthetic private staging fixture with a source claim ready for editorial review.'),'synthetic-private-fixture',Date.now());const path='/api/admin/submissions/'+seeded.id;
  assert.equal((await f.request('/admin/contributions/')).status,200);
  assert.equal((await f.request('/api/admin/submissions',undefined,{headers:{'cf-access-jwt-assertion':''}})).status,403);
  assert.equal((await f.request(path,{status:'follow-up',tags:'private-review',version:1},{method:'PATCH'})).status,200);
  const source=(await f.request(path+'/source')).value,approvalId=crypto.randomUUID();assert.equal((await f.request(path+'/review',{approvalId,submissionRevision:2,baseCommit:source.baseCommit,baseMarkdownSha256:source.baseMarkdownSha256,note:'Synthetic private editorial correction preserves the cited tool evidence and never opens anonymous intake.',citationId:'openai',confirm:'reviewed'})).status,200);
  const proposal=await f.request('/api/admin/corrections/github-proposal',{approvalId});assert.equal(proposal.status,200);assert.equal(proposal.value.published,false);
  await f.restart();const history=await f.request(path+'/reviews');assert.equal(history.value.items[0].proposal.url,proposal.value.url);const calls=f.counts.outbound;
  assert.equal((await f.request('/api/submissions',input())).status,503);const status=(await f.request('/api/runtime/status')).value;assert.equal(status.contributionAdminConfigured,true);assert.equal(status.publicIntake,false);assert.equal(status.hostedCanonicalWrites,false);assert.equal(status.jevDispatchConfigured,false);assert.equal(f.counts.outbound,calls);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM submissions').first()).n,1);
 }finally{await f.close();}
});
test('private inbox opt-in is exact and cannot replace trusted identity',async()=>{
 for(const value of [undefined,'true','disabled',' enabled']){const f=await fixture({shipped:true,runtimeBindings:{HOSTED_PRIVATE_INBOX:value}});try{assert.equal((await f.request('/api/admin/submissions')).status,503);assert.equal((await f.request('/api/submissions',input())).status,503);}finally{await f.close();}}
 const f=await fixture({shipped:true,runtimeBindings:{HOSTED_PRIVATE_INBOX:'enabled',HOSTED_ADMIN_TRUST:'invalid'}});try{assert.equal((await f.request('/api/admin/submissions')).status,503);assert.equal((await f.request('/api/submissions',input())).status,503);}finally{await f.close();}
});

test('private inbox does not supply GitHub authority or bypass missing storage',async()=>{
 const f=await fixture({shipped:true,runtimeBindings:{HOSTED_PRIVATE_INBOX:'enabled',GITHUB_CONTENT_TOKEN:undefined}});try{
  const seeded=await new D1EditorialStore(f.db).submit(input(),'synthetic-private-fixture',Date.now());const path='/api/admin/submissions/'+seeded.id;
  assert.equal((await f.request('/api/admin/submissions')).status,200);assert.deepEqual((await f.request(path+'/reviews')).value.items,[]);
  assert.equal((await f.request(path+'/source')).status,503);assert.equal((await f.request('/api/admin/corrections/github-proposal',{approvalId:crypto.randomUUID()})).status,503);assert.equal(f.counts.outbound,0);
 }finally{await f.close();}
 const {configuredPorts}=await import('../../src/hosted/configuration.ts');const {trust}=await import('./fixture.mjs');assert.deepEqual(await configuredPorts({HOSTED_ADMIN_TRUST:JSON.stringify(trust),HOSTED_PRIVATE_INBOX:'enabled',ASSETS:{fetch:()=>new Response('synthetic')}}),{});
});
