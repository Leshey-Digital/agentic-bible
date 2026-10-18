import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,input} from './fixture.mjs';
import {articleIds} from '../../src/editorial/contracts.ts';
import {approved,hash} from '../../src/hosted/contracts.ts';
import {hostedTarget,sourceCitations} from '../../src/hosted/targets.ts';
import {projectNote} from '../../src/hosted/markdown.ts';
for(const articleId of articleIds)test('signed actual review and immutable draft target '+articleId,async()=>{
  const f=await fixture({articleId});try{
    const id=(await f.request('/api/submissions',input(articleId))).value.reference,path='/api/admin/submissions/'+id;
    assert.equal((await f.request(path,{status:'follow-up',tags:'source',version:1},{method:'PATCH'})).status,200);
    const source=await f.request(path+'/source');assert.equal(source.status,200);assert.equal(source.value.articleId,articleId);assert.equal(source.value.contentPath,hostedTarget(articleId).contentPath);assert.ok(source.value.citations.length);
    const review={approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:source.value.baseCommit,baseMarkdownSha256:source.value.baseMarkdownSha256,note:'Synthetic reviewed correction binds only the actual article, source hash, citation and current submission revision.',citationId:source.value.citations[0],confirm:'reviewed'};
    const saved=await f.request(path+'/review',review);assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.value.approval.schemaVersion,2);assert.equal(saved.value.approval.articleId,articleId);assert.equal(saved.value.approval.contentPath,source.value.contentPath);
    const proposed=await f.request('/api/admin/corrections/github-proposal',{approvalId:review.approvalId});assert.equal(proposed.status,200,JSON.stringify(proposed));assert.equal(proposed.value.schemaVersion,2);assert.equal(proposed.value.articleId,articleId);assert.equal(proposed.value.contentPath,source.value.contentPath);assert.equal(proposed.value.published,false);
    const tree=f.gh.state.trees.get(f.gh.state.commits.get(proposed.value.headCommit).tree.sha),baseline=f.gh.state.trees.get(f.gh.state.tree);
    for(const [path,content]of Object.entries(baseline))assert.equal(tree[path],path===source.value.contentPath?tree[path]:content,'unrelated Git blob changed');assert.notEqual(tree[source.value.contentPath],baseline[source.value.contentPath]);assert.ok(tree[source.value.contentPath].includes('#source-'+review.citationId));
    const calls=f.gh.state.calls.length;await f.restart();assert.deepEqual((await f.request('/api/admin/corrections/github-proposal',{approvalId:review.approvalId})).value,proposed.value);assert.equal(f.gh.state.calls.length,calls);
  }finally{await f.close();}
});
test('versioned target and citation authority reject cross-article/path mixing without weakening legacy approval',async()=>{
  const f=await fixture({articleId:'ai-agent'});try{
    const id=(await f.request('/api/submissions',input('ai-agent'))).value.reference,path='/api/admin/submissions/'+id;await f.request(path,{status:'follow-up',tags:'source',version:1},{method:'PATCH'});const source=(await f.request(path+'/source')).value;
    const value={approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:source.baseCommit,baseMarkdownSha256:source.baseMarkdownSha256,note:'Synthetic note rejects a citation absent from the current article before any remote mutation.',citationId:'mcp-tools',confirm:'reviewed'};
    const saved=(await f.request(path+'/review',value)).value.approval;assert.throws(()=>approved({...saved,contentPath:'src/content/articles/tool-use.md'},saved.approvalId,Date.now()));assert.throws(()=>approved({...saved,articleId:'unknown'},saved.approvalId,Date.now()));
    const result=await f.request('/api/admin/corrections/github-proposal',{approvalId:value.approvalId});assert.equal(result.status,503);assert.equal(f.gh.state.calls.some(c=>c.method==='POST'),false);assert.equal(f.gh.state.pulls.length,0);
    const wrongHash=await hash(readFileSync('src/content/articles/tool-use.md','utf8')),wrongTarget={...value,approvalId:crypto.randomUUID(),baseMarkdownSha256:wrongHash,citationId:source.citations[0]};assert.equal((await f.request(path+'/review',wrongTarget)).status,200);const mismatched=await f.request('/api/admin/corrections/github-proposal',{approvalId:wrongTarget.approvalId});assert.equal(mismatched.status,409);assert.equal(mismatched.value.error,'stale_github_content');assert.equal(f.gh.state.calls.some(c=>c.method==='POST'),false);
    const markdown=readFileSync('src/content/articles/ai-agent.md','utf8');assert.deepEqual(sourceCitations(markdown),['patterns','react','tools']);await assert.rejects(projectNote(markdown,saved),error=>error.code==='unsupported_github_citation');
  }finally{await f.close();}
});
