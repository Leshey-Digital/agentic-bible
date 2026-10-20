import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,input,trust} from './fixture.mjs';

test('suggestion review to recorded draft survives restart; stale/revoked history is read-only and owner scoped',async()=>{
 const f=await fixture({runtimeBindings:{HOSTED_ADMIN_TRUST:JSON.stringify({...trust,subjects:[...trust.subjects,'synthetic-other']})}});try{
  const id=(await f.request('/api/submissions',input())).value.reference,path='/api/admin/submissions/'+id;
  assert.deepEqual((await f.request(path+'/reviews')).value.items,[]);
  await f.request(path,{status:'follow-up',tags:'evidence',version:1},{method:'PATCH'});
  const base=(await f.request(path+'/source')).value,review={approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:base.baseCommit,baseMarkdownSha256:base.baseMarkdownSha256,note:'Synthetic reviewed clarification keeps source and contribution provenance across the draft workflow.',citationId:'openai',confirm:'reviewed'};
  assert.equal((await f.request(path+'/review',review)).status,200);
  const before=f.counts.outbound;let history=await f.request(path+'/reviews');assert.equal(history.status,200);assert.equal(history.value.items[0].proposal.state,'not-started');assert.equal(history.value.items[0].approvalState,'current');assert.equal(f.counts.outbound,before);
  const draft=await f.request('/api/admin/corrections/github-proposal',{approvalId:review.approvalId});assert.equal(draft.status,200);
  const calls=f.counts.outbound,storage=JSON.stringify((await f.db.prepare('SELECT * FROM github_content_proposals').all()).results);
  history=await f.request(path+'/reviews');assert.equal(history.value.items[0].proposal.state,'draft-recorded');assert.equal(history.value.items[0].proposal.url,draft.value.url);assert.equal(history.value.published,false);assert.equal(history.value.remoteStateChecked,false);
  await f.restart();assert.deepEqual((await f.request(path+'/reviews')).value,history.value);assert.equal(f.counts.outbound,calls);assert.equal(JSON.stringify((await f.db.prepare('SELECT * FROM github_content_proposals').all()).results),storage);
  await f.request(path,{status:'resolved',tags:'evidence',version:2},{method:'PATCH'});assert.equal((await f.request(path+'/reviews')).value.items[0].approvalState,'stale');
  await f.request('/api/admin/corrections/revoke',{approvalId:review.approvalId});const revoked=(await f.request(path+'/reviews')).value.items[0];assert.equal(revoked.approvalState,'revoked');assert.equal(revoked.proposal.url,draft.value.url);
  const other=await f.request(path+'/reviews',undefined,{claims:{sub:'synthetic-other'}});assert.equal(other.status,200);assert.deepEqual(other.value.items,[]);
  const own=await f.db.prepare('SELECT owner_hash FROM hosted_submission_reviews').first();await f.db.prepare('UPDATE hosted_submission_reviews SET owner_hash=?').bind('another-owner').run();assert.deepEqual((await f.request(path+'/reviews')).value.items,[]);await f.db.prepare('UPDATE hosted_submission_reviews SET owner_hash=?').bind(own.owner_hash).run();
  assert.equal((await f.request(path+'/reviews',undefined,{claims:{sub:'outsider'}})).status,403);
  const receipt=(await f.db.prepare('SELECT receipt_json FROM github_content_proposals').first()).receipt_json;await f.db.prepare('UPDATE github_content_proposals SET receipt_json=?').bind(JSON.stringify({...JSON.parse(receipt),url:'https://example.org/foreign'})).run();assert.equal((await f.request(path+'/reviews')).status,503);
  await f.db.prepare("UPDATE github_content_proposals SET state='pending',receipt_json=NULL").run();assert.equal((await f.request(path+'/reviews')).value.items[0].proposal.state,'outcome-unconfirmed');
  await f.db.prepare("UPDATE github_content_proposals SET fingerprint='tampered'").run();assert.equal((await f.request(path+'/reviews')).status,503);
  assert.equal(f.counts.outbound,calls);
 }finally{await f.close();}
});
