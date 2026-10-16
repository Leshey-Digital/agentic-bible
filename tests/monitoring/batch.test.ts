import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SqliteD1 } from '../editorial/sqlite.ts';
import { validateCatalog } from '../../src/monitoring/catalog.ts';
import { MonitorStore } from '../../src/monitoring/store.ts';
import { BatchJournal, BatchError, batchLimits, executeBatch, type BatchLease, type BatchPlan } from '../../src/monitoring/batch.ts';
import { fixtureTransport } from '../../src/monitoring/fixtures.ts';
import { runJob } from '../../src/monitoring/runner.ts';
import { publishQueued } from '../../src/monitoring/publication.ts';
import { MonitorError, type FixtureTransport } from '../../src/monitoring/contracts.ts';

const catalog=await validateCatalog(JSON.parse(readFileSync('dist/source-catalog.json','utf8')));
const now=1_792_168_000_000;
async function setup(path=':memory:',initialize=true){
  const db=new SqliteD1(path,initialize);
  if(initialize)for(const migration of ['0002_source_monitoring.sql','0003_monitor_batch_commands.sql'])db.raw.exec(readFileSync('migrations/'+migration,'utf8'));
  const store=new MonitorStore(db);await store.seed(catalog);return {db,store,journal:new BatchJournal(db)};
}
const count=(db:SqliteD1,table:string)=>Number(db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);
const snapshot=(store:MonitorStore,time=now)=>async()=>({jobs:await store.jobs(),budget:await store.budget(time),candidates:await store.candidates(),actions:await store.actions()});
const batchError=(code:string)=>(error:unknown)=>error instanceof BatchError&&error.code===code;

test('batch commands replay exact saved results after later work and reject changed actions',async()=>{
  const {db,store}=await setup();
  const scheduleKey=crypto.randomUUID();
  const first=await executeBatch(store,catalog,'schedule',scheduleKey,snapshot(store),()=>now);
  assert.equal(count(db,'monitor_jobs'),4);
  assert.equal(await executeBatch(store,catalog,'schedule',scheduleKey,snapshot(store),()=>now+1),first);
  assert.equal(count(db,'monitor_jobs'),4);
  await executeBatch(store,catalog,'schedule',crypto.randomUUID(),snapshot(store),()=>now+2);
  assert.equal(count(db,'monitor_jobs'),8);
  assert.equal(await executeBatch(store,catalog,'schedule',scheduleKey,snapshot(store),()=>now+3),first);
  assert.equal(await executeBatch(store,catalog,'schedule',scheduleKey.toUpperCase(),snapshot(store),()=>now+3),first);
  await assert.rejects(executeBatch(store,catalog,'process',scheduleKey,snapshot(store),()=>now+4),batchError('command_key_conflict'));
  const processKey=crypto.randomUUID();
  const processed=await executeBatch(store,catalog,'process',processKey,snapshot(store),()=>now+5);
  assert.equal((await store.budget(now)).attempts,4);
  await executeBatch(store,catalog,'process',crypto.randomUUID(),snapshot(store),()=>now+6);
  assert.equal((await store.budget(now)).attempts,8);
  assert.equal(await executeBatch(store,catalog,'process',processKey,snapshot(store),()=>now+7),processed);
  assert.equal((await store.budget(now)).attempts,8);db.raw.close();
});

test('receipt capacity preserves the full retry window and only expired receipts free capacity',async()=>{
  const {db,journal}=await setup();const firstKey=crypto.randomUUID();
  const first=await journal.begin('schedule',firstKey,now) as BatchLease;
  await journal.finish(first,'{"original":true}',now);
  for(let i=1;i<batchLimits.receipts;i++){
    const lease=await journal.begin('schedule',crypto.randomUUID(),now+1000) as BatchLease;
    await journal.finish(lease,'{}',now+1000);
  }
  await assert.rejects(journal.begin('schedule',crypto.randomUUID(),now+batchLimits.retryWindowMs-1),batchError('command_capacity'));
  assert.equal(await journal.begin('schedule',firstKey,now+batchLimits.retryWindowMs-1),'{"original":true}');
  assert.equal(count(db,'monitor_batch_commands'),batchLimits.receipts);
  const next=await journal.begin('schedule',crypto.randomUUID(),now+batchLimits.retryWindowMs);
  assert.equal(typeof next,'object');assert.equal(count(db,'monitor_batch_commands'),batchLimits.receipts);
  db.raw.close();
});

