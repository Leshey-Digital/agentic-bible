import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {prepareStagingModule} from '../../scripts/prepare-staging-module.mjs';
import {maintenanceAdminPage} from '../../src/maintenance-history/admin.ts';
const origin='https://staging.agenticbible.si',parent=mkdtempSync('.git/admin-capabilities-'),out=join(parent,'package');
const manifest=await prepareStagingModule({candidateRoot:'.git/private-editorial-candidate',manifestSha256:'260142f11656ed643fbc2091479d47bef14f605331ce9bfbd89eeb3d74f933f9',out});
const modules=manifest.modules.map(m=>({type:m.type,path:join(process.cwd(),out,m.name),contents:m.type==='Data'?readFileSync(join(out,m.name)):readFileSync(join(out,m.name),'utf8')}));
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const trust={issuer:'https://synthetic-gateway.invalid',audience:'synthetic-admin-capabilities',assertionHeader:'cf-access-jwt-assertion',subjects:['synthetic-admin-capabilities'],keys:[{...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic',alg:'RS256',use:'sig'}]};
async function token(){const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),data=enc({alg:'RS256',kid:'synthetic'})+'.'+enc({iss:trust.issuer,aud:trust.audience,sub:trust.subjects[0],iat:now,exp:now+300});return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(data))).toString('base64url');}
async function fixture(enabled){let outbound=0;const runtime=new Miniflare({...convertV4MiniflareOptions({modules,modulesRoot:join(process.cwd(),out),compatibilityDate:'2026-10-16',compatibilityFlags:['nodejs_compat'],bindings:{HOSTED_ADMIN_TRUST:JSON.stringify(trust),...(enabled?{HOSTED_PRIVATE_INBOX:'enabled'}:{})},d1Databases:{EDITORIAL_DB:'synthetic-capabilities'},outboundService:()=>{outbound++;return new Response('forbidden',{status:503});}}),cf:false});
 try{const db=await runtime.getD1Database('EDITORIAL_DB');for(const name of ['0001_editorial.sql','0007_reviewed_corrections.sql','0017_published_contribution_intake.sql','0025_hosted_abuse_counters.sql'])await db.batch(readFileSync('migrations/'+name,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));}catch(error){await runtime.dispose();throw error;}
 return {get outbound(){return outbound},request:async(path,{signed=true,site='same-origin'}={})=>runtime.dispatchFetch(origin+path,{redirect:'manual',headers:{Origin:origin,'Sec-Fetch-Site':site,'X-Agentic-Bible-Request':'admin',...(signed?{'cf-access-jwt-assertion':await token()}: {})}}),close:()=>runtime.dispose()};}
test('private inbox landing and disabled maintenance reflect actual capability without GitHub or public intake',{timeout:30000},async()=>{
 const f=await fixture(true);let server,browser;try{
  for(const path of ['/admin/','/admin/maintenance/','/admin/contributions/'])assert.equal((await f.request(path,{signed:false})).status,403);
  assert.equal((await f.request('/admin/',{site:'cross-site'})).status,403);
  const landing=await f.request('/admin/');assert.equal(landing.status,302);assert.equal(landing.headers.get('location'),'/admin/contributions/');assert.equal(landing.headers.get('cache-control'),'no-store');
  const inbox=await f.request('/admin/contributions/');assert.equal(inbox.status,200);const html=await inbox.text();assert.match(html,/GitHub draft creation is unavailable/);assert.doesNotMatch(html,/href="\/admin\/corrections\//);
  const maintenance=await f.request('/admin/maintenance/');assert.equal(maintenance.status,200);const unavailable=await maintenance.text();assert.match(unavailable,/Revision review is unavailable/);assert.match(unavailable,/href="\/admin\/contributions\/"/);assert.doesNotMatch(unavailable,/<form|<script|id="save-review"|href="\/admin\/corrections\//);
  const data=await f.request('/api/admin/maintenance/review');assert.equal(data.status,503);assert.equal((await data.json()).error,'maintenance_review_unconfigured');
  assert.equal((await f.request('/admin/corrections/')).status,503);assert.equal((await f.request('/api/submissions',{signed:false})).status,503);
  const status=await(await f.request('/api/runtime/status')).json();assert.equal(status.contributionAdminConfigured,true);for(const key of ['publicIntake','gitHubProposalsConfigured','hostedCanonicalWrites','jevDispatchConfigured'])assert.equal(status[key],false);
  server=createServer(async(req,res)=>{try{const r=await f.request(req.url);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const page=await browser.newPage();const base=`http://127.0.0.1:${server.address().port}`;
  for(const width of [390,1280]){await page.setViewportSize({width,height:844});await page.goto(base+'/admin/');assert.equal(new URL(page.url()).pathname,'/admin/contributions/');await page.getByRole('heading',{name:'Editorial inbox',exact:true}).waitFor();await page.goto(base+'/admin/maintenance/');await page.getByRole('heading',{name:'Revision review is unavailable'}).waitFor();assert.equal(await page.locator('form').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.getByRole('link',{name:'Editorial inbox',exact:true}).focus();assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/admin/contributions/');await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Editorial inbox',exact:true}).waitFor();}
  assert.equal(f.outbound,0);
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await f.close();}
});
test('disabled inbox keeps authenticated unavailable landing and valid maintenance rendering preserves review form',{timeout:15000},async()=>{const f=await fixture(false);try{const r=await f.request('/admin/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/Revision review is unavailable/);assert.doesNotMatch(html,/href="\/admin\/contributions\/"|<form/);assert.equal((await f.request('/admin/contributions/')).status,503);const available=maintenanceAdminPage({inbox:true,github:false});assert.match(available,/id="maintenance-review"/);assert.match(available,/href="\/admin\/contributions\/"/);assert.doesNotMatch(available,/href="\/admin\/corrections\//);const github=maintenanceAdminPage({inbox:false,github:true});assert.match(github,/href="\/admin\/corrections\/"/);assert.equal(f.outbound,0);}finally{await f.close();}});
