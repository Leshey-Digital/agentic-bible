import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReviewSource} from '../../src/hosted/build-review-source.ts';
import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {adminTrust,verifySignedAdmin} from '../../src/hosted/identity.ts';
import {createCloudflareDraftAction} from '../../src/hosted/cloudflare-drafts.ts';
import {cloudflareProseModel} from '../../src/maintenance-adapters/cloudflare-prose.ts';
import {document,mcp,urls} from '../maintenance-adapters/fixtures.mjs';
import {digest} from '../../src/maintenance-adapters/profiles.ts';
import {SourceAdapterError} from '../../src/maintenance-adapters/profiles.ts';
import {ledgerFixture,policy,control} from '../maintenance-currency/helpers.mjs';
import {demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
const origin='https://staging.agenticbible.si';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const trust={issuer:'https://synthetic-draft.invalid',audience:'synthetic-draft',assertionHeader:'cf-access-jwt-assertion',subjects:['synthetic-owner'],keys:[{...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test',alg:'RS256',use:'sig'}]};
async function request(overrides={},claims={}){const now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),data=enc({alg:'RS256',kid:'test'})+'.'+enc({iss:trust.issuer,aud:trust.audience,sub:'synthetic-owner',iat:now,exp:now+300,...claims});const token=data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(data))).toString('base64url');return new Request(origin+'/api/admin/drafts/cloudflare',{method:'POST',headers:{Origin:origin,'X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':token},...overrides});}
const input=()=>({articleId:'tool-use',citationId:'mcp-tools',sourceId:mcp,requestKey:crypto.randomUUID()});
async function fixture(label,overrides={}){
 const f=await ledgerFixture('hosted-ai-'+label);for(const sql of readFileSync('migrations/0005_http_observations.sql','utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await f.db.prepare(sql).run();
 const markdown=`---\ntitle: Tool use\nsources:\n  - id: mcp-tools\n    url: ${urls[mcp]}\n---\n\nA controlled article about validated tool use.\n`,source={articleId:'tool-use',contentPath:'src/content/articles/tool-use.md',baseCommit:'a'.repeat(40),baseMarkdownSha256:await digest(markdown),markdown,citations:['mcp-tools']};
 const now=Date.now(),p=policy({monthLimit:18_000_000,monthBaseline:0,dayBaseline:0,price:{id:'controlled-cloudflare-rate',provider:'cloudflare-workers-ai',model:cloudflareProseModel,tokenizer:'cloudflare-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:27000,outputPerMillion:201000,requestFee:0,validFrom:now-86400000,validUntil:now+86400000}});let http=0,ai=0;
 const options={enabled:true,trust:JSON.stringify(trust),db:f.db,currency:control(p),policy:{...demonstrationPolicy,maxInputTokens:8192,maxOutputTokens:2048,runCost:10240,dayCost:81920,monthCost:163840},reviewSource:async()=>source,sourceSend:async url=>{http++;assert.equal(url,urls[mcp]);assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM http_request_reservations WHERE outcome='reserved'").first()).n,1);return new Response(document(),{headers:{'Content-Type':'text/html'}});},ai:{run:async(_model,value)=>{ai++;assert.equal(value.raw,true);assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM maintenance_proposals WHERE currency_state='reserved'").first()).n,1);return {response:JSON.stringify({note:'Clarify that a caller validates requested actions before executing them.',citationId:'mcp-tools'}),usage:{prompt_tokens:100,completion_tokens:30,total_tokens:130}};}},...overrides};
 return {f,options,p,get http(){return http;},get ai(){return ai;},action:createCloudflareDraftAction(options)};
}
test('signed action joins real D1 source receipt to reserved draft without publication or refetch on replay',{timeout:30000},async()=>{const x=await fixture('success');try{const selection=input(),draft=await x.action.prepare(await request(),selection);assert.equal(draft.approved,false);assert.equal(draft.published,false);assert.equal(draft.articleChanged,false);assert.equal(draft.sources[0].receipt.requestKey,selection.requestKey);assert.equal(x.http,1);assert.equal(x.ai,1);assert.equal((await x.f.db.prepare('SELECT state FROM maintenance_proposals').first()).state,'complete');await assert.rejects(x.action.prepare(await request(),selection));assert.equal(x.http,1);assert.equal(x.ai,1);}finally{await x.f.close();}});
test('missing configuration, invalid identity and source mismatch make no HTTP or AI calls',{timeout:30000},async()=>{const x=await fixture('closed');try{assert.equal(createCloudflareDraftAction().state,'unconfigured');const closed=createCloudflareDraftAction({...x.options,enabled:false});await assert.rejects(closed.prepare(await request(),input()));await assert.rejects(x.action.prepare(await request({}, {sub:'foreign'}),input()),{code:'verified_admin_required'});await assert.rejects(x.action.prepare(await request({method:'GET'}),input()),{code:'explicit_post_required'});await assert.rejects(x.action.prepare(await request({headers:{Origin:'https://foreign.invalid'}}),input()),{code:'same_origin_required'});await assert.rejects(x.action.prepare(await request(),{...input(),citationId:'invented'}),{code:'draft_source_mismatch'});await assert.rejects(x.action.prepare(await request(),{...input(),sourceId:'https://foreign.invalid'}),{code:'invalid_request'});assert.equal(x.http,0);assert.equal(x.ai,0);}finally{await x.f.close();}});
test('outer monthly cap and exhausted budget prevent AI dispatch',{timeout:30000},async()=>{const x=await fixture('budget');try{const high=createCloudflareDraftAction({...x.options,currency:control({...x.p,monthLimit:21_000_000})});assert.equal(high.state,'unconfigured');await assert.rejects(high.prepare(await request(),input()));assert.equal(x.http,0);const small=createCloudflareDraftAction({...x.options,currency:control({...x.p,runLimit:1,dayLimit:1,monthLimit:1})});await assert.rejects(small.prepare(await request(),input()));assert.equal(x.ai,0);assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM maintenance_proposals').first()).n,0);}finally{await x.f.close();}});
test('unknown AI usage keeps the charged hold and blocks another generation',{timeout:30000},async()=>{let calls=0;const x=await fixture('uncertain',{ai:{run:async()=>{calls++;return {response:'Unknown bill',usage:{}};}}});try{await assert.rejects(x.action.prepare(await request(),input()));const first=await x.f.db.prepare('SELECT currency_reserved,currency_state FROM maintenance_proposals').first();assert.equal(first.currency_state,'uncertain');assert.ok(first.currency_reserved>0);await assert.rejects(x.action.prepare(await request(),input()));assert.equal(calls,1);}finally{await x.f.close();}});

test('request cancellation during trusted source lookup stops acquisition and AI',{timeout:30000},async()=>{const x=await fixture('cancelled');try{const controller=new AbortController();const action=createCloudflareDraftAction({...x.options,reviewSource:async id=>{controller.abort();return x.options.reviewSource(id);}});await assert.rejects(action.prepare(await request({signal:controller.signal}),input()),{code:'verified_admin_required'});assert.equal(x.http,0);assert.equal(x.ai,0);}finally{await x.f.close();}});

test('oversized source reports known pre-model failure and preserves terminal receipt without refetch',{timeout:30000},async()=>{
 let fetches=0;const x=await fixture('source-overflow',{sourceSend:async()=>{fetches++;return new Response('bounded placeholder',{headers:{'Content-Type':'text/html','Content-Length':'32769'}});}});
 try{const selected=input();await assert.rejects(x.action.prepare(await request(),selected),{code:'cloudflare_source_too_large',status:422});
  const job=await x.f.db.prepare('SELECT state,attempts,result FROM http_check_jobs WHERE request_key=?').bind(selected.requestKey).first();assert.equal(job.state,'dead');assert.equal(job.attempts,1);assert.equal(JSON.parse(job.result).error.code,'body_too_large');
  assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM maintenance_proposals').first()).n,0);assert.equal(x.ai,0);
  await assert.rejects(x.action.prepare(await request(),selected),{code:'cloudflare_source_attempt_recorded',status:409});assert.equal(fetches,1);assert.equal(x.ai,0);
  assert.deepEqual(await x.f.db.prepare('SELECT state,attempts,result FROM http_check_jobs WHERE request_key=?').bind(selected.requestKey).first(),job);
 }finally{await x.f.close();}
});

test('a source-shaped error after AI dispatch remains uncertain and retains its monetary hold',{timeout:30000},async()=>{
 let calls=0;const x=await fixture('post-dispatch-error',{ai:{run:async()=>{calls++;throw new SourceAdapterError('body_too_large');}}});
 try{await assert.rejects(x.action.prepare(await request(),input()),{code:'cloudflare_draft_unavailable',status:503});assert.equal(calls,1);
  const row=await x.f.db.prepare('SELECT currency_state,currency_reserved FROM maintenance_proposals').first();assert.equal(row.currency_state,'uncertain');assert.ok(row.currency_reserved>0);
 }finally{await x.f.close();}
});

test('composed signed Worker action acquires source, accounts AI, persists inbox and saves an explicit review note',{timeout:30000},async()=>{
 const markdown=readFileSync('src/content/articles/tool-use.md','utf8');
 const reviewSource=buildReviewSource({commit:'a'.repeat(40),articles:{'tool-use':{markdown,sha256:await digest(markdown)}}});
 const x=await fixture('composed-worker',{reviewSource});try{
  for(const migration of ['0001_editorial.sql','0007_reviewed_corrections.sql','0008_github_content_proposals.sql','0009_hosted_reviewed_notes.sql','0017_published_contribution_intake.sql','0018_hosted_submission_reviews.sql'])for(const sql of readFileSync('migrations/'+migration,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await x.f.db.prepare(sql).run();
  const runtime=createHostedRuntime({verifyAdmin:r=>verifySignedAdmin(r,adminTrust(JSON.stringify(trust))),contributions:{trust:JSON.stringify(trust)},reviewSource:x.options.reviewSource,cloudflareDrafts:x.action});
  const env={EDITORIAL_DB:x.f.db,ASSETS:{fetch:async()=>new Response('controlled asset')}};
  async function dispatch(path,body,method='POST'){
   const signed=await request(),headers=new Headers(signed.headers);headers.set('Content-Type','application/json');
   const response=await runtime.fetch(new Request(origin+path,{method,headers,body:JSON.stringify(body)}),env);
   const text=await response.text();assert.equal(response.status,200,text);return JSON.parse(text);
  }
  const selected=input(),saved=await dispatch('/api/admin/drafts/cloudflare',selected);
  assert.equal(saved.approved,false);assert.equal(saved.published,false);assert.equal(x.http,1);assert.equal(x.ai,1);
  const row=await x.f.db.prepare('SELECT * FROM submissions WHERE id=?').bind(saved.submissionId).first();
  assert.equal(row.status,'new');assert.deepEqual(JSON.parse(row.tags),['ai-draft','unverified']);assert.match(row.message,/UNVERIFIED AI DRAFT — NOT EDITORIAL APPROVAL/);
  assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM editorial_audit WHERE submission_id=?').bind(row.id).first()).n,1);
  assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM hosted_reviewed_notes').first()).n,0);
  assert.equal((await x.f.db.prepare('SELECT state FROM maintenance_proposals').first()).state,'complete');
  const replay=await dispatch('/api/admin/drafts/cloudflare',selected);assert.equal(replay.duplicate,true);assert.equal(replay.submissionId,row.id);assert.equal(x.http,1);assert.equal(x.ai,1);
  await dispatch('/api/admin/submissions/'+row.id,{status:'follow-up',tags:'ai-draft, unverified',version:1},'PATCH');
  const source=await x.options.reviewSource('tool-use');
  const note='Synthetic explicit editor review after reading the acquired source. Keep this proposal private and do not publish.';
  const reviewed=await dispatch('/api/admin/submissions/'+row.id+'/review',{approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:source.baseCommit,baseMarkdownSha256:source.baseMarkdownSha256,note,citationId:'mcp-tools',confirm:'reviewed'});
  assert.equal(reviewed.gitHubDraftAvailable,false);assert.equal((await x.f.db.prepare('SELECT COUNT(*) n FROM hosted_reviewed_notes').first()).n,1);
  const persisted=await x.f.db.prepare('SELECT * FROM hosted_reviewed_notes').first();assert.ok(JSON.stringify(persisted).includes(note));
  assert.equal(x.http,1);assert.equal(x.ai,1);
 }finally{await x.f.close();}
});
