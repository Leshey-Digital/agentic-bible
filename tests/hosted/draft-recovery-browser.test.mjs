import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {draftAdminHtml,draftAdminJs,sourceAttemptJs,draftRecoveryJs} from '../../src/hosted/cloudflare-draft-admin.ts';
import {contributionAdminCss} from '../../src/hosted/contribution-admin.ts';
test('real browser preserves failed generation ID across reload and explicitly recovers without another generation',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});try{const page=await browser.newPage({viewport:{width:390,height:844}}),calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://staging.example/**',route=>{const r=route.request(),path=new URL(r.url()).pathname;
 if(path==='/admin/drafts/')return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'"},body:draftAdminHtml});
 if(path.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:draftAdminJs+sourceAttemptJs+draftRecoveryJs});
 if(path.endsWith('.css'))return route.fulfill({contentType:'text/css',body:contributionAdminCss});
 calls.push({path,body:r.postDataJSON()});return route.fulfill({status:path.endsWith('/recover')?200:503,contentType:'application/json',body:JSON.stringify(path.endsWith('/recover')?{submissionId:'11111111-1111-4111-8111-111111111111',approved:false,published:false}:{error:'draft_save_unconfirmed'})});});
 await page.goto('https://staging.example/admin/drafts/');assert.equal(calls.length,0);await page.getByRole('button',{name:'Prepare private draft',exact:true}).click();await page.waitForFunction(()=>localStorage.getItem('agentic-bible-private-draft-request'));const key=await page.evaluate(()=>localStorage.getItem('agentic-bible-private-draft-request'));await page.reload();await page.waitForFunction(key=>document.querySelector('#recovery-key').value===key,key);assert.equal(calls.length,1);
 await page.locator('#draft-recovery-form button').click();await page.locator('#recovery-result').filter({hasText:'saved in the private inbox'}).waitFor();assert.deepEqual(calls.map(c=>c.path),['/api/admin/drafts/cloudflare','/api/admin/drafts/recover']);assert.deepEqual(calls[1].body,{requestKey:key});assert.equal(calls[0].body.requestKey,key);assert.deepEqual(errors,[]);assert.equal(await page.locator('#recovered-inbox').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await browser.close();}
});
