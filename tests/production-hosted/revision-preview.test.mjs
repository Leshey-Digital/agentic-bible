import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {setupRevisionPreview} from './revision-preview-fixture.mjs';
import {input} from './fixture.mjs';
import {hash} from '../../src/hosted/contracts.ts';
import {lookupApproval,revokeApproval} from '../../src/hosted/approvals.ts';
import {projectNote} from '../../src/hosted/markdown.ts';
import {proposeGitHubCorrection} from '../../src/hosted/github.ts';
import {revisionAppendDiff} from '../../src/hosted/revision-preview.ts';
test('signed saved review becomes exact full article/diff offline; restart/replay and existing controlled proposal produce identical bytes',{timeout:30000},async()=>{
 const t=await setupRevisionPreview();try{
  assert.equal((await t.request('/api/submissions',input())).status,503);
  const before=await t.snapshot(),preview=await t.preview();assert.equal(preview.status,200,JSON.stringify(preview));const value=preview.value;
  assert.equal(value.kind,'reviewed-correction-revision-preview');assert.equal(value.published,false);assert.equal(value.articleChanged,false);assert.equal(value.remoteBaseChecked,false);assert.equal(value.approvedForPublication,false);assert.equal(value.submissionRevision,2);assert.equal(value.baseCommit,t.review.baseCommit);
  const note=await lookupApproval(t.f.db,t.review.approvalId,t.admin);assert.equal(value.markdown,await projectNote(t.markdown,note));assert.equal(value.markdownSha256,await hash(value.markdown));assert.ok(value.markdown.startsWith(t.markdown));assert.ok(value.markdown.includes(t.review.note.slice(0,-1)));assert.match(value.diff,/\+## Reviewed correction/);assert.ok(value.diff.includes(t.review.approvalId));
  assert.equal(await t.snapshot(),before);assert.equal(t.f.counts.outbound,0);assert.equal(t.f.gh.state.calls.length,0);
  await t.f.restart();assert.deepEqual((await t.preview()).value,value);assert.equal(await t.snapshot(),before);assert.equal(t.f.gh.state.calls.length,0);
  const proposed=await proposeGitHubCorrection(t.review.approvalId,t.admin,t.f.db,{approvedNote:(id,admin)=>lookupApproval(t.f.db,id,admin),sendGitHub:t.f.gh.send});assert.equal(proposed.markdownSha256,value.markdownSha256);const commit=t.f.gh.state.commits.get(proposed.headCommit);assert.equal(t.f.gh.state.trees.get(commit.tree.sha)[value.contentPath],value.markdown);assert.equal(proposed.published,false);
 }finally{await t.f.close();}
});
test('revision action requires exact owned current review and explicit same-origin authenticated POST',{timeout:30000},async()=>{
 const t=await setupRevisionPreview();try{const before=await t.snapshot();
  assert.equal((await t.preview({claims:{sub:'synthetic-other'}})).status,404);assert.equal((await t.preview({headers:{'cf-access-jwt-assertion':''}})).status,403);assert.equal((await t.preview({headers:{Origin:'https://foreign.invalid'}})).status,403);
  assert.equal((await t.request(t.path+'/revision-preview',undefined)).status,405);
  assert.equal((await t.request(t.path+'/revision-preview',{approvalId:t.review.approvalId,markdown:'fabricated article'})).status,400);
  assert.equal((await t.request('/api/admin/submissions/'+crypto.randomUUID()+'/revision-preview',{approvalId:t.review.approvalId})).status,404);
  assert.equal(await t.snapshot(),before);
  await t.request(t.path,{status:'follow-up',tags:'changed',version:2},{method:'PATCH'});assert.equal((await t.preview()).status,404);assert.equal(t.f.gh.state.calls.length,0);
 }finally{await t.f.close();}
});
test('changed source, delayed revocation, cancelled request and identity expiry cannot produce a revision',{timeout:30000},async()=>{
 const t=await setupRevisionPreview();const realNow=Date.now;try{
  const before=await t.snapshot();
  for(const mutate of [value=>({...value,baseCommit:'b'.repeat(40)}),value=>({...value,contentPath:'other.md'}),value=>({...value,sourceAuthority:'request'}),value=>({...value,citations:['invented']}),value=>({...value,markdown:value.markdown+'tampered'})]){t.transform(async value=>mutate(value));assert.notEqual((await t.preview()).status,200);}
  assert.equal(await t.snapshot(),before);
  const controller=new AbortController();t.transform(async value=>{controller.abort();return value;});assert.equal((await t.preview({signal:controller.signal})).status,403);
  t.transform(async value=>{const future=realNow()+600000;Date.now=()=>future;return value;});assert.equal((await t.preview()).status,403);Date.now=realNow;
  t.transform(async value=>{await revokeApproval(t.f.db,t.review.approvalId,t.admin);return value;});assert.equal((await t.preview()).status,409);assert.equal((await t.f.db.prepare('SELECT COUNT(*) n FROM github_content_proposals').first()).n,0);assert.equal(t.f.gh.state.calls.length,0);
 }finally{Date.now=realNow;await t.f.close();}
});
test('article diff applies exactly with or without a final source newline',()=>{
 const root=mkdtempSync(join(tmpdir(),'agentic-revision-diff-'));try{mkdirSync(join(root,'src/content/articles'),{recursive:true});const path='src/content/articles/tool-use.md';for(const base of ['first\nsecond\nthird\n','first\nsecond\nthird']){const proposed=base+'\n\n## Reviewed correction\n\nA deterministic original correction.\n',diff=revisionAppendDiff(base,proposed,path);writeFileSync(join(root,path),base);writeFileSync(join(root,'revision.patch'),diff);execFileSync('git',['apply','revision.patch'],{cwd:root});assert.equal(readFileSync(join(root,path),'utf8'),proposed);}}finally{rmSync(root,{recursive:true,force:true});}
});
