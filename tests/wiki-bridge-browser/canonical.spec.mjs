import {readingArticleIds} from '../../src/lib/article-ids.ts';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {close as closePagefind} from 'pagefind';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {wikiServer} from '../../src/wiki-bridge/preview.ts';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {prepareWikiEvidence} from '../../scripts/wiki-bridge-demo.mjs';
import {inventory} from '../../src/wiki-bridge/files.ts';
import {git,packet,clean,accounting,successor} from '../wiki-bridge/helpers.mjs';

test('canonical wiki, citations, catalog, retained history and real Pagefind activate and roll back together',async({page})=>{
  const name='wiki-bridge-test-browser',observations='wiki-observations-test-browser';clean(name);clean(observations);
  const original=inventory('src/content/articles'),dist=inventory('dist');
  expect((await prepareWikiEvidence(observations)).fetches).toBe(2);
  let sourceFetches=0;const local=await localObservations(observations,false,()=>{sourceFetches++;throw new Error('bridge fetch forbidden');});
  const charged=await accounting(local.db);let bridge=new WikiBridge(name),server=wikiServer(bridge);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,outside=[],errors=[];page.on('request',request=>{if(new URL(request.url()).origin!==origin)outside.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
  const search=async(site,term,count)=>{
    await page.goto(`${origin}/wiki-snapshots/${site}/search/`);await page.locator('#search-input').fill(`"${term}"`);await page.locator('#search-form button[type=submit]').click();
    await expect(page.locator('#search-status')).toHaveText(`${count} ${count===1?'entry':'entries'} found for “"${term}"”.`);
    await expect(page.locator('#search-results>li')).toHaveCount(count);
    if(count)await expect(page.locator('#search-results a').first()).toHaveAttribute('href',new RegExp(`^/wiki-snapshots/${site}/articles/`));
  };
  try{
    const firstPacket=packet(),first=await bridge.execute(firstPacket,local.db,'fixtures/wiki-bridge/sources');
    await page.goto(origin+'/articles/tool-use/');expect(page.url()).toBe(`${origin}/wiki-snapshots/${first.site.id}/articles/tool-use/`);
    await expect(page.locator('article')).toContainText('Cedarharbor');await expect(page.locator('article')).not.toContainText('corresponding call identifier');
    for(const evidence of firstPacket.evidence){await expect(page.locator(`#source-${evidence.citationId}`)).toContainText(evidence.bodyHash);await expect(page.locator(`#source-${evidence.citationId}`)).toContainText(evidence.sourceId);await expect(page.locator(`#source-${evidence.citationId}`)).toContainText(evidence.receiptKey);}
    await expect(page.locator('#revision')).toContainText(first.articleRevision);await expect(page.locator('#revision')).toContainText(first.publisher.id);
    for(const path of ['/','/topics/capabilities/']){await page.goto(origin+path);await expect(page.locator('main')).toContainText('Published local demonstration');await expect(page.locator('a[href="/wiki-snapshots/'+first.site.id+'/articles/tool-use/"]').first()).toBeVisible();}
    const catalog=await (await page.request.get(origin+'/source-catalog.json')).json();expect(catalog.articles.map(a=>a.id).sort()).toEqual([...readingArticleIds].sort());for(const e of firstPacket.evidence)expect(catalog.sources.find(s=>s.id===e.sourceId)).toMatchObject({url:e.url,articleIds:expect.arrayContaining(['tool-use'])});
    await search(first.site.id,'Cedarharbor',1);await search(first.site.id,'corresponding call identifier',0);await search(first.site.id,'pattern of control',1);await search(first.site.id,'host application',1);
    for(const term of ['orchestrator produces subtasks','MemGPT','RAG-Sequence','τ-bench','AgentDojo'])await search(first.site.id,term,1);
    await page.goto(origin+'/articles/tool-use/');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:'test-results/wiki-bridge/canonical-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
    const secondPacket=successor(bridge,'wiki-browser-second'),second=await bridge.execute(secondPacket,local.db,'fixtures/wiki-bridge/sources');
    bridge=new WikiBridge(name);expect(await bridge.execute(firstPacket,local.db,'fixtures/wiki-bridge/sources')).toEqual(first);expect(bridge.current().reference).toEqual(second.site);
    await search(second.site.id,'Elderbrook',1);await search(second.site.id,'Cedarharbor',0);await search(first.site.id,'Cedarharbor',1);
    await page.goto(origin+'/history/');await expect(page.locator('#article-tool-use li')).toHaveCount(2);await page.goto(origin+`/history/tool-use/${first.articleRevision}.html`);await expect(page.locator('body')).toContainText(firstPacket.evidence[0].bodyHash);
    await page.goto(origin+'/review/');await expect(page.locator('main')).toContainText('Editorial review requested');
    const stale=successor(bridge,'wiki-browser-stale');stale.expectedSite=first.site;await expect(bridge.execute(stale,local.db,'fixtures/wiki-bridge/sources')).rejects.toMatchObject({code:'stale_site_parent'});expect(bridge.current().reference).toEqual(second.site);
    const rollback={schemaVersion:1,kind:'rollback',mode:'local-synthetic-only',eventId:'wiki-browser-rollback',originalMarkdownHash:firstPacket.originalMarkdownHash,expectedSite:second.site,expectedPublisher:second.publisher,targetSite:first.site};
    const restored=await bridge.execute(rollback,local.db,'fixtures/wiki-bridge/sources');await search(restored.site.id,'Cedarharbor',1);await search(restored.site.id,'Elderbrook',0);
    expect(await new WikiBridge(name).execute(rollback,local.db,'fixtures/wiki-bridge/sources')).toEqual(restored);expect(await bridge.execute(secondPacket,local.db,'fixtures/wiki-bridge/sources')).toEqual(second);expect(bridge.current().reference).toEqual(restored.site);
    const baseline=await bridge.execute({...rollback,eventId:'wiki-browser-baseline',expectedSite:restored.site,expectedPublisher:restored.publisher,targetSite:null},local.db,'fixtures/wiki-bridge/sources');await search(baseline.site.id,'Cedarharbor',0);await search(baseline.site.id,'corresponding call identifier',1);await search(baseline.site.id,'pattern of control',1);
    expect(bridge.current().manifest.state.events).toHaveLength(4);expect(bridge.current().manifest.state.proofs).toHaveLength(2);expect(bridge.publisher.current().manifest.state.history['tool-use']).toHaveLength(2);expect(bridge.publisher.current().manifest.state.receipts).toHaveLength(4);
    await page.goto(origin+'/history/');await expect(page.locator('#article-tool-use li')).toHaveCount(2);expect(await accounting(local.db)).toEqual(charged);expect(sourceFetches).toBe(0);expect(outside).toEqual([]);expect(errors).toEqual([]);expect(inventory('src/content/articles')).toEqual(original);expect(inventory('dist')).toEqual(dist);
    // Artifact corruption fails closed; restoring bytes restores availability without a rebuild.
    const artifact=join(bridge.root,'sites',baseline.site.id,'articles/tool-use/index.html'),bytes=readFileSync(artifact);writeFileSync(artifact,'tampered');expect((await page.request.get(origin+'/articles/tool-use/')).status()).toBe(503);writeFileSync(artifact,bytes);expect(bridge.current().reference).toEqual(baseline.site);
    writeFileSync(join(git,'wiki-bridge-browser-evidence.json'),JSON.stringify({first,second,restored,baseline,realPagefind:true,chargesPreserved:true,bridgeFetches:sourceFetches,externalRequests:outside,runtimeErrors:errors,originalMarkdownAndDistPreserved:true,mobileAndAxe:true},null,2)+'\n');
  }finally{await new Promise(resolve=>server.close(resolve));await local.runtime.dispose();await closePagefind();}
});