test('a command lease excludes concurrent retries and stale owners cannot replace its plan or result',async()=>{
  const {db,journal}=await setup();const key=crypto.randomUUID();
  const old=await journal.begin('schedule',key,now) as BatchLease;
  await assert.rejects(journal.begin('schedule',key,now+1),batchError('command_in_progress'));
  const plan:BatchPlan={schedules:[],jobs:[],candidates:[]};
  await journal.checkpoint(old,plan,now+2);
  const current=await journal.begin('schedule',key,now+batchLimits.leaseMs+3) as BatchLease;
  assert.deepEqual(current.plan,plan);
  await assert.rejects(journal.checkpoint(old,{...plan,schedules:[{sourceId:'invalid',key:'invalid'}]},now+batchLimits.leaseMs+4),batchError('command_in_progress'));
  await assert.rejects(journal.finish(old,'{}',now+batchLimits.leaseMs+4),batchError('command_in_progress'));
  await journal.finish(current,'{"winner":true}',now+batchLimits.leaseMs+4);
  assert.equal(await journal.begin('schedule',key,now+batchLimits.leaseMs+5),'{"winner":true}');
  // A retry may read pending state just before its owner checkpoints and releases on failure.
  const racingKey=crypto.randomUUID();const owner=await journal.begin('schedule',racingKey,now) as BatchLease;
  let releaseRead!:()=>void;let observed!:()=>void;
  const gate=new Promise<void>(resolve=>{releaseRead=resolve;});const read=new Promise<void>(resolve=>{observed=resolve;});
  class PausedJournal extends BatchJournal {
    first=true;
    override async receipt(value:string){const receipt=await super.receipt(value);if(this.first){this.first=false;observed();await gate;}return receipt;}
  }
  const retry=new PausedJournal(db).begin('schedule',racingKey,now+3);await read;
  await journal.checkpoint(owner,plan,now+1);await journal.release(owner);releaseRead();
  assert.deepEqual((await retry as BatchLease).plan,plan,'New ownership must reread the latest persisted checkpoint, not its earlier snapshot.');
  db.raw.close();
});

test('a partially scheduled command resumes the frozen batch after database reopen',async()=>{
  const directory=mkdtempSync('.git/batch-restart-');const path=join(directory,'fixture.sqlite');let {db,store,journal}=await setup(path);
  try{
    const key=crypto.randomUUID();const lease=await journal.begin('schedule',key,now) as BatchLease;
    const schedules=catalog.sources.slice(0,4).map(source=>({sourceId:source.id,key:`hour:${Math.floor(now/3600000)}:${source.id}`}));
    await journal.checkpoint(lease,{schedules,jobs:[],candidates:[]},now);
    await store.enqueue(schedules[0].sourceId,'unchanged',schedules[0].key,now);
    db.raw.close();({db,store,journal}=await setup(path,false));
    const resumed=await executeBatch(store,catalog,'schedule',key,snapshot(store),()=>now+batchLimits.leaseMs+1);
    assert.equal(count(db,'monitor_jobs'),4);
    db.raw.close();({db,store,journal}=await setup(path,false));
    assert.equal(await executeBatch(store,catalog,'schedule',key,snapshot(store),()=>now+batchLimits.leaseMs+2),resumed);
    assert.equal(count(db,'monitor_jobs'),4);
  }finally{db.raw.close();rmSync(directory,{recursive:true,force:true});}
});

