import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
import {stop,policyInput,type Policy} from './maintenance-provider.ts';
import {currencyInput,currencyCost,currencyPin,currencyTime,type CurrencyControl,type Usage} from './maintenance-currency.ts';
export type ProposalRow={event_id:string;fingerprint:string;owner:string;state:'calling'|'uncertain'|'failed'|'ready'|'complete';created_at:number;day:number;month:string;input_tokens:number;output_tokens:number;reserved_cost:number;actual_cost:number|null;response:string|null;packet:string|null;packet_hash:string|null;receipt:string|null;error:string|null;currency_policy?:string|null;currency_policy_hash?:string|null;currency_reserved?:number|null;currency_actual?:number|null;currency_state?:'reserved'|'settled'|'uncertain'|null;currency_usage?:string|null;currency_settled_at?:number|null};
export class MaintenanceBudget {
 readonly db:SqlDatabase;readonly currency:ReturnType<typeof currencyInput>;
 constructor(db:SqlDatabase,currency?:CurrencyControl){this.db=db;this.currency=currencyInput(currency);}
 async job(event:string){try{return await this.db.prepare('SELECT * FROM maintenance_proposals WHERE event_id=?').bind(event).first<ProposalRow>();}catch{return stop('maintenance_accounting_unavailable');}}
 verifyCurrency(row:ProposalRow,usage?:Usage,settled=false){
  const p=this.currency;if(!p){if([row.currency_policy,row.currency_policy_hash,row.currency_reserved,row.currency_actual,row.currency_state,row.currency_usage,row.currency_settled_at].some(v=>v!=null))stop('maintenance_currency_required');return;}
  currencyTime(p,row.created_at);const pin=currencyPin(p);if(!['reserved','settled','uncertain'].includes(row.currency_state??'')||row.currency_policy!==pin.json||row.currency_policy_hash!==pin.hash||row.currency_reserved!==currencyCost(p,{inputTokens:row.input_tokens,outputTokens:row.output_tokens}))stop('maintenance_currency_receipt');
  if(settled){if(!usage||row.currency_state!=='settled'||row.currency_usage!==canonical(usage)||row.currency_actual!==currencyCost(p,usage)||row.currency_actual!>row.currency_reserved!||!Number.isSafeInteger(row.currency_settled_at)||row.currency_settled_at!<row.created_at||row.currency_settled_at!<p.price.validFrom||row.currency_settled_at!>=p.price.validUntil||usage.inputTokens!==row.input_tokens||usage.outputTokens>row.output_tokens||Math.floor(row.currency_settled_at!/86400000)!==row.day)stop('maintenance_currency_receipt');}
 }
 // Read durable authority first; call the returned synchronous guard after the last await and base check.
 async dispatchEligibility(row:ProposalRow){
  const p=this.currency;if(!p)return (_now:number)=>{};
  let current;try{current=await this.db.prepare(`SELECT proposal.*, policy.policy_json AS active_policy_json, policy.policy_hash AS active_policy_hash, policy.last_seen AS high_water FROM maintenance_proposals proposal JOIN maintenance_currency_policy policy ON policy.id=1 WHERE proposal.event_id=?`).bind(row.event_id).first<ProposalRow&{active_policy_json:string;active_policy_hash:string;high_water:number}>();}catch{return stop('maintenance_accounting_unavailable');}
  const pin=currencyPin(p);
  if(!current||current.state!=='calling'||current.currency_state!=='reserved'||current.active_policy_json!==pin.json||current.active_policy_hash!==pin.hash||!Number.isSafeInteger(current.high_water)||current.high_water<current.created_at)stop('maintenance_currency_dispatch_authority');
  for(const key of ['event_id','fingerprint','owner','created_at','day','month','input_tokens','output_tokens','reserved_cost','currency_policy','currency_policy_hash','currency_reserved'] as const)if(current[key]!==row[key])stop('maintenance_currency_dispatch_authority');
  this.verifyCurrency(current);const created=current.created_at,day=current.day,month=current.month,highWater=current.high_water;
  return (now:number)=>{currencyTime(p,now);if(now<created||now<highWater||Math.floor(now/86400000)!==day||new Date(now).toISOString().slice(0,7)!==month)stop('maintenance_currency_dispatch_time');};
 }
 async reserve(event:string,fingerprint:string,policy:Readonly<Policy>,inputTokens:number,now:number){
  policy=policyInput(policy);if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('maintenance_clock');if(!Number.isSafeInteger(inputTokens)||inputTokens<1||inputTokens>policy.maxInputTokens)stop('maintenance_input_tokens');
  const month=new Date(now).toISOString().slice(0,7);if(!/^\d{4}-\d{2}$/.test(month))stop('maintenance_clock');
  const cost=inputTokens*policy.inputRate+policy.maxOutputTokens*policy.outputRate;if(!Number.isSafeInteger(cost)||cost>policy.runCost)stop('maintenance_run_budget');
  const owner=crypto.randomUUID(),day=Math.floor(now/86400000),p=this.currency,pin=p?currencyPin(p):null;
  let schema;try{schema=await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='maintenance_currency_policy'").first();}catch{return stop('maintenance_accounting_unavailable');}
  if(p&&!schema)stop('maintenance_currency_schema_required');const usd=p?currencyCost(p,{inputTokens,outputTokens:policy.maxOutputTokens}):null;
  if(p){currencyTime(p,now);if(usd!>p.runLimit)stop('maintenance_currency_run_limit');}
  const columns=p?',currency_policy,currency_policy_hash,currency_reserved,currency_state':'';
  const values=p?",?,?,?,'reserved'":'';
  const guard=p?` AND EXISTS(SELECT 1 FROM maintenance_currency_policy WHERE id=1 AND policy_hash=? AND policy_json=? AND last_seen=?)
   AND NOT EXISTS(SELECT 1 FROM maintenance_proposals WHERE currency_policy_hash IS NULL OR currency_state IN ('reserved','uncertain'))
   AND (SELECT COALESCE(SUM(CASE WHEN currency_state='settled' THEN currency_actual ELSE currency_reserved END),0) FROM maintenance_proposals WHERE day=?)+?+?<=?
   AND (SELECT COALESCE(SUM(CASE WHEN currency_state='settled' THEN currency_actual ELSE currency_reserved END),0) FROM maintenance_proposals WHERE month=?)+?+?<=?`:(schema?' AND NOT EXISTS(SELECT 1 FROM maintenance_currency_policy)':'');
  const args:(string|number|null)[]=[event,fingerprint,owner,now,day,month,inputTokens,policy.maxOutputTokens,cost,...(p?[pin!.json,pin!.hash,usd]:[]),now,day,policy.dayRequests,month,policy.monthRequests,day,cost,policy.dayCost,month,cost,policy.monthCost,...(p?[pin!.hash,pin!.json,now,day,usd,p.dayBaseline,p.dayLimit,month,usd,p.monthBaseline,p.monthLimit]:[])];
  let statement;try{statement=this.db.prepare(`INSERT INTO maintenance_proposals(event_id,fingerprint,owner,state,created_at,day,month,input_tokens,output_tokens,reserved_cost${columns})
   SELECT ?,?,?,'calling',?,?,?,?,?,?${values} WHERE
   (SELECT COUNT(*) FROM maintenance_proposals)<16
   AND NOT EXISTS(SELECT 1 FROM maintenance_proposals WHERE state IN ('calling','uncertain') OR created_at>?)
   AND (SELECT COUNT(*) FROM maintenance_proposals WHERE day=?)<?
   AND (SELECT COUNT(*) FROM maintenance_proposals WHERE month=?)<?
   AND (SELECT COALESCE(SUM(reserved_cost),0) FROM maintenance_proposals WHERE day=?)+?<=?
   AND (SELECT COALESCE(SUM(reserved_cost),0) FROM maintenance_proposals WHERE month=?)+?<=?${guard}
   ON CONFLICT(event_id) DO NOTHING`).bind(...args);}catch{return stop('maintenance_accounting_unavailable');}
  let inserted;try{if(p){const rows=await this.db.batch([
   this.db.prepare(`INSERT INTO maintenance_currency_policy(id,policy_json,policy_hash,last_seen) SELECT 1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM maintenance_proposals) ON CONFLICT DO NOTHING`).bind(pin!.json,pin!.hash,now),
   this.db.prepare(`UPDATE maintenance_currency_policy SET last_seen=? WHERE id=1 AND policy_hash=? AND policy_json=? AND last_seen<=?`).bind(now,pin!.hash,pin!.json,now),statement]);inserted=rows[2];}else inserted=await statement.run();}catch{return stop('maintenance_accounting_unavailable');}
  const row=await this.job(event);if(row&&row.fingerprint!==fingerprint)stop('maintenance_event_conflict');
  if(inserted.meta.changes!==1||row?.owner!==owner)stop(row?'maintenance_generation_already_reserved':'maintenance_budget_or_concurrency');this.verifyCurrency(row);return row;
 }
 async rejected(row:ProposalRow,uncertain:boolean){
  // Any dispatched USD attempt without validated usage retains its full reservation and blocks admission.
  const currency=row.currency_policy!=null;try{const result=await this.db.prepare(`UPDATE maintenance_proposals SET state=?,error=?${currency?",currency_state='uncertain'":''} WHERE event_id=? AND fingerprint=? AND owner=? AND state='calling'`).bind(uncertain||currency?'uncertain':'failed',uncertain||currency?'maintenance_provider_unconfirmed':'maintenance_provider_rejected',row.event_id,row.fingerprint,row.owner).run();if(result.meta.changes!==1)stop('maintenance_accounting_unconfirmed');}catch{return stop('maintenance_accounting_unconfirmed');}
 }
 async ready(row:ProposalRow,response:unknown,packet:unknown,actualCost:number,settlement?:{usage:Usage;now:number}){
  const encoded=canonical(packet),reply=canonical(response);if(Buffer.byteLength(encoded)>49152||Buffer.byteLength(reply)>4096||actualCost>row.reserved_cost)stop('maintenance_output_limit');
  const p=this.currency;this.verifyCurrency(row);
  if(p){
   if(!settlement)stop('maintenance_currency_usage');const {usage,now}=settlement;currencyTime(p,now);
   if(now<row.created_at||Math.floor(now/86400000)!==row.day||usage.inputTokens!==row.input_tokens||usage.outputTokens>row.output_tokens)stop('maintenance_currency_usage');
   const usd=currencyCost(p,usage),raw=canonical(usage),pin=currencyPin(p);if(usd>row.currency_reserved!)stop('maintenance_currency_over_reservation');
   const saved=await this.job(row.event_id);if(saved&&['ready','complete'].includes(saved.state)){if(saved.owner!==row.owner||saved.fingerprint!==row.fingerprint)stop('maintenance_currency_receipt');this.verifyCurrency(saved,usage,true);if(saved.response!==reply||saved.packet!==encoded||saved.actual_cost!==actualCost)stop('maintenance_currency_receipt');return;}
   try{await this.db.batch([
    this.db.prepare('UPDATE maintenance_currency_policy SET last_seen=? WHERE id=1 AND policy_hash=? AND last_seen<=?').bind(now,pin.hash,now),
    this.db.prepare(`UPDATE maintenance_proposals SET state='ready',response=?,packet=?,packet_hash=?,actual_cost=?,currency_actual=?,currency_usage=?,currency_state='settled',currency_settled_at=? WHERE event_id=? AND fingerprint=? AND owner=? AND state='calling' AND currency_state='reserved' AND currency_policy_hash=? AND EXISTS(SELECT 1 FROM maintenance_currency_policy WHERE id=1 AND policy_hash=? AND last_seen=?)`).bind(reply,encoded,hash(encoded),actualCost,usd,raw,now,row.event_id,row.fingerprint,row.owner,pin.hash,pin.hash,now),
   ]);}catch{/* Read back an atomic settlement whose response may have been lost. */}
   const current=await this.job(row.event_id);if(!current||current.state!=='ready'||current.owner!==row.owner||current.response!==reply||current.packet!==encoded||current.actual_cost!==actualCost)stop('maintenance_accounting_unconfirmed');this.verifyCurrency(current,usage,true);return;
  }
  try{const result=await this.db.prepare(`UPDATE maintenance_proposals SET state='ready',response=?,packet=?,packet_hash=?,actual_cost=? WHERE event_id=? AND fingerprint=? AND owner=? AND state='calling'`).bind(reply,encoded,hash(encoded),actualCost,row.event_id,row.fingerprint,row.owner).run();if(result.meta.changes!==1)stop('maintenance_accounting_unconfirmed');}catch{return stop('maintenance_accounting_unconfirmed');}
 }
 async complete(row:ProposalRow,receipt:unknown){const encoded=canonical(receipt);if(Buffer.byteLength(encoded)>4096)stop('maintenance_receipt_limit');
  try{await this.db.prepare(`UPDATE maintenance_proposals SET state='complete',receipt=? WHERE event_id=? AND fingerprint=? AND owner=? AND packet_hash=? AND state='ready'`).bind(encoded,row.event_id,row.fingerprint,row.owner,row.packet_hash).run();}catch{return stop('maintenance_completion_unconfirmed');}
  const current=await this.job(row.event_id);if(current?.state!=='complete'||current.fingerprint!==row.fingerprint||current.receipt!==encoded)stop('maintenance_completion_unconfirmed');
 }
}
