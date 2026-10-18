// Explicit local demonstration: controlled original response bytes, never real HTTP/model/GitHub.
import {readFileSync} from 'node:fs';import {join} from 'node:path';import {close} from 'pagefind';
import {controlledWikiPacket} from './controlled-wiki-packet.mjs';
import {localObservations} from '../src/wiki-bridge/local-d1.ts';import {WikiBridge} from '../src/wiki-bridge/store.ts';import {wikiServer} from '../src/wiki-bridge/preview.ts';
import {collectMaintenanceSource,CollectionError} from '../src/maintenance-sources/collector.ts';import {runMaintenance} from '../src/wiki-bridge/maintenance.ts';
import {deterministicProvider,demonstrationPolicy,MaintenanceError} from '../src/wiki-bridge/maintenance-provider.ts';import {hash} from '../src/publishing/contracts.ts';
const action=process.argv[2]??'status',observations='wiki-observations-maintenance-collection-demo',collectionName='maintenance-source-collection-demo',bridgeName='wiki-bridge-maintenance-collection-demo';let local;
try{
 if(action==='preview'){const server=wikiServer(new WikiBridge(bridgeName));server.listen(8799,'127.0.0.1',()=>console.log('Collected synthetic-source wiki: http://127.0.0.1:8799/'));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));}
 else if(action==='status')console.log(JSON.stringify({mode:'local-synthetic-only',realSourceTransportConfigured:false,realProviderConfigured:false,liveWritesEnabled:false,bridge:new WikiBridge(bridgeName).status()}));
 else if(action==='demo'){
  const command=controlledWikiPacket(),bodies=new Map(command.evidence.map(entry=>{const bytes=readFileSync(join('fixtures/wiki-bridge/sources',entry.file));if(hash(bytes)!==entry.bodyHash)throw Error('controlled_source_fixture_changed');return [entry.url,bytes];}));let sourceRequests=0,providerCalls=0;
  local=await localObservations(observations,true);
  for(const [table,migration]of [['http_check_jobs','0005_http_observations.sql'],['maintenance_proposals','0010_maintenance_proposals.sql'],['maintenance_source_collections','0012_maintenance_source_collections.sql']])if(!await local.db.prepare('SELECT name FROM sqlite_master WHERE name=?').bind(table).first())for(const sql of readFileSync('migrations/'+migration,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await local.db.prepare(sql).run();
  const transport={kind:'controlled-source-fixture',async send(url){const body=bodies.get(url);if(!body)throw Error('controlled_target_rejected');sourceRequests++;return new Response(body,{headers:{'Content-Type':'text/plain',ETag:'"'+hash(body).slice(0,16)+'"'}});}},collected=[];
  for(const source of command.evidence)collected.push(await collectMaintenanceSource({sourceId:source.sourceId,citationId:source.citationId,requestKey:source.receiptKey},{enabled:true,transport,db:local.db,collectionName}));
  command.eventId=command.revision.eventId='maintenance-collected-source-demo';command.evidence=collected.map(row=>row.evidence);
  const result=await runMaintenance(command,{enabled:true,db:local.db,bridge:new WikiBridge(bridgeName),sourceDirectory:collected[0].sourceDirectory,provider:deterministicProvider(()=>providerCalls++),policy:demonstrationPolicy});
  console.log(JSON.stringify({mode:'local-synthetic-only',controlledSourceRequests:sourceRequests,provider:'deterministic-extractive-fake',providerCalls,bodyDirectory:collected[0].sourceDirectory,capturedBodies:collected.map(row=>({sha256:row.evidence.bodyHash,bytes:row.bytes})),realSpend:0,...result}));
 }else throw new CollectionError('collection_unsupported_command');
}catch(error){console.error(error instanceof CollectionError||error instanceof MaintenanceError?error.code:'collection_outcome_unconfirmed');process.exitCode=1;}
finally{await local?.runtime.dispose();await close();}