test('recovery cannot dispatch a second attempt for a job already attempted by that command',async()=>{
  const {db,store,journal}=await setup();const source=catalog.sources[0];
  const job=await store.enqueue(source.id,'transient',crypto.randomUUID(),now);
  const key=crypto.randomUUID();const command=await journal.begin('process',key,now) as BatchLease;
  await journal.checkpoint(command,{schedules:[],jobs:[{id:job.id,attempts:0}],candidates:null},now);
  const lease=(await store.claim(job.id,now,0))!;
  await store.fail(lease,new MonitorError('http_503',true),now);
  let calls=0;const transport:FixtureTransport={mode:'fixture',fetch:async(url,options)=>{calls++;return fixtureTransport.fetch(url,options);}};
  const later=now+batchLimits.leaseMs+1;
  await executeBatch(store,catalog,'process',key,snapshot(store),()=>later,transport);
  assert.equal(calls,0);assert.equal((await store.job(job.id))?.attempts,1);assert.equal((await store.budget(now)).attempts,1);
  await executeBatch(store,catalog,'process',crypto.randomUUID(),snapshot(store),()=>later+1,transport);
  assert.equal(calls,1);assert.equal((await store.job(job.id))?.attempts,2);db.raw.close();
});

test('publication recovery never selects additional candidates after its frozen revision already committed',async()=>{
  const {db,store,journal}=await setup();
  const sources=catalog.sources.filter(source=>source.articleIds.length===1).slice(0,2);assert.equal(sources.length,2);
  async function change(index:number){
    for(const scenario of ['baseline','change'] as const){const job=await store.enqueue(sources[index].id,scenario,crypto.randomUUID(),now);await runJob(store,catalog,job.id,fixtureTransport,()=>now);}
  }
  await change(0);const first=(await store.candidates(true))[0];const key=crypto.randomUUID();
  const command=await journal.begin('process',key,now) as BatchLease;
  await journal.checkpoint(command,{schedules:[],jobs:[],candidates:[first.id]},now);
  await publishQueued(store,catalog,now,[first.id]);await change(1);
  const second=(await store.candidates(true))[0];assert.notEqual(second.id,first.id);
  await executeBatch(store,catalog,'process',key,snapshot(store),()=>now+batchLimits.leaseMs+1);
  assert.equal(count(db,'publication_revisions'),1);assert.equal((await store.candidate(second.id))?.state,'queued');db.raw.close();
});

test('a failed receipt commit can retry without refetching jobs or publishing more revisions',async()=>{
  const {db,store}=await setup();
  await executeBatch(store,catalog,'schedule',crypto.randomUUID(),snapshot(store),()=>now);
  const key=crypto.randomUUID();
  db.raw.exec("CREATE TRIGGER synthetic_receipt_failure BEFORE UPDATE OF state ON monitor_batch_commands WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  await assert.rejects(executeBatch(store,catalog,'process',key,snapshot(store),()=>now));
  assert.equal((await store.budget(now)).attempts,4);
  db.raw.exec('DROP TRIGGER synthetic_receipt_failure');
  await executeBatch(store,catalog,'process',key,snapshot(store),()=>now+10000);
  assert.equal((await store.budget(now)).attempts,4);assert.equal(count(db,'monitor_jobs'),4);db.raw.close();
});

test('result capacity fails closed while retaining the pending receipt and original work plan',async()=>{
  const {db,store}=await setup();const key=crypto.randomUUID();
  await assert.rejects(executeBatch(store,catalog,'schedule',key,async()=>({oversized:'x'.repeat(batchLimits.resultBytes)}),()=>now),batchError('command_result_capacity'));
  assert.equal(count(db,'monitor_jobs'),4);
  await executeBatch(store,catalog,'schedule',key,snapshot(store),()=>now+1);
  assert.equal(count(db,'monitor_jobs'),4);db.raw.close();
});
