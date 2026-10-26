import test from 'node:test';
import assert from 'node:assert/strict';
import {setupRevisionPreview} from './revision-preview-fixture.mjs';
import {createModuleRuntime} from '../../src/hosted/module-runtime.ts';
import {trust,token} from './fixture.mjs';
import {hash} from '../../src/hosted/contracts.ts';
import {contributionAdminPage} from '../../src/hosted/contribution-admin.ts';

test('preview -> existing draft endpoint -> lost response reconciliation -> restart readback preserves exact article and never publishes',{timeout:30000},async()=>{
 const t=await setupRevisionPreview({drafts:true});try{
  const before=t.f.gh.state.calls.length,preview=(await t.preview()).value;assert.equal(t.f.gh.state.calls.length,before);
  t.f.gh.state.lost='/pulls';
  const propose=()=>t.request('/api/admin/corrections/github-proposal',{approvalId:t.review.approvalId});
  const lost=await propose();assert.equal(lost.status,503);assert.equal(lost.value.published,false);assert.equal(t.f.gh.state.pulls.length,1);
  assert.equal((await t.request(t.path+'/reviews')).value.items[0].proposal.state,'outcome-unconfirmed');
  await t.f.restart();const result=await propose();assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.value.markdownSha256,preview.markdownSha256);assert.equal(result.value.published,false);
  assert.equal(t.f.gh.state.pulls.length,1);const calls=t.f.gh.state.calls.length;assert.deepEqual((await propose()).value,result.value);assert.equal(t.f.gh.state.calls.length,calls);
  const tree=t.f.gh.state.trees.get(t.f.gh.state.commits.get(result.value.headCommit).tree.sha);assert.equal(tree[preview.contentPath],preview.markdown);assert.equal(tree['unrelated.txt'],'Must stay unchanged.');assert.equal(t.f.gh.state.main,t.review.baseCommit);
  assert.ok(t.f.gh.state.calls.every(call=>['GET','POST'].includes(call.method)&&!call.path.includes('/merge')));assert.equal((await t.request(t.path+'/reviews')).value.items[0].proposal.state,'draft-recorded');
  assert.equal((await t.request('/api/admin/corrections/revoke',{approvalId:t.review.approvalId})).status,200);
  assert.equal((await propose()).status,503);assert.equal(t.f.gh.state.calls.length,calls);assert.equal(t.f.gh.state.pulls.length,1);assert.equal(t.f.gh.state.main,t.review.baseCommit);
  assert.equal((await t.request(t.path+'/reviews')).value.items[0].approvalState,'revoked');
 }finally{await t.f.close();}
});
for(const mode of ['stale-main','foreign-branch'])test('preview draft fails closed on '+mode+' without overwriting canonical or conflicting branches',{timeout:30000},async()=>{
 const t=await setupRevisionPreview({drafts:true});try{
  assert.equal((await t.preview()).status,200);const branch='content-corrections/'+t.review.approvalId;
  if(mode==='stale-main')t.f.gh.state.main='c'.repeat(40);else t.f.gh.state.refs.set(branch,t.review.baseCommit);
  const before=t.f.gh.state.main,result=await t.request('/api/admin/corrections/github-proposal',{approvalId:t.review.approvalId});
  assert.equal(result.status,409);assert.equal(result.value.error,mode==='stale-main'?'stale_github_base':'github_foreign_branch');assert.equal(t.f.gh.state.pulls.length,0);assert.equal(t.f.gh.state.main,before);
  if(mode==='foreign-branch')assert.equal(t.f.gh.state.refs.get(branch),t.review.baseCommit);else assert.ok(t.f.gh.state.calls.every(call=>call.method==='GET'));
 }finally{await t.f.close();}
});
test('module composition retains immutable preview with configured transport; unavailable UI cannot request a draft',{timeout:30000},async()=>{
 const t=await setupRevisionPreview();try{
  const app=createModuleRuntime({fetch:async()=>new Response('controlled asset')},{commit:t.review.baseCommit,articles:{'tool-use':{markdown:t.markdown,sha256:await hash(t.markdown)}}});
  const response=await app.fetch(new Request('https://staging.agenticbible.si'+t.path+'/revision-preview',{method:'POST',headers:{Origin:'https://staging.agenticbible.si','Content-Type':'application/json','X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':await token()},body:JSON.stringify({approvalId:t.review.approvalId})}),{EDITORIAL_DB:t.f.db,HOSTED_PRIVATE_INBOX:'enabled',HOSTED_ADMIN_TRUST:JSON.stringify(trust),GITHUB_CONTENT_TOKEN:'synthetic-only-credential'});
  assert.equal(response.status,200);assert.equal((await response.json()).baseCommit,t.review.baseCommit);assert.equal(t.f.counts.outbound,0);
  assert.ok(contributionAdminPage(true).includes('id="request-revision-draft"'));assert.ok(!contributionAdminPage(false).includes('id="request-revision-draft"'));
 }finally{await t.f.close();}
});
