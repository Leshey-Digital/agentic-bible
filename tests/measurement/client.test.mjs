import test from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {build} from 'esbuild';import {chromium} from '@playwright/test';
import {publicMeasurementBuild} from '../../src/measurement/build.ts';
const html='<!doctype html><html lang="en"><head><title>Controlled consent fixture</title></head><body><main><h1>Library</h1><aside id="consent" hidden><p data-measurement-status role="status"></p><button data-measurement-allow>Allow aggregate measurement</button><button data-measurement-deny>Keep measurement off / revoke</button></aside></main></body></html>';
async function fixture({enabled=true,gpc=false,dnt=null}={}){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}),context=await browser.newContext();let external=0;
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!=='http://127.0.0.1'){external++;return route.abort();}return route.fulfill({contentType:'text/html',body:html});});
 await context.addInitScript(({gpc,dnt})=>{Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>gpc,configurable:true});Object.defineProperty(navigator,'doNotTrack',{get:()=>dnt,configurable:true});window.setInterval=fn=>{window.measurementTick=fn;return 1;};window.clearInterval=()=>{};},{gpc,dnt});
 const result=await build({stdin:{contents:`import {mountMeasurementConsent} from './src/measurement/client.ts';import {recordMeasurement} from './src/measurement/browser.ts';window.calls=[];window.emit=recordMeasurement;window.dispose=mountMeasurementConsent(document.getElementById('consent'),{enabled:${enabled},origin:'http://127.0.0.1',send:async(url,init)=>{window.calls.push({url,init});if(window.fail)throw Error('controlled unknown');if(window.hold)return new Promise(()=>{});return new Response('',{status:202});}});`,resolveDir:resolve('.')},bundle:true,write:false,format:'esm'});
 async function page(){const p=await context.newPage();await p.goto('http://127.0.0.1/search/');await p.addScriptTag({type:'module',content:result.outputFiles[0].text});await p.waitForFunction(()=>typeof window.emit==='function');return p;}
 return {browser,context,page,external:()=>external};
}
const tick=page=>page.evaluate(async()=>{window.measurementTick?.();await Promise.resolve();await Promise.resolve();});
test('build policy defaults off, rejects staging/private/synthetic and unknown configuration',()=>{
 const raw=JSON.stringify({enabled:true,schemaVersion:1,policyRevision:'aggregate-v1'}),context={mode:'canonical',origin:'https://agenticbible.si',path:'/search/',synthetic:false};assert.equal(publicMeasurementBuild(raw,context),true);
 for(const [input,c]of [[undefined,context],[JSON.stringify({enabled:true,schemaVersion:2,policyRevision:'aggregate-v1'}),context],[raw,{...context,mode:'staging'}],[raw,{...context,path:'/admin/'}],[raw,{...context,path:'/search/?q=secret'}],[raw,{...context,synthetic:true}]])assert.equal(publicMeasurementBuild(input,c),false);
});
test('explicit allow sends minimized first-party payload; denial/revocation clear queue; no retry after failure',{timeout:30000},async()=>{
 const f=await fixture();try{const p=await f.page();await p.evaluate(()=>window.emit({event:'search_complete',results:'none',expanded:false,query:'private'}));await tick(p);assert.equal(await p.evaluate(()=>calls.length),0);
 await p.getByRole('button',{name:'Allow aggregate measurement'}).click();await p.waitForFunction(()=>calls.length===1);let calls=await p.evaluate(()=>window.calls);assert.equal(calls[0].url,'/api/measurement');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.referrerPolicy,'no-referrer');assert.ok(!calls[0].init.body.includes('private'));
 await p.evaluate(()=>window.emit({event:'search_complete',results:'few',expanded:true}));await p.getByRole('button',{name:'Keep measurement off / revoke'}).click();await tick(p);assert.equal(await p.evaluate(()=>calls.length),1);assert.match(await p.locator('[data-measurement-status]').textContent(),/off/);
 await p.evaluate(()=>window.fail=true);await p.getByRole('button',{name:'Allow aggregate measurement'}).click();await p.waitForFunction(()=>calls.length===2);await p.waitForFunction(()=>document.querySelector('[data-measurement-status]').textContent.includes('paused'));await tick(p);await tick(p);assert.equal(await p.evaluate(()=>calls.length),2);await p.getByRole('button',{name:'Keep measurement off / revoke'}).click();await p.getByRole('button',{name:'Allow aggregate measurement'}).click();await tick(p);assert.equal(await p.evaluate(()=>calls.length),2);assert.equal(f.external(),0);
 }finally{await f.browser.close();}
});
test('cross-tab denial, preference deletion and clear stop an already mounted recorder',{timeout:30000},async()=>{
 const f=await fixture();try{const a=await f.page(),b=await f.page();await a.getByRole('button',{name:'Allow aggregate measurement'}).click();await a.waitForFunction(()=>calls.length===1);
 for(const op of ['deny','remove','clear']){if(op!=='deny'){await a.getByRole('button',{name:'Allow aggregate measurement'}).click();await a.waitForFunction(()=>document.querySelector('[data-measurement-status]').textContent.includes('on.'));}
 const count=await a.evaluate(()=>calls.length);await a.evaluate(()=>window.emit({event:'search_complete',results:'none',expanded:false}));
 if(op==='deny')await b.getByRole('button',{name:'Keep measurement off / revoke'}).click();else await b.evaluate(op=>{if(op==='remove')localStorage.removeItem('agentic-bible-aggregate-consent-v1');else localStorage.clear();},op);
 await a.waitForFunction(()=>document.querySelector('[data-measurement-status]').textContent.includes('off.'));await tick(a);assert.equal(await a.evaluate(()=>calls.length),count);
 }assert.equal(f.external(),0);
 }finally{await f.browser.close();}
});
test('browser opt-outs and disabled build prevent all sends; repeated grants cannot reset32/page',{timeout:30000},async()=>{
 for(const options of [{enabled:false},{gpc:true},{dnt:'1'}]){const f=await fixture(options);try{const p=await f.page();if(options.enabled===false)assert.equal(await p.locator('#consent').isVisible(),false);else assert.equal(await p.locator('[data-measurement-allow]').isDisabled(),true);await p.evaluate(()=>window.emit({event:'search_complete',results:'many',expanded:false}));await tick(p);assert.equal(await p.evaluate(()=>calls.length),0);}finally{await f.browser.close();}}
 const f=await fixture();try{const p=await f.page();for(let i=0;i<40;i++){await p.getByRole('button',{name:'Allow aggregate measurement'}).click();await tick(p);await p.getByRole('button',{name:'Keep measurement off / revoke'}).click();}const count=await p.evaluate(()=>calls.reduce((n,c)=>n+JSON.parse(c.init.body).events.length,0));assert.equal(count,32);assert.equal(f.external(),0);}finally{await f.browser.close();}
});
test('a hung send stops at five seconds and consent toggles cannot retry it',{timeout:8000},async()=>{
 const f=await fixture();try{const p=await f.page();await p.evaluate(()=>window.hold=true);await p.getByRole('button',{name:'Allow aggregate measurement'}).click();await p.waitForFunction(()=>calls.length===1);await p.waitForFunction(()=>document.querySelector('[data-measurement-status]').textContent.includes('paused'),{},{timeout:6500});await p.getByRole('button',{name:'Keep measurement off / revoke'}).click();await p.getByRole('button',{name:'Allow aggregate measurement'}).click();await tick(p);assert.equal(await p.evaluate(()=>calls.length),1);assert.equal(f.external(),0);}finally{await f.browser.close();}
});
