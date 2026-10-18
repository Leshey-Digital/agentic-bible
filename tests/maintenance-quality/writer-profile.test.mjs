import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {close} from 'pagefind';
import {generalizedFixture} from './generalized-helpers.mjs';
import {collectMaintenanceSource} from '../../src/maintenance-sources/collector.ts';
import {runMaintenance} from '../../src/wiki-bridge/maintenance.ts';
import {writeMaintenanceRevision} from '../../src/maintenance-github/writer.ts';
import {canonical,hash,historyPath} from '../../src/maintenance-github/contracts.ts';
import {maintenanceTarget} from '../../src/maintenance-quality/target.ts';
import {readCanonicalMaintenance} from '../../src/maintenance-history/canonical.ts';
import {git} from '../wiki-bridge/helpers.mjs';
after(async()=>close());

test('fixed writer rejects omitted quality/base ports before fresh or retained-intent dispatch and keeps original charges',async()=>{
 const f=await generalizedFixture('writer-profile');try{
  mkdirSync(join(git,'production-quality-evidence'),{recursive:true});
  const first=await f.run('tool-use','quality'),selected=f.selection('tool-use','legacy'),command=selected.command;command.schemaVersion=1;
  const context=f.context();delete context.quality;delete context.canonicalBase;const collected=[];
  for(const e of command.evidence)collected.push(await collectMaintenanceSource({sourceId:e.sourceId,citationId:e.citationId,requestKey:e.receiptKey},{enabled:true,db:f.db,collectionName:context.collectionName,transport:context.source}));
  command.evidence=collected.map(e=>e.evidence);context.sourceDirectory=collected[0].sourceDirectory;await runMaintenance(command,context);
  const before=f.remote.state.mutations,base=f.remote.tip(),input={schemaVersion:1,mode:'local-synthetic-only',expectedBaseCommit:base,previousRevision:first.canonical.articleRevision,command};
  await assert.rejects(writeMaintenanceRevision(input,context),{code:'writer_quality_profile_required'});assert.equal(f.remote.state.mutations,before);assert.equal(f.remote.tip(),base);
  // A controlled retained-intent recovery fixture never calls an older writer
  // and never submits this incompatible candidate to the canonical Git port.
  const target=maintenanceTarget('tool-use'),held={schemaVersion:1,expectedBase:base,previousEvent:first.canonical.eventId,files:{[target.articlePath]:f.remote.read(target.articlePath).toString(),[target.pointerPath]:f.remote.read(target.pointerPath).toString(),[historyPath(command.eventId)]:canonical({controlledHeldIntent:true})}},encoded=canonical(held);
  await f.db.prepare("UPDATE canonical_maintenance_writes SET state='intent',intent=?,intent_hash=? WHERE event_id=? AND state='preparing'").bind(encoded,hash(encoded),command.eventId).run();await f.app.restart();const calls=f.remote.state.calls.length;
  await assert.rejects(writeMaintenanceRevision(input,context),{code:'writer_quality_profile_required'});assert.equal(f.remote.state.calls.length,calls);assert.equal(f.remote.state.mutations,before);assert.equal(f.remote.tip(),base);
  const view=readCanonicalMaintenance({mode:'controlled-static-preview',repo:f.remote.state.root,sourceCommit:base});assert.equal(view.history.length,1);assert.equal(view.history[0].qualityRequired,true);
  const proposals=(await f.db.prepare('SELECT state,actual_cost FROM maintenance_proposals').all()).results;assert.equal(proposals.length,2);assert.ok(proposals.every(row=>row.state==='complete'&&row.actual_cost>0));assert.equal((await f.db.prepare('SELECT state FROM canonical_maintenance_writes WHERE event_id=?').bind(command.eventId).first()).state,'intent');
  writeFileSync(join(git,'production-quality-evidence/writer-profile-fixed-native.json'),JSON.stringify({fixedSourceOnly:true,actualSharedWorkerdD1:true,actualOwnedCanonicalGit:true,freshRejected:true,retainedIntentRestartRejected:true,additionalCanonicalMutations:f.remote.state.mutations-before,resumedGitRequests:f.remote.state.calls.length-calls,readerRemainsValid:true,chargedProposals:proposals.length,originalQualityRecordPreserved:true,livePublished:false},null,2)+'\n');
 }finally{await f.close();}
});
