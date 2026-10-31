import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {setupRevisionPreview} from './revision-preview-fixture.mjs';
import {contributionAdminHtml,contributionAdminCss,contributionAdminJs} from '../../src/hosted/contribution-admin.ts';
for(const width of [1440,390])for(const mode of ['confirmed','stale','mismatch'])test(`preview to draft handles unknown response, explicit reconciliation and ${mode} at ${width}px`,{timeout:30000},async()=>{
 const t=await setupRevisionPreview({drafts:true});let browser,drop=true,hold=false,release,reached;let sent=0;const errors=[];
 const server=createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/')){let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):undefined;const result=await t.request(req.url,body,{method:req.method});
   if(req.url==='/api/admin/corrections/github-proposal'){sent++;assert.deepEqual(body,{approvalId:t.review.approvalId});if(drop){drop=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'controlled_lost_browser_response'}));return;}if(mode==='mismatch')result.value.markdownSha256='0'.repeat(64);if(hold)await new Promise(resolve=>{release=resolve;reached();});}
   res.writeHead(result.status,{'Content-Type':'application/json'});res.end(JSON.stringify(result.value));return;}
  const [body,type]=req.url.endsWith('app.js')?[contributionAdminJs,'application/javascript']:req.url.endsWith('style.css')?[contributionAdminCss,'text/css']:[contributionAdminHtml,'text/html'];res.writeHead(200,{'Content-Type':type});res.end(body);
 }catch(error){errors.push(String(error));res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'controlled_bridge_failure'}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium'});const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}/admin/contributions/`);await page.locator('#status').selectOption('follow-up');await page.getByRole('button',{name:'Load inbox',exact:true}).click();await page.locator('#items button').click();await page.getByRole('button',{name:'Preview article revision',exact:true}).click();await page.locator('#revision-preview').waitFor({state:'visible'});
  const draft='Keep this newer unsaved editorial text while the already saved review is proposed.';await page.locator('#note').fill(draft);
  await page.getByRole('button',{name:'Request GitHub draft',exact:true}).focus();await page.keyboard.press('Enter');await page.locator('#revision-draft-state').filter({hasText:'unconfirmed'}).waitFor();assert.equal(sent,1);assert.equal(t.f.gh.state.pulls.length,1);assert.equal(await page.locator('#note').inputValue(),draft);assert.equal(await page.locator('#revision-draft-link').isVisible(),false);
  // Reloading history cannot forget an uncertain same-approval request.
  await page.locator('#reload-history').click();await page.getByRole('button',{name:'Preview article revision',exact:true}).click();const reconcile=page.getByRole('button',{name:'Reconcile GitHub draft',exact:true});await reconcile.waitFor();
  if(mode==='mismatch'){await reconcile.click();await page.locator('#revision-draft-state').filter({hasText:'unconfirmed'}).waitFor();assert.equal(sent,2);assert.equal(await page.locator('#revision-draft-link').isVisible(),false);assert.equal(t.f.gh.state.pulls.length,1);assert.equal(await page.locator('#note').inputValue(),draft);assert.deepEqual(errors,[]);return;}
  if(mode==='confirmed'){const calls=t.f.gh.state.calls.length;await reconcile.click();await page.locator('#revision-draft-state').filter({hasText:'GitHub draft recorded for this exact preview'}).waitFor();assert.equal(await page.locator('#request-revision-draft').isDisabled(),true);assert.equal(await page.locator('#revision-draft-link').getAttribute('href'),'https://github.com/Leshey-Digital/agentic-bible/pull/'+t.f.gh.state.pulls[0].number);assert.equal(t.f.gh.state.calls.length,calls);assert.equal(sent,2);assert.equal(await page.locator('#note').inputValue(),draft);assert.deepEqual((await new AxeBuilder({page}).analyze()).violations,[]);await page.locator('#revision-preview').screenshot({path:'/tmp/agentic-preview-draft-'+width+'.png'});assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);return;}
  const calls=t.f.gh.state.calls.length;hold=true;const held=new Promise(resolve=>{reached=resolve;});await reconcile.click();await held;assert.equal(await reconcile.isDisabled(),true);assert.equal(sent,2);assert.equal(t.f.gh.state.calls.length,calls);
  await page.locator('#tags').fill('superseded');await page.getByRole('button',{name:'Save disposition and tags',exact:true}).click();await page.locator('#review-history').filter({hasText:'stale approval'}).waitFor();const complete=page.waitForResponse(response=>response.url().endsWith('/github-proposal'));release();release=null;await complete;
  assert.equal(await page.locator('#revision-preview').isVisible(),false);assert.equal(await page.locator('#note').inputValue(),draft);assert.equal(await page.locator('#revision-draft-link').isVisible(),false);assert.equal(t.f.gh.state.pulls.length,1);assert.equal(t.f.gh.state.main,t.review.baseCommit);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 }finally{release?.();await browser?.close();await new Promise(resolve=>server.close(resolve));await t.f.close();}
});
