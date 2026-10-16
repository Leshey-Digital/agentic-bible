import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {inventory} from '../../src/wiki-bridge/files.ts';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {prepareWikiEvidence} from '../../scripts/wiki-bridge-demo.mjs';
import {packet,clean,accounting} from './helpers.mjs';
test('parallel full builds preserve caller prerender cache and ordinary dist',{timeout:120000},async()=>{
  const names=['wiki-bridge-test-isolation-one','wiki-bridge-test-isolation-two'],observations='wiki-observations-test-isolation';for(const name of [...names,observations])clean(name);
  await prepareWikiEvidence(observations);const local=await localObservations(observations);const before=await accounting(local.db);
  const cache=join(process.cwd(),'.astro','.prerender'),sentinel=join(cache,`isolation-proof-${process.pid}.txt`);mkdirSync(cache,{recursive:true});writeFileSync(sentinel,'Caller-owned prerender cache must survive.');
  const cached=inventory(cache),dist=existsSync('dist')?inventory('dist'):null;const markdown=inventory('src/content/articles');
  try{
    const stores=names.map(name=>new WikiBridge(name));const results=await Promise.allSettled(stores.map(store=>store.execute(packet(),local.db,'fixtures/wiki-bridge/sources')));
    assert.ok(existsSync(sentinel),'caller-owned prerender cache was deleted');
    assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'fulfilled');assert.equal(results[0].value.site.id,results[1].value.site.id,'identical inputs should produce the same site identity in distinct stores');
    for(const [i,settled]of results.entries()){assert.equal(settled.status,'fulfilled');const result=settled.value;assert.equal(result.outcome,'site-activated');assert.equal(stores[i].current().manifest.state.events.length,1);assert.ok(readFileSync(join(stores[i].root,'sites',result.site.id,'articles/tool-use/index.html'),'utf8').includes('Cedarharbor'));}
    assert.deepEqual(inventory(cache),cached);if(dist)assert.deepEqual(inventory('dist'),dist);assert.deepEqual(inventory('src/content/articles'),markdown);assert.deepEqual(await accounting(local.db),before);
  }finally{rmSync(sentinel,{force:true});await local.runtime.dispose();}
});
