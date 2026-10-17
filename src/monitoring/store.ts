import type { SqlDatabase } from '../editorial/contracts.ts';
import { digest } from '../editorial/validation.ts';
import { catalogSourceLimit, type SourceCatalog } from './catalog.ts';
import { limits, MonitorError, type Job, type SourceState, type Lease, type Observation, type Candidate, type CandidatePayload, type SourceEvent, type Head, type Scenario } from './contracts.ts';

type SourceRow = { id:string; url:string; title:string; article_ids:string; body_hash:string|null; etag:string|null; last_modified:string|null; checked_at:number; version:number };
type JobRow = { id:string; source_id:string; scenario:Scenario; state:string; attempts:number; due_at:number; lease_token:string|null; lease_until:number|null; result:string|null; error:string|null };
const sourceRow = (r:SourceRow):SourceState => ({id:r.id,url:r.url,title:r.title,articleIds:JSON.parse(r.article_ids),hash:r.body_hash,etag:r.etag,lastModified:r.last_modified,checkedAt:r.checked_at,version:r.version});
const jobRow = (r:JobRow):Job => ({id:r.id,sourceId:r.source_id,scenario:r.scenario,state:r.state,attempts:r.attempts,dueAt:r.due_at,leaseToken:r.lease_token,leaseUntil:r.lease_until,result:r.result,error:r.error});
type CandidateRow = { id:string; event_id:string; article_id:string; payload:string; state:string; review_flag:string; reason:string|null; version:number; created_at:number };
const candidateRow = (r:CandidateRow):Candidate => ({id:r.id,eventId:r.event_id,articleId:r.article_id,payload:r.payload,state:r.state,reviewFlag:r.review_flag,reason:r.reason,version:r.version,createdAt:r.created_at});

