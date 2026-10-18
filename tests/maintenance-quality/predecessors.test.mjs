import {test} from 'node:test';
import assert from 'node:assert/strict';
import {legacyPredecessor} from '../../src/maintenance-quality/predecessors.ts';
import {canonical,hash,historyPath} from '../../src/maintenance-github/contracts.ts';
import {maintenanceTarget} from '../../src/maintenance-quality/target.ts';

function journal(definitions){
 const rows=new Map(),intents=new Map();let previous=null;
 for(const [index,{quality=false,restoration=false}]of definitions.entries()){
  const id='controlled-predecessor-'+index,revision=hash(id),base='a'.repeat(40),target=maintenanceTarget('tool-use'),markdown='Controlled retained Markdown '+index,record={schemaVersion:quality?2:1,kind:restoration?'controlled-reviewed-maintenance-restoration':'controlled-automatic-maintenance-revision',eventId:id,articleId:'tool-use',articleRevision:revision,expectedBaseCommit:base,previous},bytes=canonical(record),intent={schemaVersion:1,expectedBase:base,previousEvent:previous?.eventId??null,files:{[target.articlePath]:markdown,[target.pointerPath]:'Controlled immutable pointer',[historyPath(id)]:bytes}},receipt=canonical({eventId:id,articleRevision:revision,historyPath:historyPath(id),historySha256:hash(bytes),markdownSha256:hash(markdown)});
  rows.set(id,{event_id:id,state:'complete',receipt,receipt_hash:hash(receipt)});intents.set(id,intent);previous={eventId:id,revisionId:revision,path:historyPath(id),sha256:hash(bytes)};
 }
 return {rows,intents,head:previous,port:{get:async id=>rows.get(id),intent:row=>intents.get(row.event_id)}};
}

test('legacy predecessor admission inherits quality through schema1 restorations and otherwise preserves legacy chains',async()=>{
 const legacy=journal([{}, {restoration:true}, {}]);assert.equal(await legacyPredecessor(legacy.port,legacy.head.eventId,legacy.head.revisionId,'tool-use'),legacy.intents.get(legacy.head.eventId));
 for(const definitions of [[{quality:true}],[{quality:true},{restoration:true}],[{}, {quality:true},{restoration:true},{restoration:true}]]){const f=journal(definitions);await assert.rejects(legacyPredecessor(f.port,f.head.eventId,f.head.revisionId,'tool-use'),{code:'writer_quality_profile_required'});}
});

test('predecessor journal integrity rejects foreign targets, receipt or hash-link changes, cycles and an overlong retained chain',async()=>{
 const f=journal([{},{}]);await assert.rejects(legacyPredecessor(f.port,f.head.eventId,f.head.revisionId,'model-context-protocol'),{code:'writer_previous_authority_required'});
 f.rows.get('controlled-predecessor-0').receipt_hash=hash('foreign');await assert.rejects(legacyPredecessor(f.port,f.head.eventId,f.head.revisionId,'tool-use'),{code:'writer_previous_authority_required'});
 const changed=journal([{},{}]);changed.intents.get('controlled-predecessor-0').files[historyPath('controlled-predecessor-0')]+=' ';await assert.rejects(legacyPredecessor(changed.port,changed.head.eventId,changed.head.revisionId,'tool-use'),{code:'writer_previous_authority_required'});
 const long=journal(Array.from({length:65},()=>({})));await assert.rejects(legacyPredecessor(long.port,long.head.eventId,long.head.revisionId,'tool-use'),{code:'writer_previous_authority_required'});
 const cycle=journal([{}]),intent=cycle.intents.get(cycle.head.eventId),record=JSON.parse(intent.files[historyPath(cycle.head.eventId)]);record.previous=cycle.head;intent.files[historyPath(cycle.head.eventId)]=canonical(record);const row=cycle.rows.get(cycle.head.eventId),receipt=JSON.parse(row.receipt);receipt.historySha256=hash(canonical(record));row.receipt=canonical(receipt);row.receipt_hash=hash(row.receipt);await assert.rejects(legacyPredecessor(cycle.port,cycle.head.eventId,cycle.head.revisionId,'tool-use'),{code:'writer_previous_authority_required'});
});
