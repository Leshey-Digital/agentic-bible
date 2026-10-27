import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {setupRevisionPreview} from './revision-preview-fixture.mjs';
import {contributionAdminHtml,contributionAdminCss,contributionAdminJs} from '../../src/hosted/contribution-admin.ts';
for(const width of [1440,390])test(`native saved review to article/diff preview preserves drafts and ignores stale responses at ${width}px`,{timeout:30000},async()=>{
 const t=await setupRevisionPreview();let browser,release,reached,hold=false;const errors=[],held=new Promise(resolve=>{reached=resolve;});
 const server=createServer(async(req,res)=>{
  try{if(req.url.startsWith('/api/')){let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):undefined;const result=await t.request(req.url,body,{method:req.method});if(req.url.endsWith('/revision-preview')){assert.equal(req.method,'POST');assert.deepEqual(body,{approvalId:t.review.approvalId});if(hold){hold=false;await new Promise(resolve=>{release=resolve;reached();});}}res.writeHead(result.status,{'Content-Type':'application/json'});res.end(JSON.stringify(result.value));return;}
   const [body,type]=req.url.endsWith('app.js')?[contributionAdminJs,'application/javascript']:req.url.endsWith('style.css')?[contributionAdminCss,'text/css']:[contributionAdminHtml,'text/html'];res.writeHead(200,{'Content-Type':type});res.end(body);
  }catch(error){errors.push(String(error));res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'controlled_bridge_failure'}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{browser=await chromium.launch({executablePath:'/usr/bin/chromium'});const page=await browser.newPage({viewport:{width,height:950}});page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/admin/contributions/`);await page.locator('#status').selectOption('follow-up');await page.getByRole('button',{name:'Load inbox',exact:true}).click();await page.locator('#items button').click();const preview=page.getByRole('button',{name:'Preview article revision',exact:true});await preview.waitFor();
  const draft='Preserve this newer unsaved editorial note while inspecting the already saved revision.';await page.locator('#note').fill(draft);await preview.focus();await page.keyboard.press('Enter');await page.locator('#revision-preview').waitFor({state:'visible'});
  assert.ok((await page.locator('#revision-markdown').textContent()).startsWith(t.markdown));assert.match(await page.locator('#revision-diff').textContent(),/\+## Reviewed correction/);assert.ok((await page.locator('#revision-pins').textContent()).includes(t.review.approvalId));assert.equal(await page.locator('#note').inputValue(),draft);assert.match(await page.locator('#revision-state').textContent(),/No GitHub request or publication/);assert.equal(await page.locator('#revision-preview img').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#revision-preview').screenshot({path:'/tmp/agentic-revision-preview-'+width+'.png'});
  const pendingButton=await preview.elementHandle();hold=true;await preview.click();await page.waitForFunction(()=>document.getElementById('revision-state').textContent.includes('Preparing'));
  // Hold only the completed native backend response; changing the actual D1
  // submission revision must prevent the old preview from reappearing.
  await held;
  await page.locator('#tags').fill('superseded');await page.getByRole('button',{name:'Save disposition and tags',exact:true}).click();await page.locator('#review-history').filter({hasText:'stale approval'}).waitFor();const completed=page.waitForResponse(response=>response.url().endsWith('/revision-preview'));release();await completed;await page.waitForFunction(button=>!button.disabled,pendingButton);
  assert.equal(await page.locator('#revision-preview').isVisible(),false);assert.equal(await page.locator('#note').inputValue(),draft);assert.equal((await t.f.db.prepare('SELECT version FROM submissions').first()).version,3);assert.equal(t.f.gh.state.calls.length,0);assert.equal((await t.f.db.prepare('SELECT COUNT(*) n FROM github_content_proposals').first()).n,0);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{release?.();await browser?.close();await new Promise(resolve=>server.close(resolve));await t.f.close();}
});
