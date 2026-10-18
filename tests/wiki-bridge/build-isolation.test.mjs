import {runtimeNetworkDiagnostics} from '../support/network-diagnostics.mjs';
import {safeFailure} from '../../src/wiki-bridge/diagnostics.ts';
import {wikiServer} from '../../src/wiki-bridge/preview.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {inventory} from '../../src/wiki-bridge/files.ts';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {prepareWikiEvidence} from '../../scripts/wiki-bridge-demo.mjs';
import {packet,clean,accounting,git} from './helpers.mjs';
test('parallel full builds preserve caller prerender cache and ordinary dist',{timeout:120000},async()=>{
  const names=['wiki-bridge-test-isolation-one','wiki-bridge-test-isolation-two'],observations='wiki-observations-test-isolation';for(const name of [...names,observations])clean(name);
  await prepareWikiEvidence(observations);const local=await localObservations(observations);const before=await accounting(local.db);
  const cache=join(process.cwd(),'.astro','.prerender'),sentinel=join(cache,`isolation-proof-${process.pid}.txt`);mkdirSync(cache,{recursive:true});writeFileSync(sentinel,'Caller-owned prerender cache must survive.');
  const cached=inventory(cache),dist=existsSync('dist')?inventory('dist'):null;const markdown=inventory('src/content/articles');
  try{
    const stores=names.map(name=>new WikiBridge(name));const results=await Promise.allSettled(stores.map(store=>store.execute(packet(),local.db,'fixtures/wiki-bridge/sources')));
    const summary=results.map(r=>r.status==='fulfilled'?{status:r.status}:{status:r.status,error:safeFailure(r.reason)});
    const builds=stores.map(store=>{try{return (existsSync(join(store.root,'jobs'))?readdirSync(join(store.root,'jobs')):[]).flatMap(id=>readdirSync(join(store.root,'jobs',id)).filter(f=>/^build-[1-3]-diagnostics\.json$/.test(f)).map(f=>{try{return JSON.parse(readFileSync(join(store.root,'jobs',id,f),'utf8'));}catch(error){return {unavailable:true,error:safeFailure(error)};}}));}catch(error){return [{unavailable:true,error:safeFailure(error)}];}});
    writeFileSync(join(git,'wiki-bridge-parallel-diagnostics.json'),JSON.stringify({outcomes:summary,builds,network:runtimeNetworkDiagnostics()},null,2)+'\n');
    assert.ok(existsSync(sentinel),'caller-owned prerender cache was deleted');
    assert.equal(results[0].status,'fulfilled',JSON.stringify(summary));assert.equal(results[1].status,'fulfilled',JSON.stringify(summary));assert.equal(results[0].value.site.id,results[1].value.site.id,'identical inputs should produce the same site identity in distinct stores');
    for(const [i,settled]of results.entries()){assert.equal(settled.status,'fulfilled');const result=settled.value;assert.equal(result.outcome,'site-activated');assert.equal(stores[i].current().manifest.state.events.length,1);assert.ok(readFileSync(join(stores[i].root,'sites',result.site.id,'articles/tool-use/index.html'),'utf8').includes('Cedarharbor'));}
    const bridge=stores[0],alloc=Buffer.alloc;let allocated=0,allocationCalls=0;
    Buffer.alloc=function(n,...args){allocated+=n;allocationCalls++;return alloc(n,...args)};let current;
    try{current=bridge.current();}finally{Buffer.alloc=alloc;}
    const artifactBytes=Object.values(current.manifest.files).reduce((n,file)=>n+file.bytes,0);assert.ok(allocated<artifactBytes*4,`snapshot allocated ${allocated} capacity for ${artifactBytes} artifact bytes`);
    let validations=0,mutate=null;const load=bridge.load.bind(bridge);bridge.load=ref=>{validations++;const result=load(ref);if(mutate){const action=mutate;mutate=null;action();}return result;};
    const server=wikiServer(bridge);await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/wiki-snapshots/'+current.reference.id+'/';
    const request=async file=>{validations=0;const response=await fetch(base+file);return {status:response.status,body:Buffer.from(await response.arrayBuffer()),validations};};
    try{
      const served=await request('articles/tool-use/');assert.equal(served.status,200);assert.equal(served.validations,1);assert.deepEqual(served.body,readFileSync(join(bridge.root,'sites',current.reference.id,'articles/tool-use/index.html')));
      for(const file of ['articles/tool-use/index.html','manifest.json']){const path=join(bridge.root,'sites',current.reference.id,file),bytes=readFileSync(path),changed=Buffer.from(bytes);changed[changed.length-2]^=1;mutate=()=>writeFileSync(path,changed);
        try{assert.equal((await request(file)).status,503,`${file}: changed response bytes must not escape validation`);assert.equal((await request(file)).status,503,'fresh request still detects same-length corruption');}finally{writeFileSync(path,bytes);}assert.equal((await request(file)).status,200);
      }
      const unrequested=join(bridge.root,'sites',current.reference.id,'about/index.html'),bytes=readFileSync(unrequested);writeFileSync(unrequested,'corrupt unrequested asset');try{assert.equal((await request('articles/tool-use/')).status,503);}finally{writeFileSync(unrequested,bytes);}assert.equal((await request('articles/tool-use/')).status,200);
      writeFileSync(join(git,'snapshot-read-regression.json'),JSON.stringify({artifactBytes,allocatedCapacity:allocated,allocationCalls,pinnedCurrentInventories:1,lateArticleRaceRejected:true,lateManifestRaceRejected:true,freshCorruptionDetected:true,unrequestedCorruptionDetected:true,restorationServed:true,parallelBuilds:summary},null,2)+'\n');
    }finally{await new Promise(done=>server.close(done));}
    assert.deepEqual(inventory(cache),cached);if(dist)assert.deepEqual(inventory('dist'),dist);assert.deepEqual(inventory('src/content/articles'),markdown);assert.deepEqual(await accounting(local.db),before);
  }finally{rmSync(sentinel,{force:true});await local.runtime.dispose();}
});
