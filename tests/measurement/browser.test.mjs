import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const root=resolve('.'),site=resolve('dist');
async function setup(path,script,enabled=true,late=false){
 const bundle=await build({stdin:{contents:`import {createRecorder,aggregatePreview} from './src/measurement/aggregate.ts';import {installMeasurement} from './src/measurement/browser.ts';const a=aggregatePreview();window.measurementSnapshot=()=>a.snapshot();window.measurementConsent=true;window.installRecorder=()=>installMeasurement(createRecorder({enabled:${enabled},origin:'http://127.0.0.1',sink:a.sink}),()=>window.measurementConsent);if(!${late})window.installRecorder();await import('./src/scripts/${script}.ts');`,resolveDir:root},bundle:true,write:false,format:'esm',target:'es2022'});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const context=await browser.newContext();const page=await context.newPage();let outbound=0;
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1'){++outbound;return route.abort();}if(url.pathname==='/api/editorial/status')return route.fulfill({json:{enabled:false,mode:'local-synthetic-only',publicIntake:false}});
  const file=resolve(site,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(site+'/'))return route.abort();
  try{let body=readFileSync(file);if(extname(file)==='.html')body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));return route.fulfill({body,contentType:extname(file)==='.html'?'text/html':extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':'application/octet-stream'});}catch{return route.fulfill({status:404,body:'fixture missing'});}
 });
 const statusReady=late?page.waitForResponse(response=>response.url().endsWith('/api/editorial/status')):undefined;await page.goto('http://127.0.0.1'+path);await page.addScriptTag({type:'module',content:bundle.outputFiles[0].text});
 return {browser,page,context,statusReady,outbound:()=>outbound};
}
test('actual search emits only settled outcome and selection buckets; revocation and default-off retain nothing',{timeout:45000},async()=>{
 const f=await setup('/search/','search');try{
  await f.page.locator('#search-input').fill('prompt injection');await f.page.waitForFunction(()=>document.querySelectorAll('#search-results li').length>0);
  await f.page.locator('#search-results a').first().evaluate(a=>a.addEventListener('click',e=>e.preventDefault()));await f.page.locator('#search-results a').first().click();
  await f.page.locator('#search-input').fill('zzzxxyy-private-query');await f.page.locator('#no-results').waitFor({state:'visible'});
  let rows=await f.page.evaluate(()=>window.measurementSnapshot());assert.ok(rows.some(r=>r.measurement.signal.event==='search_select'));assert.ok(rows.some(r=>r.measurement.signal.results==='none'));assert.ok(!JSON.stringify(rows).includes('private-query'));assert.equal(f.outbound(),0);
  await f.page.evaluate(()=>window.measurementConsent=false);await f.page.locator('#search-input').fill('agent');await f.page.waitForFunction(()=>document.querySelectorAll('#search-results li').length>0);assert.deepEqual(await f.page.evaluate(()=>window.measurementSnapshot()),rows);
 }finally{await f.browser.close();}
 const off=await setup('/search/','search',false);try{await off.page.locator('#search-input').fill('agent');await off.page.waitForFunction(()=>document.querySelectorAll('#search-results li').length>0);assert.deepEqual(await off.page.evaluate(()=>window.measurementSnapshot()),[]);}finally{await off.browser.close();}
});
test('actual closed contribution page records no form contents, then unavailable search records only a category',{timeout:45000},async()=>{
 const f=await setup('/contribute/?article=tool-use','contribute');try{await f.page.waitForFunction(()=>window.measurementSnapshot().length===2);const rows=await f.page.evaluate(()=>window.measurementSnapshot());assert.deepEqual(rows.map(r=>r.measurement.signal),[{event:'contribution_open'},{event:'contribution_result',outcome:'closed'}]);assert.equal(await f.page.locator('#contribution-fields').evaluate(el=>el.disabled),true);assert.equal(await f.page.locator('#suggestion-message').isDisabled(),true);assert.equal(f.outbound(),0);}finally{await f.browser.close();}
 const failed=await setup('/search/','search');try{await failed.page.route('**/pagefind/**',route=>route.abort());await failed.page.locator('#search-input').fill('secret error query');await failed.page.locator('#search-error').waitFor({state:'visible'});const rows=await failed.page.evaluate(()=>window.measurementSnapshot());assert.deepEqual(rows.at(-1).measurement.signal,{event:'reader_error',component:'search'});assert.ok(!JSON.stringify(rows).includes('secret'));}finally{await failed.browser.close();}
});

test('granting consent after contribution initialization records only current public availability, once',{timeout:30000},async()=>{
 const f=await setup('/contribute/','contribute',true,true);try{await(await f.statusReady).finished();await f.page.evaluate(()=>new Promise(requestAnimationFrame));assert.deepEqual(await f.page.evaluate(()=>window.measurementSnapshot()),[]);await f.page.evaluate(()=>window.installRecorder());assert.equal((await f.page.evaluate(()=>window.measurementSnapshot())).length,2);assert.deepEqual((await f.page.evaluate(()=>window.measurementSnapshot())).map(r=>r.measurement.signal),[{event:'contribution_open'},{event:'contribution_result',outcome:'closed'}]);await f.page.evaluate(()=>window.installRecorder());assert.equal((await f.page.evaluate(()=>window.measurementSnapshot())).length,2);assert.equal(f.outbound(),0);}finally{await f.browser.close();}
});
