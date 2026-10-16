import type { SqlDatabase } from '../editorial/contracts.ts';
import { digest } from '../editorial/validation.ts';
import { validateCatalog, type SourceCatalog } from './catalog.ts';
import { limits, type FixtureTransport } from './contracts.ts';
import { fixtureTransport } from './fixtures.ts';
import { publishQueued } from './publication.ts';
import { runJob } from './runner.ts';
import { MonitorStore } from './store.ts';

export const batchLimits=Object.freeze({ receipts:128, retryWindowMs:86_400_000, leaseMs:30_000, resultBytes:131072 });
export type BatchAction='schedule'|'process';
export type BatchPlan={ schedules:{sourceId:string;key:string}[]; jobs:{id:string;attempts:number}[]; candidates:string[]|null };
type Receipt={request_key:string;action:BatchAction;fingerprint:string;state:'pending'|'complete';plan:string|null;result:string|null;expires_at:number};
export type BatchLease={key:string;token:string;plan:BatchPlan|null};
export class BatchError extends Error {
  code:string;status:number;
  constructor(code:string,status:number){super(code);this.code=code;this.status=status;}
}

// Receipts are retained for a fixed retry window. Capacity never evicts an unexpired key.
export class BatchJournal {
  private db:SqlDatabase;
  constructor(db:SqlDatabase){this.db=db;}
  async receipt(key:string){return this.db.prepare('SELECT * FROM monitor_batch_commands WHERE request_key=?').bind(key).first<Receipt>();}
  async begin(action:BatchAction,key:string,now:number):Promise<BatchLease|string>{
    key=key.toLowerCase();
    const fingerprint=await digest(JSON.stringify({action}));
    await this.db.batch([
      this.db.prepare('DELETE FROM monitor_batch_commands WHERE expires_at<=? AND (lease_until IS NULL OR lease_until<=?)').bind(now,now),
      this.db.prepare(`INSERT INTO monitor_batch_commands(request_key,action,fingerprint,created_at,expires_at)
        SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM monitor_batch_commands)<? ON CONFLICT DO NOTHING`)
        .bind(key,action,fingerprint,now,now+batchLimits.retryWindowMs,batchLimits.receipts),
    ]);
    let receipt=await this.receipt(key);
    if(!receipt)throw new BatchError('command_capacity',503);
    if(receipt.fingerprint!==fingerprint)throw new BatchError('command_key_conflict',409);
    if(receipt.expires_at<=now)throw new BatchError('command_expired',410);
    if(receipt.state==='complete')return receipt.result!;
    const token=crypto.randomUUID();
    const result=await this.db.prepare(`UPDATE monitor_batch_commands SET lease_token=?,lease_until=?
      WHERE request_key=? AND state='pending' AND expires_at>? AND (lease_until IS NULL OR lease_until<=?)`)
      .bind(token,now+batchLimits.leaseMs,key,now,now).run();
    if(result.meta.changes!==1){
      receipt=(await this.receipt(key))!;
      if(receipt.state==='complete')return receipt.result!;
      throw new BatchError('command_in_progress',409);
    }
    receipt=(await this.receipt(key))!;
    return {key,token,plan:receipt.plan?JSON.parse(receipt.plan):null};
  }
  async renew(lease:BatchLease,now:number){
    const result=await this.db.prepare(`UPDATE monitor_batch_commands SET lease_until=? WHERE request_key=?
      AND state='pending' AND lease_token=? AND lease_until>? AND expires_at>?`)
      .bind(now+batchLimits.leaseMs,lease.key,lease.token,now,now).run();
    if(result.meta.changes!==1)throw new BatchError('command_in_progress',409);
  }
  async checkpoint(lease:BatchLease,plan:BatchPlan,now:number){
    await this.renew(lease,now);
    const result=await this.db.prepare(`UPDATE monitor_batch_commands SET plan=? WHERE request_key=?
      AND state='pending' AND lease_token=? AND lease_until>? AND expires_at>?`)
      .bind(JSON.stringify(plan),lease.key,lease.token,now,now).run();
    if(result.meta.changes!==1)throw new BatchError('command_in_progress',409);
    lease.plan=plan;
  }
  async finish(lease:BatchLease,result:string,now:number){
    if(new TextEncoder().encode(result).byteLength>batchLimits.resultBytes)throw new BatchError('command_result_capacity',503);
    const saved=await this.db.prepare(`UPDATE monitor_batch_commands SET state='complete',result=?,lease_token=NULL,lease_until=NULL
      WHERE request_key=? AND state='pending' AND lease_token=? AND lease_until>? AND expires_at>?`)
      .bind(result,lease.key,lease.token,now,now).run();
    if(saved.meta.changes!==1)throw new BatchError('command_in_progress',409);
  }
  async release(lease:BatchLease){
    await this.db.prepare("UPDATE monitor_batch_commands SET lease_token=NULL,lease_until=NULL WHERE request_key=? AND state='pending' AND lease_token=?")
      .bind(lease.key,lease.token).run();
  }
}

export async function executeBatch(store:MonitorStore,catalog:SourceCatalog,action:BatchAction,key:string,readState:()=>Promise<unknown>,clock:()=>number=Date.now,transport:FixtureTransport=fixtureTransport):Promise<string>{
  await validateCatalog(catalog);
  const journal=new BatchJournal(store.db);
  const acquired=await journal.begin(action,key,clock());
  if(typeof acquired==='string')return acquired;
  const lease=acquired;
  try {
    if(!lease.plan){
      const plan:BatchPlan={schedules:[],jobs:[],candidates:action==='schedule'?[]:null};
      if(action==='schedule'){
        const slot=Math.floor(clock()/3_600_000);
        for(const source of await store.sources()){
          if(!catalog.sources.some(allowed=>allowed.id===source.id))continue;
          const jobKey=`hour:${slot}:${source.id}`;
          if(await store.hasJobKey(jobKey))continue;
          plan.schedules.push({sourceId:source.id,key:jobKey});if(plan.schedules.length===limits.perRun)break;
        }
      }else plan.jobs=(await store.due(clock())).map(job=>({id:job.id,attempts:job.attempts}));
      // Freeze selection before any side effect. A resumed command never selects the next batch.
      await journal.checkpoint(lease,plan,clock());
    }
    const plan=lease.plan!;
    for(const scheduled of plan.schedules){
      await journal.renew(lease,clock());
      await store.enqueue(scheduled.sourceId,'unchanged',scheduled.key,clock());
    }
    for(const job of plan.jobs){
      await journal.renew(lease,clock());
      // The ordinal guard is part of the atomic job claim: an interrupted attempt still counts once.
      await runJob(store,catalog,job.id,transport,clock,limits.timeoutMs,job.attempts);
    }
    if(plan.candidates===null){
      await journal.checkpoint(lease,{...plan,candidates:(await store.candidates(true)).map(candidate=>candidate.id)},clock());
    }
    for(const id of lease.plan!.candidates!){
      await journal.renew(lease,clock());
      await publishQueued(store,catalog,clock(),[id]);
    }
    await journal.renew(lease,clock());
    const result=JSON.stringify(await readState());
    await journal.finish(lease,result,clock());
    return result;
  }catch(error){
    await journal.release(lease).catch(()=>{});
    throw error;
  }
}
