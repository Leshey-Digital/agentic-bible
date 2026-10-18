import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,input,token,trust} from './fixture.mjs';
import {verifySignedAdmin,adminTrust} from '../../src/hosted/identity.ts';
import {lookupApproval} from '../../src/hosted/approvals.ts';
import {proposeGitHubCorrection} from '../../src/hosted/github.ts';
const origin='https://staging.agenticbible.si';
for(const [mode,reservation,target] of [['dismissed',11,'/pulls'],['revision',6,'/git/trees'],['revoked',7,'/git/commits'],['expired',8,'/git/refs']])test('held actual D1 reservation response rejects '+mode+' before '+target,async()=>{
  const f=await fixture();try{
    const id=(await f.request('/api/submissions',input())).value.reference,path='/api/admin/submissions/'+id;
    assert.equal((await f.request(path,{status:'follow-up',tags:'source',version:1},{method:'PATCH'})).status,200);
    const base=(await f.request('/api/admin/corrections/base')).value;
    const review={approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:base.baseCommit,baseMarkdownSha256:base.baseMarkdownSha256,note:'Synthetic reviewed source note requires fresh durable authority after the last charged reservation await.',citationId:'openai',confirm:'reviewed'};
    assert.equal((await f.request(path+'/review',review)).status,200);
    const principal=await verifySignedAdmin(new Request(origin+'/api/admin/submissions',{headers:{'cf-access-jwt-assertion':await token()}}),adminTrust(JSON.stringify(trust)));
    let reserves=0,invalidated=false,atInvalidation=0;
    const wrap=(sql,statement)=>({underlying:statement,bind(...args){return wrap(sql,statement.bind(...args));},first:()=>statement.first(),all:()=>statement.all(),async run(){const result=await statement.run();if(sql.includes('SET request_count=request_count+1')&&++reserves===reservation){
      if(mode==='dismissed'||mode==='revision')assert.equal((await f.request(path,{status:mode==='dismissed'?'dismissed':'follow-up',tags:'changed',version:2},{method:'PATCH'})).status,200);
      if(mode==='revoked')assert.equal((await f.request('/api/admin/corrections/revoke',{approvalId:review.approvalId})).status,200);
      if(mode==='expired')principal.expiresAt=Date.now()-1;
      invalidated=true;atInvalidation=f.gh.state.calls.length;
    }return result;}});
    const db={prepare(sql){return wrap(sql,f.db.prepare(sql));},batch(statements){return f.db.batch(statements.map(s=>s.underlying??s));}};
    await assert.rejects(proposeGitHubCorrection(review.approvalId,principal,db,{approvedNote:(id,p)=>lookupApproval(f.db,id,p),sendGitHub:f.gh.send}));
    assert.equal(invalidated,true);assert.equal(reserves,reservation);assert.equal(f.gh.state.calls.length,atInvalidation);assert.equal(f.gh.state.calls.some(c=>c.method==='POST'&&c.path===target),false);assert.equal(f.gh.state.pulls.length,0);
    const row=await f.db.prepare('SELECT request_count FROM github_content_proposals WHERE approval_id=?').bind(review.approvalId).first();assert.equal(row.request_count,reservation);
    await f.restart();const calls=f.gh.state.calls.length;await assert.rejects(proposeGitHubCorrection(review.approvalId,principal,f.db,{approvedNote:(id,p)=>lookupApproval(f.db,id,p),sendGitHub:f.gh.send}));assert.equal(f.gh.state.calls.length,calls);assert.equal((await f.db.prepare('SELECT request_count FROM github_content_proposals WHERE approval_id=?').bind(review.approvalId).first()).request_count,reservation);
  }finally{await f.close();}
});
