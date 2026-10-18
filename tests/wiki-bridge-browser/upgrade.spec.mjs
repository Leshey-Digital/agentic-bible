import {test,expect} from '@playwright/test';
import {readingArticleIds} from '../../src/lib/article-ids.ts';
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
  const additions=[['agent-planning','Tree of Thoughts'],['durable-agent-execution','Temporal'],['tool-permissions','RFC 8707'],['agent-sandboxing','Gofer'],['agent-observability','OpenTelemetry'],['human-oversight','Amershi'],["context-engineering", "Lost in the Middle",2],["structured-outputs", "JSON Schema 2020-12"],["agent-identity", "SPIFFE ID"],["agent-to-agent-communication", "A2A"],["agent-budgets", "MaxTurnsExceeded"],["computer-use-agents", "OSWorld"]];
  try{
    const origin=await start(bridge);await page.goto(origin+'/articles/tool-use/');await expect(page.locator('.prose')).toContainText('Elderbrook');
    await page.goto(`${origin}/wiki-snapshots/${data.first.site.id}/articles/tool-use/`);await expect(page.locator('.prose')).toContainText('Cedarharbor');
    await page.goto(`${origin}/wiki-snapshots/${data.first.site.id}/history/tool-use/${data.first.articleRevision}.html`);await expect(page.locator('.prose')).toContainText('Cedarharbor');
    await search(origin,data.first,'Cedarharbor',1);await search(origin,data.second,'Elderbrook',1);await search(origin,data.second,'Cedarharbor',0);
    const catalog=await(await page.request.get(`${origin}/wiki-snapshots/${data.second.site.id}/source-catalog.json`)).json();expect(catalog.articles.map(a=>a.id).sort()).toEqual(['ai-agent','model-context-protocol','tool-use']);
    for(const [id]of additions)expect((await page.request.get(`${origin}/wiki-snapshots/${data.second.site.id}/articles/${id}/`)).status()).toBe(404);
    await search(origin,data.second,'Tree of Thoughts',0);expect((await page.request.get(`${origin}/wiki-snapshots/${data.second.site.id}/sitemap.xml`)).status()).toBe(404);
    expect((await page.request.get(origin+'/articles/agent-memory/')).status()).toBe(404);
    let sql=0;const forbidden={prepare(){sql++;throw Error('replay D1 SQL forbidden');},batch(){sql++;throw Error('replay D1 SQL forbidden');}};
    expect(await bridge.execute(data.firstCommand,forbidden,'fixtures/wiki-bridge/sources')).toEqual(data.first);expect(await bridge.execute(data.secondCommand,forbidden,'fixtures/wiki-bridge/sources')).toEqual(data.second);
    const currentOrigin=await start(fresh);expect(data.newArticles).toBe(20);expect(readingArticleIds).toHaveLength(20);await search(currentOrigin,data.fresh,'MemGPT',1);for(const [,term,count=1]of additions)await search(currentOrigin,data.fresh,term,count);expect((await(await page.request.get(currentOrigin+'/source-catalog.json')).json()).articles.map(a=>a.id).sort()).toEqual([...readingArticleIds].sort());
    const freshSites=inventory(join(fresh.root,'sites')),freshCurrent=fresh.current(),freshPublisher=fresh.publisher.current()?.reference??null,freshPending=fresh.status().pending;
    expect(freshCurrent?.reference).toEqual(data.fresh.site);expect(freshPending).toContainEqual({eventId:data.pendingCommand.eventId,phase:'evidence-validated/article-pending',buildAttempts:0});
    await expect(fresh.execute(data.firstCommand,forbidden,'fixtures/wiki-bridge/sources')).rejects.toMatchObject({code:'bridge_event_conflict'});
    expect(fresh.current()?.reference).toEqual(freshCurrent?.reference);expect(fresh.publisher.current()?.reference??null).toEqual(freshPublisher);expect(fresh.status().pending).toEqual(freshPending);expect(inventory(join(fresh.root,'sites'))).toEqual(freshSites);
    expect(await fresh.execute(data.freshCommand,forbidden,'fixtures/wiki-bridge/sources')).toEqual(data.fresh);expect(await fresh.execute(data.freshCommand,forbidden,'fixtures/wiki-bridge/sources')).toEqual(data.fresh);
    expect(fresh.current()?.reference).toEqual(freshCurrent?.reference);expect(fresh.publisher.current()?.reference??null).toEqual(freshPublisher);expect(fresh.status().pending).toEqual(freshPending);expect(inventory(join(fresh.root,'sites'))).toEqual(freshSites);
    expect(sql).toBe(0);expect(await accounting(local.db)).toEqual(data.accounting);expect(fetches).toBe(0);expect(outside).toEqual([]);expect(errors).toEqual([]);expect(inventory(join(bridge.root,'sites'))).toEqual(sites);expect(inventory('src/content/articles')).toEqual(original);expect(inventory('dist')).toEqual(dist);
    writeFileSync(join(git,'wiki-bridge-upgrade-browser-evidence.json'),JSON.stringify({legacyArticles:3,newArticles:data.newArticles,historicalPagefind:true,currentPagefind:true,newTopicSearches:additions,legacyNewTopicsAbsent:true,historicalSitemapAbsent:true,legacyReplays:2,currentReplay:true,replayD1Sql:sql,sourceFetches:fetches,chargesPreserved:true,oldSnapshotsUnchanged:true},null,2)+'\n');
  }finally{for(const server of servers)await new Promise(done=>server.close(done));await local.runtime.dispose();await close();}
});

test('retained eight- and fourteen-entry Pagefind indexes keep their own historical topic inventories',async({page})=>{
  const proofs=JSON.parse(readFileSync(join(git,'wiki-historical-eight-fourteen.json'),'utf8'));const servers=[];
  try{for(const proof of proofs){const bridge=new WikiBridge(proof.name),before=inventory(join(bridge.root,'sites')),server=wikiServer(bridge);await new Promise(done=>server.listen(0,'127.0.0.1',done));servers.push(server);const origin=`http://127.0.0.1:${server.address().port}`;
    expect((await(await page.request.get(origin+'/source-catalog.json')).json()).articles).toHaveLength(proof.articles);
    for(const [query,count]of [['MemGPT',1],['Tree of Thoughts',proof.articles===14?1:0]]){await page.goto(`${origin}/wiki-snapshots/${proof.site.id}/search/`);await page.locator('#search-input').fill('"'+query+'"');await page.locator('#search-form button[type=submit]').click();await expect(page.locator('#search-status')).toContainText(`${count} ${count===1?'entry':'entries'} found`);await expect(page.locator('#search-results>li')).toHaveCount(count);}
    expect(inventory(join(bridge.root,'sites'))).toEqual(before);
  }}finally{for(const server of servers)await new Promise(done=>server.close(done));}
});
