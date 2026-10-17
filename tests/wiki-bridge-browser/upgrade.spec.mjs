import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {close} from 'pagefind';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {wikiServer} from '../../src/wiki-bridge/preview.ts';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {inventory} from '../../src/wiki-bridge/files.ts';
import {git,accounting} from '../wiki-bridge/helpers.mjs';
test('an actual pre-expansion store retains current/history Pagefind and exact replay under the upgraded reader',async({page})=>{
  const data=JSON.parse(readFileSync(join(git,'wiki-bridge-upgrade-record.json'),'utf8')),bridge=new WikiBridge(data.name),fresh=new WikiBridge(data.freshName),servers=[],origins=new Set(),outside=[],errors=[];
  let fetches=0;const local=await localObservations(data.observations,false,()=>{fetches++;throw Error('upgrade source fetch forbidden');});
  const original=inventory('src/content/articles'),dist=inventory('dist'),sites=inventory(join(bridge.root,'sites'));
  const start=async store=>{const server=wikiServer(store);await new Promise(done=>server.listen(0,'127.0.0.1',done));servers.push(server);const origin=`http://127.0.0.1:${server.address().port}`;origins.add(origin);return origin;};
  page.on('request',request=>{if(!origins.has(new URL(request.url()).origin))outside.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
  const search=async(origin,receipt,term,count)=>{await page.goto(`${origin}/wiki-snapshots/${receipt.site.id}/search/`);await page.locator('#search-input').fill(`"${term}"`);await page.locator('#search-form button[type=submit]').click();await expect(page.locator('#search-results>li')).toHaveCount(count);await expect(page.locator('#search-status')).toContainText(`${count} ${count===1?'entry':'entries'} found`);};
  try{
    const origin=await start(bridge);await page.goto(origin+'/articles/tool-use/');await expect(page.locator('.prose')).toContainText('Elderbrook');
    await page.goto(`${origin}/wiki-snapshots/${data.first.site.id}/articles/tool-use/`);await expect(page.locator('.prose')).toContainText('Cedarharbor');
    await page.goto(`${origin}/wiki-snapshots/${data.first.site.id}/history/tool-use/${data.first.articleRevision}.html`);await expect(page.locator('.prose')).toContainText('Cedarharbor');
    await search(origin,data.first,'Cedarharbor',1);await search(origin,data.second,'Elderbrook',1);await search(origin,data.second,'Cedarharbor',0);
    const catalog=await(await page.request.get(`${origin}/wiki-snapshots/${data.second.site.id}/source-catalog.json`)).json();expect(catalog.articles).toHaveLength(3);
    expect((await page.request.get(origin+'/articles/agent-memory/')).status()).toBe(404);
    let sql=0;const forbidden={prepare(){sql++;throw Error('replay D1 SQL forbidden');},batch(){sql++;throw Error('replay D1 SQL forbidden');}};
    expect(await bridge.execute(data.firstCommand,forbidden,'fixtures/wiki-bridge/sources')).toEqual(data.first);expect(await bridge.execute(data.secondCommand,forbidden,'fixtures/wiki-bridge/sources')).toEqual(data.second);
    const currentOrigin=await start(fresh);await search(currentOrigin,data.fresh,'MemGPT',1);expect((await(await page.request.get(currentOrigin+'/source-catalog.json')).json()).articles).toHaveLength(data.newArticles);
    expect(await fresh.execute(data.firstCommand,forbidden,'fixtures/wiki-bridge/sources')).toEqual(data.fresh);expect(sql).toBe(0);expect(await accounting(local.db)).toEqual(data.accounting);expect(fetches).toBe(0);expect(outside).toEqual([]);expect(errors).toEqual([]);expect(inventory(join(bridge.root,'sites'))).toEqual(sites);expect(inventory('src/content/articles')).toEqual(original);expect(inventory('dist')).toEqual(dist);
    writeFileSync(join(git,'wiki-bridge-upgrade-browser-evidence.json'),JSON.stringify({legacyArticles:3,newArticles:data.newArticles,historicalPagefind:true,currentPagefind:true,legacyReplays:2,currentReplay:true,replayD1Sql:sql,sourceFetches:fetches,chargesPreserved:true,oldSnapshotsUnchanged:true},null,2)+'\n');
  }finally{for(const server of servers)await new Promise(done=>server.close(done));await local.runtime.dispose();await close();}
});
