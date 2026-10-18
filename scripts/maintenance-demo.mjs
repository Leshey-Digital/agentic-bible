// Explicit deterministic local demonstration only. No real provider adapter/configuration exists.
import {readFileSync} from 'node:fs';
import {close} from 'pagefind';
import {prepareWikiEvidence} from './wiki-bridge-demo.mjs';
import {localObservations} from '../src/wiki-bridge/local-d1.ts';
import {WikiBridge} from '../src/wiki-bridge/store.ts';
import {wikiServer} from '../src/wiki-bridge/preview.ts';
import {MaintenanceBudget} from '../src/wiki-bridge/maintenance-budget.ts';
import {runMaintenance} from '../src/wiki-bridge/maintenance.ts';
import {MaintenanceError,deterministicProvider,demonstrationPolicy} from '../src/wiki-bridge/maintenance-provider.ts';
const action=process.argv[2]??'status',observations='wiki-observations-maintenance-demo',name='wiki-bridge-maintenance-demo';let local;
try{
 if(action==='preview'){const server=wikiServer(new WikiBridge(name));server.listen(8798,'127.0.0.1',()=>console.log('Deterministic fake-provider wiki: http://127.0.0.1:8798/'));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));}
 else if(action==='demo'){
  const collector=await prepareWikiEvidence(observations);local=await localObservations(observations);
  if(!await local.db.prepare("SELECT name FROM sqlite_master WHERE name='maintenance_proposals'").first())for(const sql of readFileSync('migrations/0010_maintenance_proposals.sql','utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await local.db.prepare(sql).run();
  const command=JSON.parse(readFileSync('fixtures/wiki-bridge/packet.json','utf8'));command.eventId=command.revision.eventId='maintenance-extractive-demo';let calls=0;
  const result=await runMaintenance(command,{enabled:true,provider:deterministicProvider(()=>calls++),policy:demonstrationPolicy,db:local.db,bridge:new WikiBridge(name),sourceDirectory:'fixtures/wiki-bridge/sources'});
  const row=await new MaintenanceBudget(local.db).job(command.eventId);console.log(JSON.stringify({mode:'local-synthetic-only',deterministicFakeProvider:true,providerCalls:calls,controlledSourceFetches:collector.fetches,budgetUnit:demonstrationPolicy.unit,reservedCost:row.reserved_cost,actualSimulatedCost:row.actual_cost,realSpend:0,...result}));
 }else if(action==='status'){console.log(JSON.stringify({mode:'local-synthetic-only',providerConfigured:false,liveWritesEnabled:false,bridge:new WikiBridge(name).status()}));}
 else throw new MaintenanceError('maintenance_unsupported_command');
}catch(error){console.error(error instanceof MaintenanceError?error.code:'maintenance_outcome_unconfirmed');process.exitCode=1;}
finally{await local?.runtime.dispose();await close();}
