import type {SqlDatabase} from '../editorial/contracts.ts';
import type {HttpLastGood,HttpResult} from './http-core.ts';
import {httpSources,officialSource} from './http-registry.ts';

export const durableHttpLimits=Object.freeze({dailyRequests:20,concurrent:4,attempts:3,jobs:128,leaseMs:10000});
type SourceRow={source_id:string;body_hash:string|null;etag:string|null;last_modified:string|null;checked_at:number;version:number};
type JobRow={request_key:string;source_id:string;state:string;attempts:number;due_at:number;lease_token:string|null;lease_until:number|null;result:string|null};
export type HttpLease={key:string;sourceId:string;token:string;attempt:number;version:number;lastGood:HttpLastGood|null};
export class HttpStoreError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
const baseline=(row:SourceRow):HttpLastGood|null=>row.body_hash===null?null:{mode:'http',sourceId:row.source_id,hash:row.body_hash,etag:row.etag,lastModified:row.last_modified,checkedAt:row.checked_at};
const validTime=(now:number)=>{if(!Number.isSafeInteger(now)||now<0)throw new HttpStoreError('invalid_clock');};

// Reuses the existing D1 repository interface/batch transactions, with separate HTTP provenance.
export class HttpObservationStore {
  db:SqlDatabase;
  constructor(db:SqlDatabase){this.db=db;}
  async seed(){await this.db.batch(httpSources.map(source=>this.db.prepare('INSERT INTO http_source_state(source_id) VALUES(?) ON CONFLICT DO NOTHING').bind(source.id)));}
  async source(id:string){const row=await this.db.prepare('SELECT * FROM http_source_state WHERE source_id=?').bind(id).first<SourceRow>();return row?{version:row.version,lastGood:baseline(row)}:null;}
  async job(key:string){return this.db.prepare('SELECT * FROM http_check_jobs WHERE request_key=?').bind(key).first<JobRow>();}
  async enqueue(id:unknown,key:unknown,now:number){
    validTime(now);if(!officialSource(id))throw new HttpStoreError('source_not_allowlisted');
    if(typeof key!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key))throw new HttpStoreError('invalid_request_key');
    await this.seed();
    await this.db.prepare(`INSERT INTO http_check_jobs(request_key,source_id,due_at,created_at)
      SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM http_check_jobs)<128 ON CONFLICT DO NOTHING`).bind(key,id as string,now,now).run();
    const job=await this.job(key);if(!job)throw new HttpStoreError('http_job_capacity');
    if(job.source_id!==id)throw new HttpStoreError('http_key_conflict');return job;
  }
  async claim(key:string,now:number):Promise<HttpLease|null>{
    validTime(now);const day=Math.floor(now/86400000);const token=crypto.randomUUID();
    const exhausted=JSON.stringify({status:'dead',error:'http_attempts_exhausted'});
    // D1 batch is a serialized transaction. Charge before dispatch; never refund ambiguity.
    await this.db.batch([
      this.db.prepare(`UPDATE http_request_reservations SET outcome='abandoned' WHERE outcome='reserved'
        AND token IN(SELECT lease_token FROM http_check_jobs WHERE request_key=? AND state='running' AND lease_until<=?)`).bind(key,now),
      this.db.prepare(`UPDATE http_check_jobs SET state='dead',lease_token=NULL,lease_until=NULL,result=?
        WHERE request_key=? AND state='running' AND attempts=3 AND lease_until<=?`).bind(exhausted,key,now),
      this.db.prepare('UPDATE http_request_budget SET day=?,used=0 WHERE id=1 AND day<?').bind(day,day),
      this.db.prepare(`UPDATE http_check_jobs SET state='running',attempts=attempts+1,lease_token=?,lease_until=?,result=NULL
        WHERE request_key=? AND attempts<3 AND ((state IN ('queued','retry') AND due_at<=?) OR (state='running' AND lease_until<=?))
        AND EXISTS(SELECT 1 FROM http_request_budget WHERE id=1 AND day=? AND used<20)
        AND (SELECT COUNT(*) FROM http_check_jobs WHERE state='running' AND lease_until>?)<4
        AND NOT EXISTS(SELECT 1 FROM http_check_jobs other WHERE other.source_id=http_check_jobs.source_id
          AND other.request_key<>http_check_jobs.request_key AND other.state='running' AND other.lease_until>?)`).bind(token,now+durableHttpLimits.leaseMs,key,now,now,day,now,now),
      this.db.prepare(`INSERT INTO http_request_reservations(token,request_key,attempt,day)
        SELECT ?,request_key,attempts,? FROM http_check_jobs WHERE request_key=? AND lease_token=?`).bind(token,day,key,token),
      this.db.prepare('UPDATE http_request_budget SET used=used+1 WHERE id=1 AND EXISTS(SELECT 1 FROM http_request_reservations WHERE token=?)').bind(token),
    ]);
    const job=await this.job(key);if(job?.lease_token!==token)return null;
    const source=await this.source(job.source_id);if(!source)throw new HttpStoreError('missing_http_source');
    return {key,sourceId:job.source_id,token,attempt:job.attempts,version:source.version,lastGood:source.lastGood};
  }
  async finish(lease:HttpLease,result:HttpResult,now:number){
    validTime(now);
    const retry=!result.ok&&result.error.retryable&&lease.attempt<3;
    const state=result.ok?'succeeded':retry?'retry':'dead';const due=now+1000*2**(lease.attempt-1);
    const receipt=JSON.stringify({status:state,...(retry?{retryAt:due}:{}),...result});
    if(receipt.length>2048)throw new HttpStoreError('http_receipt_too_large');
    const statements=[];
    if(result.ok){
      if(result.state.sourceId!==lease.sourceId||result.state.mode!=='http')throw new HttpStoreError('invalid_http_result');
      statements.push(this.db.prepare(`UPDATE http_source_state SET body_hash=?,etag=?,last_modified=?,checked_at=?,version=version+1,last_token=?
        WHERE source_id=? AND version=? AND EXISTS(SELECT 1 FROM http_check_jobs WHERE request_key=? AND state='running' AND lease_token=? AND lease_until>?)`)
        .bind(result.state.hash,result.state.etag,result.state.lastModified,result.state.checkedAt,lease.token,lease.sourceId,lease.version,lease.key,lease.token,now));
    }
    statements.push(this.db.prepare(`UPDATE http_check_jobs SET state=?,result=?,due_at=?,finished_token=?,lease_token=NULL,lease_until=NULL
      WHERE request_key=? AND state='running' AND lease_token=? AND lease_until>?
      ${result.ok?'AND EXISTS(SELECT 1 FROM http_source_state WHERE source_id=? AND last_token=?)':''}`)
      .bind(state,receipt,due,lease.token,lease.key,lease.token,now,...(result.ok?[lease.sourceId,lease.token]:[])),
      this.db.prepare(`UPDATE http_request_reservations SET outcome=?,actual_bytes=? WHERE token=? AND outcome='reserved'
        AND EXISTS(SELECT 1 FROM http_check_jobs WHERE request_key=? AND finished_token=?)`)
        .bind(result.ok?'succeeded':'failed',result.ok?result.observation.bytes:null,lease.token,lease.key,lease.token));
    const changes=await this.db.batch(statements);return changes[result.ok?1:0].meta.changes===1;
  }
  async status(key:string,now:number=Date.now()){
    validTime(now);
    const job=await this.job(key);if(!job)throw new HttpStoreError('missing_http_job');
    const busy=job.state==='running'&&job.lease_until!==null&&job.lease_until>now;
    return job.result??JSON.stringify({status:busy?'busy':'blocked',error:busy?'http_in_progress':'http_not_due_or_budget',attempts:job.attempts});
  }
}
