import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
export class PipelineError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
export function stop(code:string):never{throw new PipelineError(code);}
export const limits=Object.freeze({rows:16,attempts:16,leaseMs:180000,buildAttempts:3,repoBytes:32*1024*1024,stageBytes:64*1024*1024,storeBytes:192*1024*1024,buildMs:45000,portMs:5000});
export type Phase='admitted'|'collected'|'generated'|'canonical'|'review-ready'|'review-dispatched'|'complete'|'superseded';
export type Row={event_id:string;fingerprint:string;input_json:string;plan_json:string;plan_hash:string;phase:Phase;journal:string;journal_hash:string;owner:string|null;lease_until:number;attempts:number;build_attempts:number;created_at:number;updated_at:number;receipt:string|null;receipt_hash:string|null};
export class PipelineLedger {
 readonly db:SqlDatabase;constructor(db:SqlDatabase){this.db=db;}
 async get(id:string){try{return await this.db.prepare('SELECT * FROM maintenance_pipeline_jobs WHERE event_id=?').bind(id).first<Row>();}catch{return stop('pipeline_accounting_unavailable');}}
 validate(row:Row,fingerprint:string,input:string){if(row.fingerprint!==fingerprint||row.input_json!==input)stop('pipeline_event_conflict');if(!['admitted','collected','generated','canonical','review-ready','review-dispatched','complete','superseded'].includes(row.phase)||row.plan_hash!==hash(row.plan_json)||row.journal_hash!==hash(row.journal)||!Number.isSafeInteger(row.created_at)||row.created_at<0||!Number.isSafeInteger(row.updated_at)||row.updated_at<row.created_at)stop('pipeline_journal_corrupt');try{return {plan:JSON.parse(row.plan_json),journal:JSON.parse(row.journal)};}catch{return stop('pipeline_journal_corrupt');}}
 async claim(id:string,fingerprint:string,input:string,plan:unknown,now:number){
  const owner=crypto.randomUUID(),raw=canonical(plan),empty=canonical({});
  try{await this.db.batch([
   this.db.prepare(`INSERT INTO maintenance_pipeline_jobs(event_id,fingerprint,input_json,plan_json,plan_hash,phase,journal,journal_hash,created_at,updated_at) SELECT ?,?,?,?,?,'admitted',?,?,?,? WHERE (SELECT COUNT(*) FROM maintenance_pipeline_jobs)<16 AND NOT EXISTS(SELECT 1 FROM maintenance_pipeline_jobs WHERE phase NOT IN ('complete','superseded') OR created_at>?) ON CONFLICT DO NOTHING`).bind(id,fingerprint,input,raw,hash(raw),empty,hash(empty),now,now,now),
   this.db.prepare(`UPDATE maintenance_pipeline_jobs SET owner=?,lease_until=?,attempts=attempts+1 WHERE event_id=? AND fingerprint=? AND phase NOT IN ('complete','superseded') AND lease_until<=? AND created_at<=? AND updated_at<=? AND attempts<16 AND NOT EXISTS(SELECT 1 FROM maintenance_pipeline_jobs other WHERE other.event_id<>? AND other.phase NOT IN ('complete','superseded'))`).bind(owner,now+limits.leaseMs,id,fingerprint,now,now,now,id),
  ]);}catch{return stop('pipeline_accounting_unavailable');}
  const row=await this.get(id);if(!row)stop('pipeline_capacity_or_pending_operation');this.validate(row,fingerprint,input);if(row.created_at>now||row.updated_at>now)stop('pipeline_clock');if(!['complete','superseded'].includes(row.phase)&&row.owner!==owner)stop('pipeline_busy_or_attempt_limit');return {row,owner};
 }
 async advance(row:Row,owner:string,phase:Phase,journal:unknown,now:number,receipt?:unknown){
  if(now<row.updated_at)stop('pipeline_clock');const raw=canonical(journal),result=receipt===undefined?null:canonical(receipt);if(Buffer.byteLength(raw)>65536||result&&Buffer.byteLength(result)>8192)stop('pipeline_journal_limit');
  try{const r=await this.db.prepare(`UPDATE maintenance_pipeline_jobs SET phase=?,journal=?,journal_hash=?,updated_at=?,lease_until=?,receipt=?,receipt_hash=? WHERE event_id=? AND fingerprint=? AND owner=? AND lease_until>? AND phase=? AND journal_hash=?`).bind(phase,raw,hash(raw),now,now+limits.leaseMs,result,result?hash(result):null,row.event_id,row.fingerprint,owner,now,row.phase,row.journal_hash).run();if(r.meta.changes!==1)stop('pipeline_transition_unconfirmed');}catch(error){const observed=await this.get(row.event_id);if(observed?.phase===phase&&observed.journal===raw&&observed.receipt===result&&observed.owner===owner)return observed;throw error;}
  return (await this.get(row.event_id))!;
 }
 async build(row:Row,owner:string,now:number){const r=await this.db.prepare(`UPDATE maintenance_pipeline_jobs SET build_attempts=build_attempts+1 WHERE event_id=? AND owner=? AND phase='canonical' AND lease_until>? AND build_attempts<3`).bind(row.event_id,owner,now).run();if(r.meta.changes!==1)stop('pipeline_review_build_limit');return (await this.get(row.event_id))!;}
 async release(id:string,owner:string){await this.db.prepare('UPDATE maintenance_pipeline_jobs SET owner=NULL,lease_until=0 WHERE event_id=? AND owner=?').bind(id,owner).run();}
}
