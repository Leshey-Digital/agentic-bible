import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,token,trust,input} from './fixture.mjs';
import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {buildReviewSource} from '../../src/hosted/build-review-source.ts';
import {D1EditorialStore} from '../../src/editorial/store.ts';
import {hash} from '../../src/hosted/contracts.ts';
import {lookupApproval} from '../../src/hosted/approvals.ts';
import {adminTrust,verifySignedAdmin} from '../../src/hosted/identity.ts';
const origin='https://staging.agenticbible.si';
export async function setupRevisionPreview({drafts=false}={}){
 const f=await fixture(),markdown=readFileSync('src/content/articles/tool-use.md','utf8'),source=buildReviewSource({commit:f.gh.state.base,articles:{'tool-use':{markdown,sha256:await hash(markdown)}}}),trusted={...trust,subjects:[...trust.subjects,'synthetic-other']};let transform=async value=>value;
 const runtime=()=>createHostedRuntime({contributions:{trust:JSON.stringify(trusted)},...(drafts?{hostedApprovals:true,verifyAdmin:request=>verifySignedAdmin(request,adminTrust(JSON.stringify(trusted))),approvedNote:(id,admin)=>lookupApproval(f.db,id,admin),sendGitHub:(request)=>f.gh.send(request)}:{}),reviewSource:async id=>transform(await source(id))});
 async function request(path,body,options={}){const headers={Origin:origin,'Content-Type':'application/json','X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':await token(options.claims),...options.headers},req=new Request(origin+path,{method:options.method??(body?'POST':'GET'),headers,signal:options.signal,body:body===undefined?undefined:JSON.stringify(body)}),response=await runtime().fetch(req,{EDITORIAL_DB:f.db,ASSETS:{fetch:async()=>new Response('controlled asset')}});assert.equal(response.headers.get('cache-control'),'no-store');return {status:response.status,value:await response.json()};}
 const store=new D1EditorialStore(f.db,true,'hosted-submitter'),saved=await store.submit(input('tool-use','A new original synthetic suggestion asks for explicit caller-side action validation.'),'hosted:'+'a'.repeat(64),Date.now()),path='/api/admin/submissions/'+saved.id;
 assert.equal((await request(path,{status:'follow-up',tags:'evidence',version:1},{method:'PATCH'})).status,200);
 const base=(await request(path+'/source')).value,review={approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:base.baseCommit,baseMarkdownSha256:base.baseMarkdownSha256,note:'This original synthetic reviewed note clarifies that callers validate requested actions before executing tools.',citationId:'openai',confirm:'reviewed'};
 assert.equal((await request(path+'/review',review)).status,200);
 const admin=await verifySignedAdmin(new Request(origin,{headers:{Origin:origin,'X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':await token()}}),adminTrust(JSON.stringify(trusted)));
 const snapshot=async()=>JSON.stringify(await Promise.all(['submissions','editorial_audit','hosted_reviewed_notes','hosted_submission_reviews','hosted_note_revocations','github_content_proposals'].map(async name=>(await f.db.prepare('SELECT * FROM '+name+' ORDER BY 1').all()).results)));
 return {f,request,path,review,admin,markdown,snapshot,source,transform:fn=>{transform=fn;},preview:options=>request(path+'/revision-preview',{approvalId:review.approvalId},options)};
}