export class MonitorStore {
  db: SqlDatabase;
  constructor(db: SqlDatabase) { this.db=db; }
  async seed(catalog:SourceCatalog) {
    const sources=JSON.stringify(catalog.sources);
    // Both writes use whole-catalog admission inside D1's atomic batch. Inserting
    // a missing ID increases count and decreases missing by one, preserving this
    // predicate for the head write. A losing seed is a complete no-op, including
    // existing metadata; storage errors roll the entire batch back. Materialize
    // each statement's decision before writes, independently of planner choices.
    const admission=`(SELECT COUNT(*) FROM monitor_sources)+(SELECT COUNT(DISTINCT json_extract(value,'$.id')) FROM json_each(?) incoming
      WHERE NOT EXISTS(SELECT 1 FROM monitor_sources WHERE id=json_extract(incoming.value,'$.id')))<=?`;
    const results=await this.db.batch([
      this.db.prepare(`WITH catalog_admission AS MATERIALIZED (SELECT ${admission} AS fits)
        INSERT INTO monitor_sources(id,url,title,article_ids)
        SELECT json_extract(value,'$.id'),json_extract(value,'$.url'),json_extract(value,'$.title'),json_extract(value,'$.articleIds')
        FROM json_each(?) WHERE (SELECT fits FROM catalog_admission)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,article_ids=excluded.article_ids`)
        .bind(sources,catalogSourceLimit,sources),
      this.db.prepare(`WITH catalog_admission AS MATERIALIZED (SELECT ${admission} AS fits)
        INSERT INTO publication_heads(article_id) SELECT json_extract(value,'$.id') FROM json_each(?)
        WHERE (SELECT fits FROM catalog_admission) ON CONFLICT DO NOTHING`).bind(sources,catalogSourceLimit,JSON.stringify(catalog.articles)),
    ]);
    // Inspect this batch's own result, never a later read another seed can change.
    if(results[0].meta.changes!==catalog.sources.length)throw new MonitorError('catalog_capacity');
  }
  async source(id:string) { const r=await this.db.prepare('SELECT * FROM monitor_sources WHERE id=?').bind(id).first<SourceRow>();return r?sourceRow(r):null; }
  async sources() { return (await this.db.prepare('SELECT * FROM monitor_sources ORDER BY checked_at,id LIMIT ?').bind(catalogSourceLimit).all<SourceRow>()).results.map(sourceRow); }
  async job(id:string) { const r=await this.db.prepare('SELECT * FROM monitor_jobs WHERE id=?').bind(id).first<JobRow>();return r?jobRow(r):null; }
  async hasJobKey(key:string) { return !!await this.db.prepare('SELECT id FROM monitor_jobs WHERE dedupe_key=?').bind(key).first(); }
  async jobs() { return (await this.db.prepare('SELECT * FROM monitor_jobs ORDER BY created_at DESC,id LIMIT 20').all<JobRow>()).results.map(jobRow); }
  async enqueue(sourceId:string, scenario:Scenario, key:string, now:number) {
    if(key.length<1||key.length>180)throw new MonitorError('invalid_job_key');
    const id='j-'+(await digest(key)).slice(0,32);
    await this.db.prepare(`INSERT INTO monitor_jobs(id,dedupe_key,source_id,scenario,due_at,created_at,updated_at)
      SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM monitor_jobs)<? ON CONFLICT(dedupe_key) DO NOTHING`)
      .bind(id,key,sourceId,scenario,now,now,now,limits.jobs).run();
    const job=await this.job(id);
    if(!job)throw new MonitorError('job_capacity');
    if(job.sourceId!==sourceId||job.scenario!==scenario)throw new MonitorError('job_key_conflict');
    return job;
  }
  async due(now:number) {
    return (await this.db.prepare(`SELECT * FROM monitor_jobs WHERE
      ((state IN ('queued','retry','budget_blocked') AND due_at<=?) OR (state='running' AND lease_until<=?))
      AND (attempts<3 OR state='running') ORDER BY due_at,id LIMIT 4`).bind(now,now).all<JobRow>()).results.map(jobRow);
  }
  async claim(id:string, now:number, expectedAttempts:number|null=null):Promise<Lease|null> {
    const token=crypto.randomUUID();const day=Math.floor(now/86_400_000);
    const result=await this.db.batch([
      this.db.prepare(`UPDATE monitor_reservations SET outcome='abandoned' WHERE outcome='reserved' AND token IN
        (SELECT lease_token FROM monitor_jobs WHERE id=? AND state='running' AND lease_until<=?)`).bind(id,now),
      this.db.prepare(`UPDATE monitor_jobs SET state='running',lease_token=?,lease_until=?,updated_at=?
        WHERE id=? AND attempts<3 AND (? IS NULL OR attempts=?) AND ((state IN ('queued','retry','budget_blocked') AND due_at<=?) OR (state='running' AND lease_until<=?))
        AND NOT EXISTS(SELECT 1 FROM monitor_jobs other WHERE other.source_id=monitor_jobs.source_id AND other.id<>monitor_jobs.id AND other.state='running' AND other.lease_until>?)`)
        .bind(token,now+limits.leaseMs,now,id,expectedAttempts,expectedAttempts,now,now,now),
      this.db.prepare(`INSERT INTO monitor_reservations(token,job_id,attempt,day,max_bytes)
        SELECT ?,id,attempts+1,?,? FROM monitor_jobs WHERE id=? AND lease_token=?
        AND (SELECT COUNT(*) FROM monitor_reservations WHERE day=?)<?`)
        .bind(token,day,limits.responseBytes,id,token,day,limits.dailyAttempts),
      this.db.prepare(`UPDATE monitor_jobs SET attempts=attempts+1 WHERE id=? AND lease_token=? AND EXISTS(SELECT 1 FROM monitor_reservations WHERE token=?)`).bind(id,token,token),
      this.db.prepare(`UPDATE monitor_jobs SET state='budget_blocked',error='daily_fixture_budget',due_at=?,lease_token=NULL,lease_until=NULL
        WHERE id=? AND lease_token=? AND NOT EXISTS(SELECT 1 FROM monitor_reservations WHERE token=?)`).bind((day+1)*86_400_000,id,token,token),
      // An interrupted third attempt cannot be dispatched again indefinitely.
      this.db.prepare(`UPDATE monitor_jobs SET state='dead',error='attempts_exhausted_after_interrupt',lease_token=NULL,lease_until=NULL
        WHERE id=? AND state='running' AND lease_until<=? AND attempts>=3`).bind(id,now),
    ]);
    if(result[1].meta.changes!==1)return null;
    const job=await this.job(id);if(!job||job.leaseToken!==token||job.state!=='running')return null;
    const source=await this.source(job.sourceId);if(!source)throw new MonitorError('missing_source');
    return {job,source,token};
  }
  async fail(lease:Lease,error:MonitorError,now:number) {
    const retry=error.retryable&&lease.job.attempts<limits.attempts;
    const due=now+1000*2**(lease.job.attempts-1);
    await this.db.batch([
      this.db.prepare(`UPDATE monitor_jobs SET state=?,due_at=?,error=?,updated_at=?,finished_token=?,lease_token=NULL,lease_until=NULL
        WHERE id=? AND state='running' AND lease_token=? AND lease_until>?`)
        .bind(retry?'retry':'dead',due,error.code,now,lease.token,lease.job.id,lease.token,now),
      this.db.prepare(`UPDATE monitor_reservations SET outcome='failed' WHERE token=? AND EXISTS
        (SELECT 1 FROM monitor_jobs WHERE id=? AND finished_token=?)`).bind(lease.token,lease.job.id,lease.token),
    ]);
  }
  async complete(lease:Lease,observation:Observation,now:number) {
    const changed=observation.kind==='changed';
    const eventId='e-'+(await digest(`${lease.source.id}:${lease.source.version+1}:${observation.hash}`)).slice(0,32);
    const statements=[
      this.db.prepare(`UPDATE monitor_sources SET body_hash=?,etag=?,last_modified=?,checked_at=?,version=version+?,last_run_token=?
        WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM monitor_jobs WHERE id=? AND state='running' AND lease_token=? AND lease_until>?)
        AND (?=0 OR (SELECT COUNT(*) FROM source_events)<?)`)
        .bind(observation.hash,observation.etag,observation.lastModified,now,lease.source.hash===null||changed?1:0,lease.token,
          lease.source.id,lease.source.version,lease.job.id,lease.token,now,changed?1:0,limits.events),
    ];
    if(changed) {
      statements.push(this.db.prepare(`INSERT INTO source_events(id,source_id,source_version,old_hash,new_hash,token,observed_at)
        SELECT ?,id,version,?,?,?,? FROM monitor_sources WHERE id=? AND last_run_token=? AND EXISTS
        (SELECT 1 FROM monitor_jobs WHERE id=? AND state='running' AND lease_token=? AND lease_until>?) ON CONFLICT DO NOTHING`)
        .bind(eventId,lease.source.hash!,observation.hash,lease.token,now,lease.source.id,lease.token,lease.job.id,lease.token,now));
      for(const articleId of lease.source.articleIds) {
        const payload:CandidatePayload={kind:'source-observation',scope:'local-fixture-ledger',articleId,evidence:[{eventId,sourceId:lease.source.id,sourceUrl:lease.source.url,oldHash:lease.source.hash!,newHash:observation.hash}],note:'Synthetic source content changed. No article text or factual claim was altered.'};
        statements.push(this.db.prepare(`INSERT INTO publication_candidates(id,event_id,article_id,payload,created_at,updated_at)
          SELECT ?,id,?,?,?,? FROM source_events WHERE id=? AND token=? AND EXISTS
          (SELECT 1 FROM monitor_jobs WHERE id=? AND state='running' AND lease_token=? AND lease_until>?) ON CONFLICT DO NOTHING`)
          .bind('c-'+(await digest(eventId+':'+articleId)).slice(0,32),articleId,JSON.stringify(payload),now,now,eventId,lease.token,lease.job.id,lease.token,now));
      }
    }
    statements.push(
      this.db.prepare(`UPDATE monitor_jobs SET state='succeeded',result=?,error=NULL,updated_at=?,finished_token=?,lease_token=NULL,lease_until=NULL
        WHERE id=? AND state='running' AND lease_token=? AND lease_until>? AND EXISTS
        (SELECT 1 FROM monitor_sources WHERE id=? AND last_run_token=?)`)
        .bind(observation.kind,now,lease.token,lease.job.id,lease.token,now,lease.source.id,lease.token),
      this.db.prepare(`UPDATE monitor_reservations SET outcome='succeeded',actual_bytes=? WHERE token=? AND EXISTS
        (SELECT 1 FROM monitor_jobs WHERE id=? AND finished_token=? AND state='succeeded')`).bind(observation.bytes,lease.token,lease.job.id,lease.token),
    );
    const result=await this.db.batch(statements);
    return result[0].meta.changes===1;
  }
  async event(id:string):Promise<SourceEvent|null> {
    const r=await this.db.prepare('SELECT id,source_id AS sourceId,source_version AS sourceVersion,old_hash AS oldHash,new_hash AS newHash,observed_at AS observedAt FROM source_events WHERE id=?').bind(id).first<SourceEvent>();return r;
  }
  async candidates(queuedOnly=false) {
    return (await this.db.prepare(`SELECT * FROM publication_candidates ${queuedOnly?"WHERE state='queued'":''} ORDER BY created_at,id LIMIT ${queuedOnly?4:20}`).all<CandidateRow>()).results.map(candidateRow);
  }
  async candidate(id:string) {const r=await this.db.prepare('SELECT * FROM publication_candidates WHERE id=?').bind(id).first<CandidateRow>();return r?candidateRow(r):null;}
  async head(articleId:string) {return this.db.prepare('SELECT article_id AS articleId,current_revision AS currentRevision,version FROM publication_heads WHERE article_id=?').bind(articleId).first<Head>();}
  async block(candidate:Candidate,state:'blocked_evidence'|'blocked_malformed',reason:string,now:number) {
    await this.db.prepare(`UPDATE publication_candidates SET state=?,reason=?,review_flag='flagged',version=version+1,updated_at=? WHERE id=? AND state='queued' AND version=? AND payload=?`)
      .bind(state,reason,now,candidate.id,candidate.version,candidate.payload).run();
  }
  async stale(candidate:Candidate) {
    return !!await this.db.prepare(`SELECT newer.id FROM publication_revisions newer JOIN source_events observed ON observed.id=newer.event_id
      JOIN source_events current ON current.id=? WHERE newer.article_id=? AND observed.source_id=current.source_id AND observed.source_version>current.source_version LIMIT 1`)
      .bind(candidate.eventId,candidate.articleId).first();
  }
  async supersede(candidate:Candidate,now:number) {
    await this.db.prepare(`UPDATE publication_candidates SET state='superseded',reason='newer_observation_published',version=version+1,updated_at=? WHERE id=? AND state='queued' AND version=?`)
      .bind(now,candidate.id,candidate.version).run();
  }
  async publish(candidate:Candidate,now:number) {
    const head=await this.head(candidate.articleId);if(!head)throw new MonitorError('missing_article');
    const token=crypto.randomUUID();
    const result=await this.db.batch([
      this.db.prepare(`INSERT INTO publication_revisions(id,article_id,previous_revision,event_id,payload,token,created_at)
        SELECT c.id,c.article_id,h.current_revision,c.event_id,c.payload,?,? FROM publication_candidates c
        JOIN publication_heads h ON h.article_id=c.article_id WHERE c.id=? AND c.state='queued' AND c.version=? AND c.payload=? AND h.version=?
        AND NOT EXISTS(SELECT 1 FROM publication_revisions newer JOIN source_events observed ON observed.id=newer.event_id
          JOIN source_events current ON current.id=c.event_id WHERE newer.article_id=c.article_id AND observed.source_id=current.source_id AND observed.source_version>current.source_version)
        ON CONFLICT DO NOTHING`)
        .bind(token,now,candidate.id,candidate.version,candidate.payload,head.version),
      this.db.prepare(`UPDATE publication_heads SET current_revision=?,version=version+1 WHERE article_id=? AND version=?
        AND EXISTS(SELECT 1 FROM publication_revisions WHERE id=? AND token=?)`).bind(candidate.id,candidate.articleId,head.version,candidate.id,token),
      this.db.prepare(`UPDATE publication_candidates SET state='published',review_flag='flagged',reason='source_changed',version=version+1,updated_at=?,last_token=?
        WHERE id=? AND EXISTS(SELECT 1 FROM publication_revisions WHERE id=? AND token=?)`).bind(now,token,candidate.id,candidate.id,token),
      this.db.prepare(`INSERT INTO publication_actions(request_key,candidate_id,action,fingerprint,actor,created_at)
        SELECT ?,id,'auto-published',?,'local-auto-publisher',? FROM publication_candidates WHERE id=? AND last_token=?`)
        .bind(token,candidate.payload,now,candidate.id,token),
    ]);
    return result[0].meta.changes===1;
  }
  async transition(id:string,action:'revert'|'restore'|'clear-flag',expectedHead:number,expectedCandidate:number,key:string,actor:string,now:number) {
    const fingerprint=await digest(JSON.stringify([id,action,expectedHead,expectedCandidate]));
    const prior=await this.db.prepare('SELECT fingerprint FROM publication_actions WHERE request_key=?').bind(key).first<{fingerprint:string}>();
    if(prior) {if(prior.fingerprint!==fingerprint)throw new MonitorError('action_key_conflict');return true;}
    const candidate=await this.candidate(id);if(!candidate)throw new MonitorError('missing_candidate');
    const revision=await this.db.prepare('SELECT previous_revision FROM publication_revisions WHERE id=?').bind(id).first<{previous_revision:string|null}>();
    if(!revision)throw new MonitorError('not_a_published_revision');
    const token=crypto.randomUUID();
    const nextState=action==='revert'?'reverted':'published';
    const nextHead=action==='revert'?revision.previous_revision:id;
    const currentHead=action==='restore'?revision.previous_revision:id;
    const guard=action==='restore'?"state='reverted'":action==='revert'?"state='published'":"state='published' AND review_flag='flagged'";
    const result=await this.db.batch([
      this.db.prepare(`UPDATE publication_candidates SET state=?,review_flag=?,reason=?,version=version+1,updated_at=?,last_token=?
        WHERE id=? AND version=? AND ${guard} AND (?=0 OR EXISTS(SELECT 1 FROM publication_heads WHERE article_id=? AND version=? AND current_revision IS ?))`)
        .bind(nextState,action==='clear-flag'?'cleared':'flagged',action==='clear-flag'?'reviewed_locally':action==='revert'?'reverted_for_followup':'restored_for_followup',now,token,id,expectedCandidate,action==='clear-flag'?0:1,candidate.articleId,expectedHead,currentHead),
      this.db.prepare(`UPDATE publication_heads SET current_revision=?,version=version+? WHERE article_id=? AND version=?
        AND ?=1 AND EXISTS(SELECT 1 FROM publication_candidates WHERE id=? AND last_token=?)`)
        .bind(nextHead,1,candidate.articleId,expectedHead,action==='clear-flag'?0:1,id,token),
      this.db.prepare(`INSERT INTO publication_actions(request_key,candidate_id,action,fingerprint,actor,created_at)
        SELECT ?,id,?,?,?,? FROM publication_candidates WHERE id=? AND last_token=?`)
        .bind(key,action,fingerprint,actor,now,id,token),
    ]);
    return result[0].meta.changes===1;
  }
  async budget(now:number) {return (await this.db.prepare('SELECT COUNT(*) AS attempts,COALESCE(SUM(max_bytes),0) AS reservedBytes FROM monitor_reservations WHERE day=?').bind(Math.floor(now/86_400_000)).first<{attempts:number;reservedBytes:number}>())!;}
  async actions() {return (await this.db.prepare('SELECT candidate_id AS candidateId,action,actor,created_at AS createdAt FROM publication_actions ORDER BY created_at DESC,request_key LIMIT 20').all<{candidateId:string;action:string;actor:string;createdAt:number}>()).results;}
}
