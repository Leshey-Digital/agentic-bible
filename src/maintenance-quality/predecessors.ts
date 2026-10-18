import {maintenanceTarget} from './target.ts';
import {hash,event,digest,historyPath,stop,type Intent} from '../maintenance-github/contracts.ts';
import type {WriterOutbox} from '../maintenance-github/outbox.ts';

// An optional canonical-source port cannot be the authority for downgrading a
// target. Start at its pinned predecessor and follow the already completed,
// hash-linked writer/restoration journal. Tool Use restoration records retain
// schema 1, so the quality requirement is inherited through their ancestry.
export async function legacyPredecessor(outbox:Pick<WriterOutbox,'get'|'intent'>,id:string,revision:string,articleId:string):Promise<Intent>{
 const target=maintenanceTarget(articleId),seen=new Set<string>();let expectedHash:string|undefined,head:Intent|undefined;
 for(let depth=0;depth<64;depth++){
  if(!event(id)||!digest(revision)||seen.has(id))stop('writer_previous_authority_required');seen.add(id);
  const row=await outbox.get(id);if(!row||row.event_id!==id||row.state!=='complete'||!row.receipt||hash(row.receipt)!==row.receipt_hash)stop('writer_previous_authority_required');
  const intent=outbox.intent(row),bytes=intent.files[historyPath(id)];if(typeof bytes!=='string'||typeof intent.files[target.articlePath]!=='string')stop('writer_previous_authority_required');let record:any,receipt:any;try{record=JSON.parse(bytes);receipt=JSON.parse(row.receipt);}catch{return stop('writer_previous_authority_required');}
  if(!head)head=intent;
  if(!record||!receipt||expectedHash&&hash(bytes)!==expectedHash||record.eventId!==id||record.articleId!==articleId||record.articleRevision!==revision||record.expectedBaseCommit!==intent.expectedBase||![1,2].includes(record.schemaVersion)||!['controlled-automatic-maintenance-revision','controlled-reviewed-maintenance-restoration'].includes(record.kind)||receipt.eventId!==id||receipt.articleRevision!==revision||receipt.historyPath!==historyPath(id)||receipt.historySha256!==hash(bytes)||receipt.markdownSha256!==hash(intent.files[target.articlePath]))stop('writer_previous_authority_required');
  if(record.schemaVersion===2)stop('writer_quality_profile_required');
  const prior=record.previous;if(prior===null)return head;
  if(!prior||!event(prior.eventId)||!digest(prior.revisionId)||!digest(prior.sha256)||prior.path!==historyPath(prior.eventId))stop('writer_previous_authority_required');
  id=prior.eventId;revision=prior.revisionId;expectedHash=prior.sha256;
 }
 return stop('writer_previous_authority_required');
}
