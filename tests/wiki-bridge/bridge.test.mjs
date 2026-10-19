import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,cpSync,writeFileSync,readFileSync,readdirSync,rmSync,symlinkSync,openSync,ftruncateSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {Response as ControlledResponse} from 'miniflare';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {BridgeError} from '../../src/wiki-bridge/limits.ts';
import {inventory,projectFiles,write} from '../../src/wiki-bridge/files.ts';
import {wikiServer} from '../../src/wiki-bridge/preview.ts';
import {prepareWikiEvidence} from '../../scripts/wiki-bridge-demo.mjs';
import {git,packet,clean,accounting,successor} from './helpers.mjs';
import {spawnProcessGroup,signalProcessGroup} from './process-group.mjs';

test('actual charged D1 evidence rejects invalid input before domain effects and recovers SIGKILL boundaries', {timeout:360000},async t=>{
  const observations='wiki-observations-test-unit';clean(observations);
  assert.equal((await prepareWikiEvidence(observations)).fetches,2);
  assert.equal((await prepareWikiEvidence(observations)).fetches,0);
  let fetches=0,local=await localObservations(observations,false,()=>{fetches++;throw new Error('unexpected source fetch');});
  const before=await accounting(local.db);const original=inventory('src/content/articles');const dist=existsSync('dist')?inventory('dist'):null;
  const name='wiki-bridge-test-rejections';clean(name);let bridge=new WikiBridge(name);
  const sourceDir=join(git,'wiki-bridge-test-source-files');rmSync(sourceDir,{recursive:true,force:true});cpSync('fixtures/wiki-bridge/sources',sourceDir,{recursive:true});
  const reject=async(value,code)=>{await assert.rejects(bridge.execute(value,local.db,sourceDir),{code});assert.equal(bridge.current(),null);assert.equal(bridge.publisher.current(),null);assert.deepEqual(bridge.status().pending,[]);assert.equal(existsSync(join(bridge.root,'jobs')),false);};
  try{
    await t.test('stale, mismatched, malformed and oversized inputs have no publisher/build/journal effects',async()=>{
      for(const [mutate,code]of [
        [p=>p.originalMarkdownHash='0'.repeat(64),'stale_original_markdown'],
        [p=>p.expectedSite={id:'0'.repeat(64),manifestHash:'1'.repeat(64)},'stale_site_parent'],
        [p=>p.expectedPublisher={id:'0'.repeat(64),manifestHash:'1'.repeat(64)},'stale_publisher_parent'],
        [p=>p.revision.baseRevision='0'.repeat(64),'stale_publisher_base'],
        [p=>p.evidence[0].bodyHash='0'.repeat(64),'source_hash_mismatch'],
        [p=>p.evidence[0].url=p.evidence[1].url,'citation_evidence_mismatch'],
        [p=>p.evidence[0].citationId='unknown','citation_evidence_mismatch'],
        [p=>p.evidence[0].receiptKey='ffffffff-ffff-4fff-8fff-ffffffffffff','uncharged_observation'],
        [p=>p.revision.article.topic=['Capabilities'],'invalid_topic'],
        [p=>p.padding='x'.repeat(50000),'bridge_input_too_large']
      ]){const p=packet();mutate(p);await reject(p,code);}
      writeFileSync(join(sourceDir,packet().evidence[0].file),'x'.repeat(32769));await reject(packet(),'source_file_too_large');cpSync('fixtures/wiki-bridge/sources',sourceDir,{recursive:true});
      await local.db.prepare("UPDATE http_request_reservations SET outcome='failed' WHERE request_key=?").bind(packet().evidence[0].receiptKey).run();
      await reject(packet(),'uncharged_observation');
      await local.db.prepare("UPDATE http_request_reservations SET outcome='succeeded' WHERE request_key=?").bind(packet().evidence[0].receiptKey).run();
      assert.deepEqual(await accounting(local.db),before);
    });
    await t.test('successful charged 304-only evidence is rejected',async()=>{
      await local.runtime.dispose();local=await localObservations(observations,true,()=>{fetches++;return new ControlledResponse(null,{status:304});});
      const p=packet();p.evidence[0].receiptKey=crypto.randomUUID();
      const response=await local.runtime.dispatchFetch('http://localhost/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.evidence[0].sourceId,key:p.evidence[0].receiptKey})});
      assert.equal(response.status,200);assert.equal((await response.json()).observation.kind,'not-modified');await reject(p,'unsupported_304_evidence');assert.equal(fetches,1);
      await local.runtime.dispose();local=await localObservations(observations,false,()=>{fetches++;throw new Error('bridge fetch');});
    });
    await t.test('pending operation rejects changed build source without silent rebase',async()=>{
      const storeName='wiki-bridge-test-source-change';clean(storeName);
      const copy=join(git,'wiki-bridge-test-project');rmSync(copy,{recursive:true,force:true});
      for(const [path,bytes]of Object.entries(projectFiles(process.cwd()).files))write(join(copy,path),bytes);
      symlinkSync(git,join(copy,'.git'),'dir');const isolated=new WikiBridge(storeName,copy);
      await assert.rejects(isolated.execute(packet(),local.db,sourceDir,{checkpoint(){throw new BridgeError('test_pause');}}),{code:'test_pause'});
      const server=wikiServer(isolated);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      try{assert.equal(await (await fetch(`http://127.0.0.1:${server.address().port}/articles/tool-use/`)).text(),'evidence-validated/article-pending');}finally{await new Promise(resolve=>server.close(resolve));}
      const page=join(copy,'src/pages/index.astro');writeFileSync(page,readFileSync(page,'utf8')+'\n<!-- changed -->\n');
      await assert.rejects(isolated.execute(packet(),local.db,sourceDir),{code:'build_source_changed'});
      assert.equal(isolated.publisher.current(),null);assert.equal(isolated.current(),null);
    });
    await t.test('storage admission, mutex contention and build attempts are bounded',async()=>{
      const capacity='wiki-bridge-test-capacity';clean(capacity);const full=new WikiBridge(capacity);
      const fd=openSync(join(full.root,'occupied.bin'),'w');ftruncateSync(fd,192*1024*1024);closeSync(fd);
      await assert.rejects(full.execute(packet(),local.db,sourceDir),{code:'bridge_storage_capacity'});assert.equal(full.publisher.current(),null);assert.equal(existsSync(join(full.root,'jobs')),false);
      const boundedName='wiki-bridge-test-attempts';clean(boundedName);const bounded=new WikiBridge(boundedName);
      await assert.rejects(bounded.execute(packet(),local.db,sourceDir,{async checkpoint(phase){
        if(phase==='after-validation')await assert.rejects(new WikiBridge(boundedName).execute(packet(),local.db,sourceDir),{code:'bridge_busy'});
        if(phase==='after-build')throw new BridgeError('test_post_build_failure');
      }}),{code:'test_post_build_failure'});
      for(let n=0;n<2;n++)await assert.rejects(bounded.execute(packet(),local.db,sourceDir,{checkpoint(phase){if(phase==='after-build')throw new BridgeError('test_post_build_failure');}}),{code:'test_post_build_failure'});
      await assert.rejects(bounded.execute(packet(),local.db,sourceDir),{code:'bridge_build_attempts_exhausted'});
      assert.equal(bounded.current(),null);assert.equal(bounded.publisher.current().manifest.state.receipts.length,1);assert.equal(bounded.status().pending[0].buildAttempts,3);
    });
    const charged=await accounting(local.db);let recovered=0;
    for(const phase of ['after-publication','build-started','after-build','after-seal','after-activate'])await t.test(`SIGKILL ${phase}: exact retry and restart`,async()=>{
      const storeName='wiki-bridge-test-kill-'+phase;clean(storeName);bridge=new WikiBridge(storeName);
      let prior=null;let p=packet();
      // Show that an existing canonical full wiki remains pinned while its successor is pending.
      if(phase==='build-started'){await bridge.execute(p,local.db,'fixtures/wiki-bridge/sources');prior=bridge.current();p=successor(bridge,'kill-replacement');}
      const file=join(git,'wiki-bridge-test-kill-input.json');writeFileSync(file,JSON.stringify(p));await local.runtime.dispose();
      const signal=await new Promise((resolve,reject)=>{const child=spawnProcessGroup(process.execPath,['tests/wiki-bridge/kill-worker.mjs',storeName,observations,file,phase],{stdio:'ignore'});const timer=setTimeout(()=>{signalProcessGroup(child,'SIGKILL');reject(new Error('kill checkpoint timed out'));},60000);child.on('error',reject);child.on('exit',(code,signal)=>{clearTimeout(timer);signalProcessGroup(child,'SIGTERM');resolve(signal??code);});});assert.equal(signal,'SIGKILL');
      local=await localObservations(observations,false,()=>{fetches++;throw new Error('bridge fetch');});bridge=new WikiBridge(storeName);
      if(phase!=='after-activate'){assert.deepEqual(bridge.current()?.reference??null,prior?.reference??null);assert.equal(bridge.status().pending[0].phase,'article-accepted/site-pending');}
      else assert.equal(bridge.status().pending.length,0);
      if(phase==='after-seal'){
        const sealed=readdirSync(join(bridge.root,'sites'))[0],server=wikiServer(bridge);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        try{assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/wiki-snapshots/${sealed}/articles/tool-use/`)).status,404);}finally{await new Promise(resolve=>server.close(resolve));}
      }
      if(phase==='build-started'){
        const conflict=structuredClone(p);conflict.revision.article.description+=' Changed event.';await assert.rejects(bridge.execute(conflict,local.db,'fixtures/wiki-bridge/sources'),{code:'bridge_event_conflict'});
      }
      const result=await bridge.execute(p,local.db,'fixtures/wiki-bridge/sources');assert.equal(result.outcome,'site-activated');
      bridge=new WikiBridge(storeName);assert.deepEqual(await bridge.execute(p,local.db,'fixtures/wiki-bridge/sources'),result);assert.equal(bridge.current().manifest.state.events.filter(e=>e.eventId===p.eventId).length,1);assert.equal(bridge.publisher.current().manifest.state.receipts.filter(e=>e.eventId===p.eventId).length,1);
      assert.deepEqual(await accounting(local.db),charged);recovered++;
    });
    assert.equal(fetches,1);assert.deepEqual(inventory('src/content/articles'),original);if(dist)assert.deepEqual(inventory('dist'),dist);
    writeFileSync(join(git,'wiki-bridge-unit-evidence.json'),JSON.stringify({chargedRequests:charged.http_request_budget[0].used,bridgeFetches:0,controlled304Fetches:1,processDeathBoundariesRecovered:recovered,originalMarkdownAndDistPreserved:true},null,2)+'\n');
  }finally{await local.runtime.dispose();}
});
