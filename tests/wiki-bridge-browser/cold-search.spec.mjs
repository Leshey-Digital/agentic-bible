import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {wikiServer} from '../../src/wiki-bridge/preview.ts';
import {git} from '../wiki-bridge/helpers.mjs';

test('cold current-snapshot search does not depend on Pagefind worker bootstrap',{timeout:30000},async({page})=>{
  const data=JSON.parse(readFileSync(join(git,'wiki-bridge-upgrade-record.json'),'utf8')),bridge=new WikiBridge(data.freshName),server=wikiServer(bridge),warnings=[];
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`;
  // A Worker can construct but never become ready. Pagefind 1.5.2 otherwise waits
  // five seconds, then repeats initialization on the main thread for this tiny index.
  await page.addInitScript(()=>{window.__workerAttempts=0;window.Worker=class extends EventTarget{constructor(){super();window.__workerAttempts++;}postMessage(){}terminate(){}};});
  page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
  try{
    await page.goto(`${origin}/wiki-snapshots/${data.fresh.site.id}/search/`);const started=Date.now();await page.locator('#search-input').fill('MemGPT');await page.locator('#search-form button[type=submit]').click();
    await expect(page.locator('#search-results>li')).toHaveCount(1,{timeout:10000});await expect(page.locator('#search-status')).toContainText('1 entry found');
    const elapsedMs=Date.now()-started,workerAttempts=await page.evaluate(()=>window.__workerAttempts);const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/pagefind/')).map(e=>({path:new URL(e.name).pathname,duration:e.duration,responseEnd:e.responseEnd})));
    const evidence={articles:data.newArticles,elapsedMs,workerAttempts,warnings,resources};writeFileSync(join(git,'wiki-cold-search-evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.info('Cold snapshot search: '+JSON.stringify(evidence));
    expect(workerAttempts,'bounded current index must not wait for worker fallback').toBe(0);expect(warnings.filter(w=>w.includes('falling back'))).toEqual([]);
  }finally{await new Promise(done=>server.close(done));}
});
