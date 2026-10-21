import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {fixture} from './fixture.mjs';
import {contributionAdminHtml,contributionAdminCss,contributionAdminJs} from '../../src/hosted/contribution-admin.ts';
async function seed(f){
 for(let i=0;i<47;i++){
  const id=crypto.randomUUID(),article=i<25?'tool-use':'agent-memory',tag=i===24?'urgent-extra':'urgent';
  await f.db.prepare('INSERT INTO submissions(id,request_key,fingerprint,article_id,kind,message,source_url,status,tags,last_event_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,crypto.randomUUID(),id,article,'correction','Synthetic triage suggestion '+i,'',i===46?'resolved':'new',JSON.stringify([tag,'Needs review']),crypto.randomUUID(),1792523233000,1792523233000).run();
 }
}
const config={shipped:true,runtimeBindings:{HOSTED_PRIVATE_INBOX:'enabled',GITHUB_CONTENT_TOKEN:undefined}};
test('signed private triage filters before bounded pagination with exact tag membership and no provider calls',{timeout:30000},async()=>{
 const f=await fixture(config);try{await seed(f);
  const path='/api/admin/submissions?status=new&article=tool-use&tag=urgent';const first=await f.request(path);assert.equal(first.status,200);assert.equal(first.value.items.length,20);assert.ok(first.value.next);
  const second=await f.request(path+'&before='+encodeURIComponent(first.value.next));assert.equal(second.value.items.length,4);assert.equal(second.value.next,null);const rows=[...first.value.items,...second.value.items];assert.equal(new Set(rows.map(x=>x.id)).size,24);assert.ok(rows.every(x=>x.articleId==='tool-use'&&x.tags.includes('urgent')));
  assert.equal((await f.request('/api/admin/submissions?tag=Needs%20review&article=agent-memory')).value.items.length,20);
  assert.equal((await f.request('/api/admin/submissions?tag=Urgent')).value.items.length,0);
  assert.equal((await f.request('/api/admin/submissions?status=resolved&article=agent-memory')).value.items.length,1);
  for(const q of ['article=unknown','tag=%25','tag=','tag=%20urgent','tag=urgent&tag=other','article=tool-use&article=agent-memory','unexpected=1','tag='+('x'.repeat(31))])assert.equal((await f.request('/api/admin/submissions?'+q)).status,400,q);
  assert.equal((await f.request(path,undefined,{headers:{'cf-access-jwt-assertion':''}})).status,403);assert.equal((await f.request('/api/submissions',{})).status,503);assert.equal(f.counts.outbound,0);
  await f.restart();assert.deepEqual((await f.request(path)).value,first.value);
 }finally{await f.close();}
});
for(const width of [390,1280])test(`triage keyboard/filter pagination preserves unsaved note at ${width}px`,{timeout:30000},async()=>{
 const f=await fixture(config);let browser,server;try{await seed(f);
  server=createServer((req,res)=>{const a=req.url.endsWith('app.js')?[contributionAdminJs,'application/javascript']:req.url.endsWith('style.css')?[contributionAdminCss,'text/css']:[contributionAdminHtml,'text/html'];res.writeHead(200,{'Content-Type':a[1]});res.end(a[0]);});await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width,height:900}});let failed=false,holdList=null,listStarted;const queries=[];
  await page.route('**/api/admin/submissions**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/admin/submissions'){queries.push(url.searchParams);if(holdList){const held=holdList;holdList=null;listStarted();await held;}}if(failed){await route.fulfill({status:503,json:{error:'unavailable'}});return;}const r=await f.request(url.pathname+url.search);await route.fulfill({status:r.status,json:r.value});});
  await page.goto(`http://127.0.0.1:${server.address().port}/admin/contributions/`);await page.locator('#notice').filter({hasText:'Inbox loaded.'}).waitFor();let releaseList;holdList=new Promise(r=>releaseList=r);const began=new Promise(r=>listStarted=r);await page.getByRole('button',{name:'Load inbox',exact:true}).click();await began;await page.locator('#items button').first().click();await page.locator('#detail').waitFor();releaseList();await page.waitForFunction(()=>!document.getElementById('next').disabled);assert.equal(await page.locator('#next').isVisible(),true);await page.locator('#note').fill('Keep my unsaved editorial review while finding related suggestions.');
  await page.getByLabel('Article',{exact:true}).selectOption('tool-use');await page.getByLabel('Exact tag').fill('urgent');await page.getByRole('button',{name:'Load inbox',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForResponse(r=>r.url().includes('article=tool-use')&&r.url().includes('tag=urgent'));await page.locator('#notice').filter({hasText:'Inbox loaded.'}).waitFor();assert.equal(await page.locator('#items button').count(),20);
  // Editing controls alone must not apply a different predicate to the old cursor.
  await page.getByLabel('Article',{exact:true}).selectOption('agent-memory');await page.getByRole('button',{name:'Next page'}).click();await page.waitForFunction(()=>document.querySelectorAll('#items button').length===4);assert.equal(queries.at(-1).get('article'),'tool-use');assert.ok(queries.at(-1).get('before'));
  await page.getByRole('button',{name:'Load inbox',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#items button').length===20);assert.equal(queries.at(-1).has('before'),false);assert.equal(queries.at(-1).get('article'),'agent-memory');
  await page.getByLabel('Exact tag').fill('absent');await page.getByRole('button',{name:'Load inbox',exact:true}).click();await page.getByText('No suggestions match these filters.').waitFor();assert.equal(await page.locator('#next').isVisible(),false);assert.match(await page.locator('#note').inputValue(),/^Keep my unsaved/);
  failed=true;await page.getByRole('button',{name:'Load inbox',exact:true}).click();await page.locator('#notice').filter({hasText:'Inbox unavailable.'}).waitFor();assert.match(await page.locator('#note').inputValue(),/^Keep my unsaved/);assert.equal(f.counts.outbound,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await f.close();}
});
