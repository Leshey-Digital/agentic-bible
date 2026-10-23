import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {contributionAdminCss} from '../../src/hosted/contribution-admin.ts';
import {draftAdminHtml,draftAdminJs} from '../../src/hosted/cloudflare-draft-admin.ts';
test('visible source-only control is bounded, accessible and never submits generation',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
 try{for(const mode of ['success','source-error','expired','uncertain']){
 const page=await browser.newPage({viewport:{width:390,height:844}});let calls=[];
 await page.route('https://staging.example/**',async route=>{const req=route.request(),url=new URL(req.url());if(url.pathname==='/admin/drafts/')return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"},body:draftAdminHtml});if(url.pathname==='/admin/drafts/app.js')return route.fulfill({contentType:'text/javascript',body:draftAdminJs});if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:contributionAdminCss});calls.push({path:url.pathname,body:req.postDataJSON(),headers:req.headers()});if(mode==='uncertain')return route.abort();return route.fulfill({status:mode==='expired'?403:mode==='source-error'?422:200,contentType:'application/json',body:JSON.stringify(mode==='success'?{kind:'source-only-qualification',requestKey:req.postDataJSON().requestKey,aiInvoked:false,published:false,approved:false,source:{raw:{bytes:[1,2,3],hash:'a'.repeat(64)},evidence:{text:'<img src=x onerror=alert(1)>',hash:'b'.repeat(64)}},receipt:{observedAt:1}}:{error:mode==='source-error'?'cloudflare_source_too_large':'unauthorized'})});});
 await page.goto('https://staging.example/admin/drafts/');assert.equal(calls.length,0);
 const button=page.getByRole('button',{name:'Check OpenAI source only'});await button.focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>!document.querySelector('#source-evidence').hidden);
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/admin/drafts/source');assert.equal(calls[0].body.sourceId,'s-90f2bf11e4fb71c8f42ae128');assert.equal(calls[0].headers['x-agentic-bible-request'],'admin');
 assert.equal(await button.isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Prepare private draft'}).isDisabled(),true);
 await page.locator('#draft-form').dispatchEvent('submit');assert.equal(calls.length,1);
 const status=await page.locator('#source-result').textContent();assert.match(status,mode==='success'?/succeeded/:mode==='expired'?/Sign in/:mode==='source-error'?/supported download size/:/unconfirmed/);
 assert.equal(await page.locator('#source-evidence img').count(),0);
 if(mode==='success'){const evidence=JSON.parse(await page.locator('#source-evidence').textContent());assert.equal(evidence.source.raw.byteLength,3);assert.equal(evidence.source.raw.bytes,undefined);assert.equal(evidence.aiInvoked,false);}
 for(const width of [390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.close();
 }}finally{await browser.close();}
});
