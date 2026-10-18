import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,limits,reject,type ProposalReceipt} from './contracts.ts';
export type Row={approval_id:string;fingerprint:string;state:'pending'|'proposed';request_count:number;lease_token:string|null;lease_until:number;receipt_json:string|null};
export async function claim(db:SqlDatabase,id:string,fingerprint:string,now:number){
  const token=crypto.randomUUID();await db.batch([
    db.prepare("INSERT INTO github_content_proposals(approval_id,fingerprint,state,created_at) SELECT ?,?,'pending',? WHERE (SELECT COUNT(*) FROM github_content_proposals)<? ON CONFLICT DO NOTHING").bind(id,fingerprint,now,limits.rows),
    db.prepare("UPDATE github_content_proposals SET lease_token=?,lease_until=? WHERE approval_id=? AND fingerprint=? AND state='pending' AND lease_until<=?").bind(token,now+limits.leaseMs,id,fingerprint,now),
  ]);
  const row=await db.prepare('SELECT * FROM github_content_proposals WHERE approval_id=?').bind(id).first<Row>();if(!row)reject('github_outbox_capacity');if(row.fingerprint!==fingerprint)reject('github_approval_conflict');if(row.state==='proposed')return {token,receipt:JSON.parse(row.receipt_json!) as ProposalReceipt};if(row.lease_token!==token)reject('github_proposal_busy');return {token,receipt:null};
}
export async function reserve(db:SqlDatabase,id:string,token:string,now:number){const result=await db.prepare("UPDATE github_content_proposals SET request_count=request_count+1 WHERE approval_id=? AND lease_token=? AND lease_until>? AND state='pending' AND request_count<?").bind(id,token,now,limits.lifetimeRequests).run();if(result.meta.changes!==1)reject('github_request_budget_or_lease');}
export async function complete(db:SqlDatabase,id:string,token:string,receipt:ProposalReceipt,now:number){const result=await db.prepare("UPDATE github_content_proposals SET state='proposed',receipt_json=?,lease_until=0,lease_token=NULL WHERE approval_id=? AND lease_token=? AND lease_until>? AND state='pending'").bind(canonical(receipt),id,token,now).run();if(result.meta.changes!==1)reject('github_completion_unconfirmed');}
export async function release(db:SqlDatabase,id:string,token:string){await db.prepare("UPDATE github_content_proposals SET lease_token=NULL,lease_until=0 WHERE approval_id=? AND lease_token=?").bind(id,token).run();}
