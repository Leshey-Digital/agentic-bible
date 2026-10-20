import {createServer} from 'node:http';import {chromium} from 'playwright';
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {prepareStagingModule} from '../../scripts/prepare-staging-module.mjs';
import {trust,token,input} from '../production-hosted/fixture.mjs';
import {D1EditorialStore} from '../../src/editorial/store.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),candidateRoot=process.env.STAGING_MODULE_CANDIDATE??'.git/private-editorial-candidate',pin='260142f11656ed643fbc2091479d47bef14f605331ce9bfbd89eeb3d74f933f9';
const parent=mkdtempSync('.git/staging-module-tests-'),out=join(parent,'package'),manifest=await prepareStagingModule({candidateRoot,manifestSha256:pin,out});
const modules=manifest.modules.map(m=>({type:m.type,path:join(process.cwd(),out,m.name),contents:m.type==='Data'?readFileSync(join(out,m.name)):readFileSync(join(out,m.name),'utf8')}));
const origin='https://staging.agenticbible.si';
async function fixture(enabled){let runtime,db,outbound=0;const state=mkdtempSync(join(parent,'state-'));
 async function start(){runtime=new Miniflare({...convertV4MiniflareOptions({modules,modulesRoot:join(process.cwd(),out),compatibilityDate:'2026-10-16',compatibilityFlags:['nodejs_compat'],bindings:{HOSTED_ADMIN_TRUST:JSON.stringify(trust),...(enabled?{HOSTED_PRIVATE_INBOX:'enabled'}:{})},d1Databases:{EDITORIAL_DB:'synthetic-module-review'},outboundService:()=>{outbound++;return new Response('outbound forbidden',{status:503});}}),cf:false,resourcePersistencePath:state});db=await runtime.getD1Database('EDITORIAL_DB');}
 await start();for(const name of ['0001_editorial.sql','0007_reviewed_corrections.sql','0008_github_content_proposals.sql','0009_hosted_reviewed_notes.sql','0017_published_contribution_intake.sql','0018_hosted_submission_reviews.sql','0019_integration_vault.sql','0023_jev_integration_vault.sql','0025_hosted_abuse_counters.sql'])await db.batch(readFileSync('migrations/'+name,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
 return {get db(){return db},get outbound(){return outbound},async request(path,body,{signed=true,method=body?'POST':'GET',headers={}}={}){return runtime.dispatchFetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json','X-Agentic-Bible-Request':'admin',...(signed?{'cf-access-jwt-assertion':await token()}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});},restart:async()=>{await runtime.dispose();await start();},close:()=>runtime.dispose()};
}
test('module composition preserves every frozen public byte, staging headers, routes and closed defaults',async()=>{
 const f=await fixture(false);try{
  for(const m of manifest.modules.filter(m=>m.sourcePath)){const p=m.sourcePath,url=p==='index.html'?'/':p.endsWith('/index.html')?'/'+p.slice(0,-10):'/'+p;const r=await f.request(url,undefined,{signed:false});assert.equal(r.status,200,url);assert.equal(sha(Buffer.from(await r.arrayBuffer())),m.sha256,url);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow',url);assert.equal(r.headers.get('x-content-type-options'),'nosniff');}
  const redirect=await f.request('/articles/tool-use?x=1');assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'/articles/tool-use/?x=1');
  const head=await f.request('/favicon.svg',undefined,{method:'HEAD'});assert.equal(await head.text(),'');assert.equal(head.status,200);
  const partial=await f.request('/favicon.svg',undefined,{headers:{Range:'bytes=1-4'}});assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,4);
  for(const path of ['/api/admin/submissions','/admin/contributions/'])assert.equal((await f.request(path)).status,503);
  assert.equal((await f.request('/api/submissions',input(),{signed:false})).status,503);
  assert.equal((await f.request('/src/content/articles/tool-use.md')).status,404);
  const status=await (await f.request('/api/runtime/status')).json();assert.equal(status.releaseManifestVerified,false);assert.equal(status.releaseCommit,null);assert.equal(status.releaseVerified,false);assert.equal((await f.request('/admin/')).status,200);assert.equal(status.publicIntake,false);assert.equal(status.gitHubProposalsConfigured,false);assert.equal(status.hostedCanonicalWrites,false);assert.equal(status.jevDispatchConfigured,false);assert.equal(f.outbound,0);
 }finally{await f.close();}
});
test('signed private review saves immutable build note and survives restart without GitHub authority',async()=>{
 const f=await fixture(true);try{
  const seeded=await new D1EditorialStore(f.db).submit(input(),'synthetic-module-owner',Date.now()),path='/api/admin/submissions/'+seeded.id;
  assert.equal((await f.request(path+'/source',undefined,{signed:false})).status,403);
  assert.equal((await f.request(path,{status:'follow-up',tags:'source',version:1},{method:'PATCH'})).status,200);
  const sourceResponse=await f.request(path+'/source');assert.equal(sourceResponse.status,200);assert.equal(sourceResponse.headers.get('cache-control'),'no-store');const source=await sourceResponse.json();assert.equal(source.sourceAuthority,'immutable-build');assert.equal(source.baseCommit,manifest.contentCommit);assert.equal(source.gitHubDraftAvailable,false);assert.equal(sha(source.markdown),source.baseMarkdownSha256);
  const review={approvalId:crypto.randomUUID(),submissionRevision:2,baseCommit:source.baseCommit,baseMarkdownSha256:source.baseMarkdownSha256,note:'Synthetic saved editorial note uses the immutable build source and makes no external draft or publication claim.',citationId:source.citations[0],confirm:'reviewed'};
  for(const change of [{baseCommit:'a'.repeat(40)},{baseMarkdownSha256:'b'.repeat(64)},{citationId:'foreign'}])assert.equal((await f.request(path+'/review',{...review,...change})).status,409);
  assert.equal((await f.request(path+'/review',review,{signed:false})).status,403);
  assert.equal((await f.request(path+'/review',review,{headers:{Origin:'https://other.invalid'}})).status,403);
  assert.equal((await f.request(path+'/review',{...review,submissionRevision:1})).status,409);
  const saved=await f.request(path+'/review',review);assert.equal(saved.status,200);const receipt=await saved.json();assert.equal(receipt.gitHubDraftAvailable,false);assert.equal(receipt.published,false);assert.equal(receipt.articleChanged,false);
  assert.equal((await f.request(path+'/review',review)).status,200);
  await f.restart();const history=await (await f.request(path+'/reviews')).json();assert.equal(history.items.length,1);assert.equal(history.items[0].note,review.note);assert.equal(history.items[0].proposal.state,'not-started');
  const draft=await f.request('/api/admin/corrections/github-proposal',{approvalId:review.approvalId});assert.equal(draft.status,503);assert.equal((await draft.json()).error,'hosted_identity_approval_and_github_not_configured');
  assert.equal((await f.request('/api/submissions',input(),{signed:false})).status,503);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM hosted_source_budget').first()).n,0);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM github_content_proposals').first()).n,0);assert.equal(f.outbound,0);
  const server=createServer(async(req,res)=>{try{const chunks=[];for await(const part of req)chunks.push(part);const bytes=Buffer.concat(chunks);const response=await f.request(req.url,bytes.length?JSON.parse(bytes.toString()):undefined,{method:req.method});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});try{const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(`http://127.0.0.1:${server.address().port}/admin/contributions/`);await page.locator('#status').selectOption('follow-up');await page.locator('#filter button').click();await page.locator('#items button').first().click();await page.locator('#load-source').click();await page.locator('#notice').filter({hasText:'Remote main has not been checked'}).waitFor();await page.locator('#note').fill('Synthetic browser review verifies the private saved-note journey without GitHub credentials.');await page.locator('#confirm').check();await page.locator('#save-review').click();await page.locator('#review-result').filter({hasText:'GitHub draft creation is unavailable; your reviewed note is saved.'}).waitFor();await page.locator('#review-history').filter({hasText:'Synthetic browser review'}).waitFor();assert.equal(f.outbound,0);}finally{await browser.close();await new Promise(r=>server.close(r));}
 }finally{await f.close();}
});
