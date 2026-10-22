import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {adminTrust,verifySignedAdmin} from '../../src/hosted/identity.ts';
import {fixture,token,trust} from '../production-hosted/fixture.mjs';
const origin='https://staging.agenticbible.si';
const base='a'.repeat(40),articleHash='b'.repeat(64);
const selection=()=>({articleId:'tool-use',citationId:'openai',sourceId:'s-90f2bf11e4fb71c8f42ae128',requestKey:crypto.randomUUID()});
const generated={kind:'unverified-sourced-correction-draft',articleId:'tool-use',contentPath:'src/content/articles/tool-use.md',baseCommit:base,baseMarkdownSha256:articleHash,note:'Validate each requested action before executing the tool.',citationId:'openai',sources:[{url:'https://developers.openai.com/api/docs/guides/function-calling',rawHash:'c'.repeat(64),evidenceHash:'d'.repeat(64)}],promptSha256:'e'.repeat(64),responseSha256:'f'.repeat(64),generation:{eventId:'cfa-'+'a'.repeat(48)},approved:false,published:false,articleChanged:false};
async function setup(){
 const f=await fixture();let calls=0;
 const ports={verifyAdmin:request=>verifySignedAdmin(request,adminTrust(JSON.stringify(trust))),contributions:{trust:JSON.stringify(trust)},reviewSource:async()=>({articleId:'tool-use',contentPath:generated.contentPath,baseCommit:base,baseMarkdownSha256:articleHash,markdown:'Controlled pinned source.',citations:['openai'],sourceAuthority:'immutable-build',gitHubDraftAvailable:false}),cloudflareDrafts:{state:'configured',prepare:async()=>{calls++;return structuredClone(generated);}}};
 const env={EDITORIAL_DB:f.db,ASSETS:{fetch:async()=>new Response('asset')}};
 async function request(path,body,extra={}){const req=new Request(origin+path,{method:body===undefined?'GET':'POST',...extra,headers:{Origin:origin,'X-Agentic-Bible-Request':'admin','Content-Type':'application/json','cf-access-jwt-assertion':await token(),...extra.headers},body:body===undefined?undefined:JSON.stringify(body)});const response=await createHostedRuntime(ports).fetch(req,env);return {status:response.status,value:await response.text()};}
 return {f,ports,request,get calls(){return calls;},close:()=>f.close()};
}
test('Worker draft POST saves one labelled inbox row/audit, replay is offline, changed selection conflicts and ordinary review remains explicit',{timeout:30000},async()=>{
 const x=await setup();try{
  const input=selection(),saved=await x.request('/api/admin/drafts/cloudflare',input);assert.equal(saved.status,200,saved.value);const receipt=JSON.parse(saved.value);assert.equal(receipt.approved,false);assert.equal(receipt.published,false);assert.equal(x.calls,1);
  const row=await x.f.db.prepare('SELECT * FROM submissions WHERE id=?').bind(receipt.submissionId).first();assert.equal(row.status,'new');assert.deepEqual(JSON.parse(row.tags),['ai-draft','unverified']);assert.match(row.message,/UNVERIFIED AI DRAFT — NOT EDITORIAL APPROVAL/);assert.ok(row.message.includes(generated.generation.eventId));assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM editorial_audit WHERE submission_id=?').bind(row.id).first()).n,1);assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM hosted_reviewed_notes').first()).n,0);
  const replay=await x.request('/api/admin/drafts/cloudflare',input);assert.equal(replay.status,200);assert.equal(JSON.parse(replay.value).submissionId,row.id);assert.equal(JSON.parse(replay.value).duplicate,true);assert.equal(x.calls,1);
  assert.equal((await x.request('/api/admin/drafts/cloudflare',{...input,citationId:'other'})).status,409);assert.equal(x.calls,1);
  assert.equal((await x.request('/api/admin/submissions/'+row.id,{status:'follow-up',tags:'ai-draft, unverified',version:1},{method:'PATCH'})).status,200);
  const review=await x.request('/api/admin/submissions/'+row.id+'/review',{approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:base,baseMarkdownSha256:articleHash,note:generated.note,citationId:'openai',confirm:'reviewed'});assert.equal(review.status,200,review.value);assert.equal(JSON.parse(review.value).gitHubDraftAvailable,false);assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM hosted_reviewed_notes').first()).n,1);assert.equal(x.calls,1);assert.equal(x.f.counts.outbound,0);
 }finally{await x.close();}
});
test('private draft page and history reads are offline; unauthenticated, cross-site, wrong-method and unconfigured requests stay closed',{timeout:30000},async()=>{
 const x=await setup();try{
  const page=await x.request('/admin/drafts/');assert.equal(page.status,200);assert.match(page.value,/Prepare a sourced draft/);assert.equal((await x.request('/admin/drafts/app.js')).status,200);assert.equal((await x.request('/api/admin/submissions')).status,200);assert.equal((await x.request('/api/runtime/status')).status,200);
  assert.equal((await x.request('/api/admin/drafts/cloudflare')).status,405);assert.equal((await x.request('/api/admin/drafts/cloudflare',selection(),{headers:{'cf-access-jwt-assertion':''}})).status,403);assert.equal((await x.request('/api/admin/drafts/cloudflare',selection(),{headers:{Origin:'https://other.invalid'}})).status,403);assert.equal((await x.request('/admin/drafts/',undefined,{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  const enabledContributions=x.ports.contributions;delete x.ports.contributions;assert.equal((await x.request('/api/admin/drafts/cloudflare',selection())).status,503);assert.equal(x.calls,0);x.ports.contributions=enabledContributions;
  x.ports.cloudflareDrafts={state:'unconfigured',prepare:async()=>{throw Error('must not run');}};assert.equal((await x.request('/api/admin/drafts/cloudflare',selection())).status,503);assert.equal(x.calls,0);assert.equal(x.f.counts.outbound,0);
 }finally{await x.close();}
});
test('known full inbox rejects before invoking generation',{timeout:30000},async()=>{
 const x=await setup();try{
  await x.f.db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1000)
   INSERT INTO submissions(id,request_key,fingerprint,article_id,kind,message,source_url,last_event_id,created_at,updated_at)
   SELECT printf('00000000-0000-4000-8000-%012d',i),printf('10000000-0000-4000-8000-%012d',i),printf('controlled-capacity-%d',i),'tool-use','correction','Synthetic inbox capacity fixture only.','',printf('20000000-0000-4000-8000-%012d',i),1792523233000,1792523233000 FROM n`).run();
  const response=await x.request('/api/admin/drafts/cloudflare',selection());assert.equal(response.status,503);assert.equal(JSON.parse(response.value).error,'draft_inbox_capacity');assert.equal(x.calls,0);assert.equal(x.f.counts.outbound,0);
 }finally{await x.close();}
});
