import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {prepareWikiEvidence} from '../../scripts/wiki-bridge-demo.mjs';
import {git,packet,clean,accounting,successor} from './helpers.mjs';
import {spawnProcessGroup,signalProcessGroup} from './process-group.mjs';
const prose=html=>/<div class="prose"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1]??'';
test('canonical current/history retain URL-shaped prose and code-like text byte-for-byte',{timeout:60000},async()=>{
  const name='wiki-bridge-test-history-literals',observations='wiki-observations-test-history-literals';clean(name);clean(observations);await prepareWikiEvidence(observations);const local=await localObservations(observations);
  try{
    const bridge=new WikiBridge(name),p=packet();const text='Literal /local-publications/ and `/local-publications/` and href="/local-publications/" must remain unchanged in supplied prose and code-like text.';p.revision.article.blocks[1].content[0].text=text;
    const receipt=await bridge.execute(p,local.db,'fixtures/wiki-bridge/sources');const folder=join(bridge.root,'sites',receipt.site.id);
    for(const path of ['articles/tool-use/index.html',`history/tool-use/${receipt.articleRevision}.html`]){
      const html=readFileSync(join(folder,path),'utf8');assert.equal(prose(html).split('/local-publications/').length-1,3,`${path}: literal URL prefixes changed`);
      assert.ok(html.includes(`href="/wiki-snapshots/${receipt.site.id}/`));
    }
    const publisherHistory=readFileSync(join(bridge.publisher.root,'releases',receipt.publisher.id,'history/tool-use',receipt.articleRevision+'.html'),'utf8');assert.equal(prose(publisherHistory).split('/local-publications/').length-1,3);
    const second=await bridge.execute(successor(bridge,'history-literal-successor'),local.db,'fixtures/wiki-bridge/sources');
    const restored=await bridge.execute({schemaVersion:1,kind:'rollback',mode:'local-synthetic-only',eventId:'history-literal-rollback',originalMarkdownHash:p.originalMarkdownHash,expectedSite:second.site,expectedPublisher:second.publisher,targetSite:receipt.site},local.db,'fixtures/wiki-bridge/sources');
    for(const site of [second.site,restored.site]){const html=readFileSync(join(bridge.root,'sites',site.id,`history/tool-use/${receipt.articleRevision}.html`),'utf8');assert.equal(prose(html).split('/local-publications/').length-1,3);}
  }finally{await local.runtime.dispose();}
});
test('SIGKILL captures stay owned/accounted; recovery preserves another capture and respects capacity',{timeout:120000},async()=>{
  const name='wiki-bridge-test-owned-captures',observations='wiki-observations-test-owned-captures';clean(name);clean(observations);await prepareWikiEvidence(observations);
  const globalBefore=readdirSync(tmpdir()).filter(n=>n.startsWith('agentic-wiki-bridge-')).sort(),file=join(git,'wiki-bridge-test-owned-input.json');writeFileSync(file,JSON.stringify(packet()));
  const signal=await new Promise((done,failed)=>{const child=spawnProcessGroup(process.execPath,['tests/wiki-bridge/kill-worker.mjs',name,observations,file,'build-started'],{stdio:'ignore'});const timer=setTimeout(()=>{signalProcessGroup(child,'SIGKILL');failed(Error('kill checkpoint timeout'));},60000);child.on('error',failed);child.on('exit',(code,signal)=>{clearTimeout(timer);signalProcessGroup(child,'SIGTERM');done(signal??code);});});assert.equal(signal,'SIGKILL');
  assert.deepEqual(readdirSync(tmpdir()).filter(n=>n.startsWith('agentic-wiki-bridge-')).sort(),globalBefore,'new global captured project leaked');
  const local=await localObservations(observations);try{
    let bridge=new WikiBridge(name);const before=await accounting(local.db),status=bridge.status();assert.equal(status.storage.captureSlots,1);assert.equal(status.storage.reservedCaptureBytes,64*1024*1024);assert.equal(status.pending[0].phase,'article-accepted/site-pending');
    const result=await bridge.execute(packet(),local.db,'fixtures/wiki-bridge/sources');assert.equal(result.outcome,'site-activated');bridge=new WikiBridge(name);assert.equal(bridge.status().storage.captureSlots,1);assert.deepEqual(await bridge.execute(packet(),local.db,'fixtures/wiki-bridge/sources'),result);assert.deepEqual(await accounting(local.db),before);
    const guard=join(bridge.root,'captures',`capture-${'0'.repeat(64)}-1-Guard0`);mkdirSync(guard);writeFileSync(join(guard,'active-operation.txt'),'Keep another owned capture.');const publisher=bridge.publisher.current().reference;
    await assert.rejects(bridge.execute(successor(bridge,'capture-capacity-successor'),local.db,'fixtures/wiki-bridge/sources'),{code:'bridge_storage_capacity'});assert.equal(readFileSync(join(guard,'active-operation.txt'),'utf8'),'Keep another owned capture.');assert.deepEqual(bridge.publisher.current().reference,publisher);assert.equal(bridge.status().storage.captureSlots,2);assert.ok(existsSync(join(bridge.root,'current.json')));assert.deepEqual(await accounting(local.db),before);
  }finally{await local.runtime.dispose();}
});
