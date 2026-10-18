import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,input} from './fixture.mjs';
import {articleIds} from '../../src/editorial/contracts.ts';
import {hash} from '../../src/hosted/contracts.ts';
import {hostedTarget,sourceCitations} from '../../src/hosted/targets.ts';
const note='Synthetic same-store reviewed note preserves the actual article source and revision with bounded durable authority.';
test('one persistent actual D1 store admits all twenty distinct article drafts, replays after restart, and closes atomic note/outbox capacity at64',{timeout:120000},async()=>{
  const f=await fixture({distinctClients:true}),reviews=[];try{
    for(const articleId of articleIds){
      const id=(await f.request('/api/submissions',input(articleId),{headers:{'x-synthetic-ingress-client':articleId}})).value.reference,path='/api/admin/submissions/'+id;
      assert.equal((await f.request(path,{status:'follow-up',tags:'catalog',version:1},{method:'PATCH'})).status,200);
      // Pinned controlled Git source is supplied to this explicit admin review.
      // The proposal itself re-fetches/verifies it; no preview/rate budget resets.
      const markdown=f.gh.state.trees.get(f.gh.state.tree)[hostedTarget(articleId).contentPath],source={baseCommit:f.gh.state.base,baseMarkdownSha256:await hash(markdown),citations:sourceCitations(markdown)};
      const review={approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:source.baseCommit,baseMarkdownSha256:source.baseMarkdownSha256,note,citationId:source.citations[0],confirm:'reviewed'};
      assert.equal((await f.request(path+'/review',review)).status,200);
      const proposed=await f.request('/api/admin/corrections/github-proposal',{approvalId:review.approvalId});assert.equal(proposed.status,200,JSON.stringify(proposed));assert.equal(proposed.value.articleId,articleId);assert.equal(proposed.value.contentPath,hostedTarget(articleId).contentPath);
      reviews.push({path,review,receipt:proposed.value});
    }
    assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM hosted_reviewed_notes').first()).n,20);assert.equal(f.gh.state.pulls.length,20);assert.equal(new Set(f.gh.state.pulls.map(p=>f.gh.state.commits.get(p.head.sha).message.split('\n')[0])).size,20);
    const calls=f.gh.state.calls.length;await f.restart();for(const row of reviews)assert.deepEqual((await f.request('/api/admin/corrections/github-proposal',{approvalId:row.review.approvalId})).value,row.receipt);assert.equal(f.gh.state.calls.length,calls);
    for(let i=20;i<63;i++){const current=reviews[i%reviews.length],review={...current.review,approvalId:crypto.randomUUID(),note:note+' Capacity record '+i};assert.equal((await f.request(current.path+'/review',review)).status,200);}
    const beforeFault=(await f.db.prepare('SELECT COUNT(*) n FROM editorial_audit').first()).n,last={...reviews[3].review,approvalId:crypto.randomUUID(),note:note+' Atomic capacity boundary record'};await f.db.prepare("CREATE TRIGGER synthetic_capacity_audit_fault BEFORE INSERT ON editorial_audit WHEN NEW.action='hosted-note-reviewed' BEGIN SELECT RAISE(ABORT,'synthetic boundary failure'); END").run();assert.equal((await f.request(reviews[3].path+'/review',last)).status,503);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM hosted_reviewed_notes').first()).n,63);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM hosted_submission_reviews').first()).n,63);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM editorial_audit').first()).n,beforeFault);await f.restart();await f.db.prepare('DROP TRIGGER synthetic_capacity_audit_fault').run();assert.equal((await f.request(reviews[3].path+'/review',last)).status,200);
    const audit=(await f.db.prepare('SELECT COUNT(*) n FROM editorial_audit').first()).n;
    const full=await f.request(reviews[0].path+'/review',{...reviews[0].review,approvalId:crypto.randomUUID()});assert.equal(full.status,503);assert.equal(full.value.error,'hosted_submission_review_capacity');assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM hosted_submission_reviews').first()).n,64);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM editorial_audit').first()).n,audit);
    assert.equal((await f.request('/api/admin/corrections/approvals')).value.length,64);
    // Populate the remaining bounded outbox slots with explicit synthetic receipt
    // rows. The final real approved note must fail before any remote dispatch.
    const extra=await f.db.prepare('SELECT id,fingerprint FROM hosted_reviewed_notes WHERE id NOT IN (SELECT approval_id FROM github_content_proposals) ORDER BY id').all();const blocked=extra.results.pop();
    for(const row of extra.results)await f.db.prepare("INSERT INTO github_content_proposals(approval_id,fingerprint,state,created_at) VALUES(?,?,'pending',1)").bind(row.id,row.fingerprint).run();
    await f.db.prepare("INSERT INTO github_content_proposals(approval_id,fingerprint,state,created_at) VALUES(?,?,'pending',1)").bind(crypto.randomUUID(),'f'.repeat(64)).run();
    const before=f.gh.state.calls.length;assert.equal((await f.request('/api/admin/corrections/github-proposal',{approvalId:blocked.id})).status,409);assert.equal(f.gh.state.calls.length,before);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM github_content_proposals').first()).n,64);
    await f.restart();assert.equal((await f.request('/api/admin/corrections/approvals')).value.length,64);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM hosted_reviewed_notes').first()).n,64);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM hosted_submission_reviews').first()).n,64);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM editorial_audit').first()).n,audit);assert.equal((await f.request('/api/admin/corrections/github-proposal',{approvalId:blocked.id})).status,409);assert.equal(f.gh.state.calls.length,before);
  }finally{await f.close();}
});
