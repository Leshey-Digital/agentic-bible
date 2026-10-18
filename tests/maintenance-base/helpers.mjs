import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';
import {hostedHistoryFixture,origin} from '../maintenance-history/hosted-fixture.mjs';
import {controlledGitHub} from '../maintenance-github/provider.mjs';
import {buildCanonicalHistorySite} from '../maintenance-restore/build-site.mjs';
import {verifySignedAdmin} from '../../src/hosted/identity.ts';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';import {runMaintenance} from '../../src/wiki-bridge/maintenance.ts';
import {deterministicProvider,demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
import {collectMaintenanceSource} from '../../src/maintenance-sources/collector.ts';
import {writeMaintenanceRevision} from '../../src/maintenance-github/writer.ts';
import {restoreMaintenanceRevision} from '../../src/maintenance-restore/coordinator.ts';
import {hash} from '../../src/maintenance-github/contracts.ts';import {clean,packet,successor} from '../wiki-bridge/helpers.mjs';
export async function scenario(label){
 const remote=controlledGitHub('base-'+label),catalog={schemaVersion:1,mode:'controlled-static-preview',enabled:true,sourceCommit:remote.state.base,noindex:true,history:[]},manifest=Buffer.from(JSON.stringify(catalog)+'\n');
 const app=await hostedHistoryFixture({remote,catalog,manifest,catalogHash:hash(manifest),assets:resolve('dist')},{restoration:true});
 try{
  for(const name of ['0005_http_observations.sql','0010_maintenance_proposals.sql','0012_maintenance_source_collections.sql'])for(const sql of readFileSync('migrations/'+name,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await app.db.prepare(sql).run();
  const name='wiki-bridge-test-canonical-base-'+label;clean(name);const bridge=new WikiBridge(name),collectionName='maintenance-source-collection-test-canonical-base-'+label;let calls=0;const requests=[];
  const provider=deterministicProvider(request=>{calls++;requests.push(request);});
  const context=()=>({enabled:true,db:app.db,bridge,sourceDirectory:'',policy:demonstrationPolicy,provider,transport:remote.port});
  async function collect(command,text,clock=Date.now){const items=[];for(const e of command.evidence)items.push(await collectMaintenanceSource({sourceId:e.sourceId,citationId:e.citationId,requestKey:crypto.randomUUID()},{enabled:true,db:app.db,collectionName,clock,transport:{kind:'controlled-source-fixture',send:async()=>new Response(text,{headers:{'Content-Type':'text/plain'}})}}));command.evidence=items.map(x=>x.evidence);return items[0].sourceDirectory;}
  const first=packet();first.eventId=first.revision.eventId='base-'+label+'-first';let directory=await collect(first,'Cypresshaven supplies original controlled target text for canonical restoration and subsequent maintenance.');await runMaintenance(first,{...context(),sourceDirectory:directory});const initial=await writeMaintenanceRevision({schemaVersion:1,mode:'local-synthetic-only',expectedBaseCommit:remote.tip(),previousRevision:null,command:first},{...context(),sourceDirectory:directory});
  const second=successor(bridge,'base-'+label+'-second','Birchwater');directory=await collect(second,'Birchwater supplies a later controlled source excerpt before explicit restoration selects the earlier target.');await runMaintenance(second,{...context(),sourceDirectory:directory});const later=await writeMaintenanceRevision({schemaVersion:1,mode:'local-synthetic-only',expectedBaseCommit:initial.commit,previousRevision:initial.articleRevision,command:second},{...context(),sourceDirectory:directory});
  const site=buildCanonicalHistorySite({remote,writerReceipts:[later,initial]},later.commit);await app.restart(site);
  const request=app.input({decision:'revert-requested',targetCommit:initial.commit,note:'Controlled explicit review restores the earlier source before a new canonical-base-bound maintenance generation.'});assert.equal((await app.request(request)).status,200);
  const approvalId=crypto.randomUUID(),assertion=await app.token();const response=await app.dispatch('/api/admin/maintenance/restore-approval',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':assertion},body:JSON.stringify({approvalId,requestId:request.requestId,confirm:'approve-canonical-restoration'})});assert.equal(response.status,200);
  const admin=await verifySignedAdmin(new Request(origin+'/api/admin/maintenance/restore-approval',{method:'POST',headers:{Origin:origin,'X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':assertion}}),app.trust);assert.ok(admin);
  const restored=await restoreMaintenanceRevision({approvalId},{enabled:true,admin,db:app.db,repo:process.cwd(),canonicalRepo:remote.state.root,transport:remote.port});
  const now=Date.now()+86400001,clock=()=>now; // Retain the two real prior charges; use a fresh synthetic day, not relaxed quotas.
  const command=successor(bridge,'base-'+label+'-after-restore','Alderbrook');directory=await collect(command,'Alderbrook supplies the next controlled source excerpt after the exact canonical restoration base was selected.',clock);
  const canonicalBase={kind:'controlled-canonical-base-fixture',repo:remote.state.root,sourceCommit:restored.commit};
  const nextContext=()=>({...context(),sourceDirectory:directory,clock,canonicalBase});
  return {app,remote,bridge,command,restored,initial,later,canonicalBase,requests,get calls(){return calls},nextContext,close:()=>app.close()};
 }catch(error){await app.close();throw error;}
}
