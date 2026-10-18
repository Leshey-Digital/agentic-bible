import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,stop,writerLimits,type WriterReceipt,type Intent,intentInput,hash} from './contracts.ts';
export type WriterRow={event_id:string;fingerprint:string;state:'preparing'|'intent'|'dispatched'|'complete';owner:string|null;lease_until:number;created_at:number;request_count:number;intent:string|null;intent_hash:string|null;receipt:string|null;receipt_hash:string|null};
export class WriterOutbox {
 readonly db:SqlDatabase;constructor(db:SqlDatabase){this.db=db;}
 async get(id:string){try{return await this.db.prepare('SELECT * FROM canonical_maintenance_writes WHERE event_id=?').bind(id).first<WriterRow>();}catch{return stop('writer_accounting_unavailable');}}
 async claim(id:string,fingerprint:string,now:number){
  const owner=crypto.randomUUID();try{await this.db.batch([
   this.db.prepare(`INSERT INTO canonical_maintenance_writes(event_id,fingerprint,state,created_at) SELECT ?,?,'preparing',? WHERE (SELECT COUNT(*) FROM canonical_maintenance_writes)<16 AND NOT EXISTS(SELECT 1 FROM canonical_maintenance_writes WHERE created_at>?) ON CONFLICT DO NOTHING`).bind(id,fingerprint,now,now),
   this.db.prepare(`UPDATE canonical_maintenance_writes SET owner=?,lease_until=? WHERE event_id=? AND fingerprint=? AND state<>'complete' AND lease_until<=? AND created_at<=? AND NOT EXISTS(SELECT 1 FROM canonical_maintenance_writes other WHERE other.event_id<>? AND other.lease_until>?)`).bind(owner,now+writerLimits.leaseMs,id,fingerprint,now,now,id,now),
  ]);}catch{return stop('writer_accounting_unavailable');}
  const row=await this.get(id);if(!row)stop('writer_capacity_or_clock');if(row.created_at>now)stop('writer_clock');if(row.fingerprint!==fingerprint)stop('writer_event_conflict');if(row.state!=='complete'&&row.owner!==owner)stop('writer_busy');return {row,owner};
 }
 async reserve(id:string,owner:string,now:number){const r=await this.db.prepare(`UPDATE canonical_maintenance_writes SET request_count=request_count+1 WHERE event_id=? AND owner=? AND lease_until>? AND state<>'complete' AND request_count<40`).bind(id,owner,now).run();if(r.meta.changes!==1)stop('writer_request_budget_or_lease');}
 intent(row:WriterRow){if(!row.intent||!row.intent_hash)stop('writer_intent_corrupt');let value;try{value=JSON.parse(row.intent);}catch{return stop('writer_intent_corrupt');}if(hash(canonical(value))!==row.intent_hash)stop('writer_intent_corrupt');return intentInput(value,row.event_id);}
 async prepare(id:string,owner:string,intent:Intent,now:number){const encoded=canonical(intent);if(Buffer.byteLength(encoded)>writerLimits.intentBytes)stop('writer_intent_limit');const r=await this.db.prepare(`UPDATE canonical_maintenance_writes SET state='intent',intent=?,intent_hash=? WHERE event_id=? AND owner=? AND lease_until>? AND state='preparing'`).bind(encoded,hash(encoded),id,owner,now).run();if(r.meta.changes!==1)stop('writer_prepare_unconfirmed');}
 async dispatch(id:string,owner:string,now:number){const r=await this.db.prepare(`UPDATE canonical_maintenance_writes SET state='dispatched' WHERE event_id=? AND owner=? AND lease_until>? AND state='intent'`).bind(id,owner,now).run();if(r.meta.changes!==1)stop('writer_dispatch_unconfirmed');}
 async complete(id:string,owner:string,receipt:WriterReceipt,now:number){const encoded=canonical(receipt);if(Buffer.byteLength(encoded)>4096)stop('writer_receipt_limit');const r=await this.db.prepare(`UPDATE canonical_maintenance_writes SET state='complete',receipt=?,receipt_hash=?,owner=NULL,lease_until=0 WHERE event_id=? AND owner=? AND lease_until>? AND state='dispatched'`).bind(encoded,hash(encoded),id,owner,now).run();if(r.meta.changes!==1)stop('writer_completion_unconfirmed');}
 async release(id:string,owner:string){await this.db.prepare(`UPDATE canonical_maintenance_writes SET owner=NULL,lease_until=0 WHERE event_id=? AND owner=? AND state<>'complete'`).bind(id,owner).run();}
}
