import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vaultFixture} from './fixture.mjs';

test('explicit vault selection uses encrypted owner credential for one recoverable draft; inspections and completed replay stay offline',{timeout:30000},async()=>{
 const app=await vaultFixture();try{
  assert.equal((await app.configure()).status,200);
  assert.equal(JSON.stringify(await app.db.prepare('SELECT * FROM integration_vault').first()).includes(app.secret),false);
  for(const path of ['/api/runtime/status','/admin/integrations/','/api/admin/corrections/approvals']){
   const response=await app.dispatch(path,{headers:{'cf-access-jwt-assertion':await app.token(),'X-Agentic-Bible-Request':'admin'}});assert.equal(response.status,200);assert.ok(!(await response.text()).includes(app.secret));
  }
  assert.equal((await app.settings()).status,200);assert.equal(app.gh.state.calls.length,0);
  const foreign=await app.token({sub:app.trust.subjects[1]});assert.equal((await app.request('base',undefined,{token:foreign})).status,503);assert.equal(app.gh.state.calls.length,0);
  const base=await(await app.request('base')).json(),input=await app.input(base);assert.equal((await app.request('approvals',input)).status,200);
  app.gh.state.lost='/pulls';assert.equal((await app.request('github-proposal',{approvalId:input.approvalId})).status,503);assert.equal(app.gh.state.pulls.length,1);
  await app.restart();const response=await app.request('github-proposal',{approvalId:input.approvalId});assert.equal(response.status,200);const receipt=await response.json();assert.equal(receipt.published,false);assert.equal(receipt.branch,'content-corrections/'+input.approvalId);assert.equal(app.gh.state.pulls[0].draft,true);assert.equal(app.gh.state.main,app.gh.state.base);
  const count=app.gh.state.calls.length;assert.deepEqual(await(await app.request('github-proposal',{approvalId:input.approvalId})).json(),receipt);assert.equal(app.gh.state.calls.length,count);assert.equal(app.gh.state.pulls.length,1);
  assert.equal((await app.request('revoke',{approvalId:input.approvalId})).status,200);assert.equal((await app.request('github-proposal',{approvalId:input.approvalId})).status,503);assert.equal(app.gh.state.calls.length,count);
 }finally{await app.close();}
});

test('request-pinned revision fails closed after rotation; foreign owner, expired identity, cancellation and unsafe methods never dispatch',{timeout:30000},async()=>{
 const app=await vaultFixture();try{
  await app.configure();assert.equal((await app.probe('open')).status,200);const first=app.gh.state.calls.length;
  assert.equal((await app.configure(1)).status,200);assert.equal((await app.probe('send')).status,503);assert.equal(app.gh.state.calls.length,first);
  assert.equal((await app.probe('open')).status,200);const count=app.gh.state.calls.length;
  for(const body of [{deny:true},{aborted:true},{method:'PATCH'},{path:'/pulls/1/merge',method:'PUT'}])assert.equal((await app.probe('send',body)).status,503);
  assert.equal((await app.probe('open',{}, {sub:app.trust.subjects[1]})).status,503);
  assert.equal((await app.probe('open',{}, {exp:Math.floor(Date.now()/1000)-1})).status,503);assert.equal(app.gh.state.calls.length,count);
 }finally{await app.close();}
});

test('vault lock prevents rotation overtaking dispatch; stale source is never rebased',{timeout:30000},async()=>{
 const app=await vaultFixture();let release;try{
  await app.configure();let started;const begins=new Promise(r=>started=r),wait=new Promise(r=>release=r);app.gh.state.hold={started,wait};
  const pending=app.probe('open');await begins;assert.equal((await app.configure(1)).status,503);release();assert.equal((await pending).status,200);assert.equal((await app.configure(1)).status,200);
  const base=await(await app.request('base')).json(),input=await app.input(base);assert.equal((await app.request('approvals',input)).status,200);app.gh.state.main='c'.repeat(40);
  assert.equal((await app.request('github-proposal',{approvalId:input.approvalId})).status,409);assert.equal(app.gh.state.refs.size,0);assert.equal(app.gh.state.pulls.length,0);
 }finally{release?.();await app.close();}
});

test('disabled, invalid and conflicting selectors never fall back to a token binding',{timeout:30000},async()=>{
 for(const mode of ['disabled','typo','vault']){
  const app=await vaultFixture({GITHUB_DRAFT_CREDENTIAL_SOURCE:mode,GITHUB_CONTENT_TOKEN:'controlled-conflicting-token'});try{
   assert.equal((await app.configure()).status,200);assert.equal((await app.request('base')).status,503);const status=await(await app.dispatch('/api/runtime/status')).json();assert.equal(status.gitHubProposalsConfigured,false);assert.equal(app.gh.state.calls.length,0);
  }finally{await app.close();}
 }
});

 test('provider-revoked token fails on the explicit request without retry or fallback',{timeout:30000},async()=>{
 const app=await vaultFixture();try{
  await app.configure();app.gh.state.rejectCredential=true;assert.equal((await app.request('base')).status,503);assert.equal(app.gh.state.calls.length,1);assert.equal(app.gh.state.pulls.length,0);assert.equal(app.gh.state.refs.size,0);
  const response=await app.settings();assert.equal(response.status,200);assert.ok(!(await response.text()).includes(app.secret));assert.equal(app.gh.state.calls.length,1);
 }finally{await app.close();}
});
