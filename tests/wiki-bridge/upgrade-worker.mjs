import {runtimeNetworkDiagnostics} from '../support/network-diagnostics.mjs';
import {safeFailure} from '../../src/wiki-bridge/diagnostics.ts';
// Executes a pinned old runtime or an isolated future-schema reader; never fetches live sources.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {close} from 'pagefind';
let phase='bootstrap';const fatal=error=>{process.stderr.write('AB_UPGRADE_DIAGNOSTIC '+JSON.stringify({phase,error:safeFailure(error),network:runtimeNetworkDiagnostics()})+'\n');process.exit(1);};process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
const [mode,repo,recordPath]=process.argv.slice(2);process.chdir(repo);phase='imports';
const from=path=>import(pathToFileURL(join(repo,path)).href);
const {WikiBridge}=await from('src/wiki-bridge/store.ts');
const {wikiServer}=await from('src/wiki-bridge/preview.ts');
const {localObservations}=await from('src/wiki-bridge/local-d1.ts');
const tables=['http_source_state','http_check_jobs','http_request_reservations','http_request_budget'];
const accounting=async db=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results])));
async function served(bridge,receipts){
  const server=wikiServer(bridge);await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(origin+'/articles/tool-use/')).status,200);
    for(const receipt of receipts)for(const path of ['articles/tool-use/','search/','pagefind/pagefind.js',`history/tool-use/${receipt.articleRevision}.html`]){
      const response=await fetch(`${origin}/wiki-snapshots/${receipt.site.id}/${path}`);assert.equal(response.status,200,path);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
    }
  }finally{await new Promise(done=>server.close(done));}
}
if(['seed','seed-eight','seed-fourteen'].includes(mode)){phase='legacy-seed';const count=mode==='seed'?3:mode==='seed-eight'?8:14,extra=mode!=='seed',suffix=mode==='seed'?'legacy':mode.slice(5);
  const {prepareWikiEvidence}=await from('scripts/wiki-bridge-demo.mjs');
  const {packet,successor}=await from('tests/wiki-bridge/helpers.mjs');
  const name='wiki-bridge-test-upgrade-'+suffix,observations='wiki-observations-test-upgrade-'+suffix;assert.equal((await prepareWikiEvidence(observations)).fetches,2);
  const local=await localObservations(observations);try{
    const bridge=new WikiBridge(name),firstCommand=packet(),first=await bridge.execute(firstCommand,local.db,'fixtures/wiki-bridge/sources');
    const secondCommand=extra?firstCommand:successor(bridge,'legacy-upgrade-second'),second=extra?first:await bridge.execute(secondCommand,local.db,'fixtures/wiki-bridge/sources');
    const catalog=JSON.parse(readFileSync(join(bridge.root,'sites',second.site.id,'source-catalog.json'),'utf8'));assert.equal(catalog.articles.length,count);phase='legacy-serving';if(!extra)await served(bridge,[first,second]);
    writeFileSync(recordPath,JSON.stringify({name,observations,firstCommand,secondCommand,first,second,status:bridge.status(),current:bridge.current(),accounting:await accounting(local.db),catalog,legacyHttpStatus:extra?null:200},null,2));
  }finally{await local.runtime.dispose();await close();}
}else if(mode==='future-reader'){phase='future-reader';
  const data=JSON.parse(readFileSync(recordPath,'utf8'));const {readingArticleIds}=await from('src/lib/article-ids.ts');assert.ok(readingArticleIds.includes('future-content-entry'));
  const {validateCatalog}=await from('src/monitoring/catalog.ts');await assert.rejects(validateCatalog(data.catalog),/future_catalog_schema/);
  assert.match(readFileSync('src/content.config.ts','utf8'),/futureRevisionPolicy/);
  let fetches=0;const local=await localObservations(data.observations,false,()=>{fetches++;throw Error('upgrade source fetch forbidden');});try{
    const bridge=new WikiBridge(data.name);assert.deepEqual(bridge.current(),data.current);assert.deepEqual(bridge.status(),data.status);await served(bridge,[data.first,data.second]);
    let sql=0;const forbidden={prepare(){sql++;throw Error('replay D1 SQL forbidden');},batch(){sql++;throw Error('replay D1 SQL forbidden');}};
    assert.deepEqual(await bridge.execute(data.firstCommand,forbidden,data.sourceDirectory),data.first);assert.deepEqual(await bridge.execute(data.secondCommand,forbidden,data.sourceDirectory),data.second);
    const fresh=new WikiBridge(data.freshName);await served(fresh,[data.fresh]);assert.deepEqual(await fresh.execute(data.firstCommand,forbidden,data.sourceDirectory),data.fresh);
    const next=structuredClone(data.secondCommand);next.eventId=next.revision.eventId='future-source-change';next.expectedSite=data.second.site;next.expectedPublisher=data.second.publisher;next.revision.baseRevision=data.second.articleRevision;
    await assert.rejects(bridge.execute(next,forbidden,data.sourceDirectory),{code:'build_source_changed'});await assert.rejects(fresh.execute(data.pendingCommand,forbidden,data.sourceDirectory),{code:'build_source_changed'});
    assert.deepEqual(await accounting(local.db),data.accounting);assert.equal(fetches,0);assert.equal(sql,0);assert.deepEqual(bridge.status(),data.status);
    writeFileSync(recordPath+'.future',JSON.stringify({legacyServing:200,currentServing:200,legacyReplays:2,currentReplay:true,replayD1Sql:sql,changedSourceWrite:'build_source_changed',changedSourcePending:'build_source_changed',chargesPreserved:true,sourceFetches:fetches}));
  }finally{await local.runtime.dispose();await close();}
}else throw Error('unknown upgrade test mode');
