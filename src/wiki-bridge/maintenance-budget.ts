import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
import {stop,policyInput,type Policy} from './maintenance-provider.ts';
export type ProposalRow={event_id:string;fingerprint:string;owner:string;state:'calling'|'uncertain'|'failed'|'ready'|'complete';created_at:number;day:number;month:string;input_tokens:number;output_tokens:number;reserved_cost:number;actual_cost:number|null;response:string|null;packet:string|null;packet_hash:string|null;receipt:string|null;error:string|null};
export class MaintenanceBudget {
 readonly db:SqlDatabase;
 constructor(db:SqlDatabase){this.db=db;}
 async job(event:string){try{return await this.db.prepare('SELECT * FROM maintenance_proposals WHERE event_id=?').bind(event).first<ProposalRow>();}catch{return stop('maintenance_accounting_unavailable');}}
 async reserve(event:string,fingerprint:string,policy:Readonly<Policy>,inputTokens:number,now:number){
  policy=policyInput(policy);if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('maintenance_clock');if(!Number.isSafeInteger(inputTokens)||inputTokens<1||inputTokens>policy.maxInputTokens)stop('maintenance_input_tokens');
  const month=new Date(now).toISOString().slice(0,7);if(!/^\d{4}-\d{2}$/.test(month))stop('maintenance_clock');
  const cost=inputTokens*policy.inputRate+policy.maxOutputTokens*policy.outputRate;if(!Number.isSafeInteger(cost)||cost>policy.runCost)stop('maintenance_run_budget');
  const owner=crypto.randomUUID(),day=Math.floor(now/86400000);
  let inserted;try{inserted=await this.db.prepare(`INSERT INTO maintenance_proposals(event_id,fingerprint,owner,state,created_at,day,month,input_tokens,output_tokens,reserved_cost)
   SELECT ?,?,?,'calling',?,?,?,?,?,? WHERE
   (SELECT COUNT(*) FROM maintenance_proposals)<16
   AND NOT EXISTS(SELECT 1 FROM maintenance_proposals WHERE state IN ('calling','uncertain') OR created_at>?)
   AND (SELECT COUNT(*) FROM maintenance_proposals WHERE day=?)<?
   AND (SELECT COUNT(*) FROM maintenance_proposals WHERE month=?)<?
   AND (SELECT COALESCE(SUM(reserved_cost),0) FROM maintenance_proposals WHERE day=?)+?<=?
   AND (SELECT COALESCE(SUM(reserved_cost),0) FROM maintenance_proposals WHERE month=?)+?<=?
   ON CONFLICT(event_id) DO NOTHING`).bind(event,fingerprint,owner,now,day,month,inputTokens,policy.maxOutputTokens,cost,now,day,policy.dayRequests,month,policy.monthRequests,day,cost,policy.dayCost,month,cost,policy.monthCost).run();}catch{return stop('maintenance_accounting_unavailable');}
  const row=await this.job(event);if(row&&row.fingerprint!==fingerprint)stop('maintenance_event_conflict');
  if(inserted.meta.changes!==1||row?.owner!==owner)stop(row?'maintenance_generation_already_reserved':'maintenance_budget_or_concurrency');return row;
 }
 async rejected(row:ProposalRow,uncertain:boolean){try{const result=await this.db.prepare(`UPDATE maintenance_proposals SET state=?,error=? WHERE event_id=? AND fingerprint=? AND owner=? AND state='calling'`).bind(uncertain?'uncertain':'failed',uncertain?'maintenance_provider_unconfirmed':'maintenance_provider_rejected',row.event_id,row.fingerprint,row.owner).run();if(result.meta.changes!==1)stop('maintenance_accounting_unconfirmed');}catch{return stop('maintenance_accounting_unconfirmed');}}
 async ready(row:ProposalRow,response:unknown,packet:unknown,actualCost:number){
  const encoded=canonical(packet),reply=canonical(response);if(Buffer.byteLength(encoded)>49152||Buffer.byteLength(reply)>4096||actualCost>row.reserved_cost)stop('maintenance_output_limit');
  try{const result=await this.db.prepare(`UPDATE maintenance_proposals SET state='ready',response=?,packet=?,packet_hash=?,actual_cost=? WHERE event_id=? AND fingerprint=? AND owner=? AND state='calling'`).bind(reply,encoded,hash(encoded),actualCost,row.event_id,row.fingerprint,row.owner).run();if(result.meta.changes!==1)stop('maintenance_accounting_unconfirmed');}catch{return stop('maintenance_accounting_unconfirmed');}
 }
 async complete(row:ProposalRow,receipt:unknown){const encoded=canonical(receipt);if(Buffer.byteLength(encoded)>4096)stop('maintenance_receipt_limit');
  try{await this.db.prepare(`UPDATE maintenance_proposals SET state='complete',receipt=? WHERE event_id=? AND fingerprint=? AND owner=? AND packet_hash=? AND state='ready'`).bind(encoded,row.event_id,row.fingerprint,row.owner,row.packet_hash).run();}catch{return stop('maintenance_completion_unconfirmed');}
  const current=await this.job(row.event_id);if(current?.state!=='complete'||current.fingerprint!==row.fingerprint||current.receipt!==encoded)stop('maintenance_completion_unconfirmed');
 }
}
