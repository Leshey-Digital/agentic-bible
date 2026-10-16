import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SqliteD1 } from '../editorial/sqlite.ts';
import { defaults, updateInput, type Group } from '../../src/settings/contracts.ts';
import { SettingsStore } from '../../src/settings/store.ts';
import { receiptLimits, SettingsReceiptCapacityError } from '../../src/settings/receipts.ts';
import { digest, ReplayConflictError } from '../../src/editorial/validation.ts';
import { publicSettingsPreview } from '../../src/settings/render.ts';

const now=1_792_168_000_000;const actor='local-editor';
const google={tagId:'GT-SYNTHETIC9',ga4Id:'',enabled:true};
const input=(group:Group,values:unknown,version=1,requestKey=crypto.randomUUID())=>updateInput({group,values,version,requestKey});
function setup(path=':memory:',initialize=true){
  const db=new SqliteD1(path,initialize);
  if(initialize)for(const file of ['0003_measurement_settings.sql','0004_measurement_request_receipts.sql'])db.raw.exec(readFileSync('migrations/'+file,'utf8'));
  return {db,store:new SettingsStore(db)};
}
const receiptCount=(db:SqliteD1)=>Number(db.raw.prepare('SELECT COUNT(*) AS n FROM measurement_request_receipts').get()!.n);

test('no-op receipts preserve exact private responses after later writes and bind changed payloads',async()=>{
  const {db,store}=setup();const noop=input('google',defaults.google);
  const first=await store.commit(noop,actor,now);assert.equal(first.result,'unchanged');assert.ok(first.response);
  assert.equal(receiptCount(db),1);assert.equal((await store.read()).google.version,1);assert.deepEqual(await store.audit(),[]);
  await assert.rejects(store.commit({...noop,values:google},actor,now+1),ReplayConflictError);
  assert.equal((await store.read()).google.version,1);
  assert.equal(await store.update(input('google',google),actor,now+2),'saved');
  const replay=await store.commit(noop,actor,now+3);assert.deepEqual(replay,first);
  assert.deepEqual(JSON.parse(replay.response!).settings.google.values,defaults.google);
  assert.deepEqual((await store.read()).google.values,google);assert.equal((await store.audit()).length,1);assert.equal(receiptCount(db),1);
  await assert.rejects(store.commit(input('clarity',defaults.clarity,1,noop.requestKey),actor,now+4),ReplayConflictError);
  db.raw.close();
});

test('identical concurrent no-ops create one receipt and no change audit, scoped by actor',async()=>{
  const {db,store}=setup();const noop=input('google',defaults.google);
  const results=await Promise.all([store.commit(noop,actor,now),store.commit(noop,actor,now)]);
  assert.deepEqual(results[0],results[1]);assert.equal(receiptCount(db),1);assert.equal((await store.read()).google.version,1);assert.deepEqual(await store.audit(),[]);
  assert.equal(await store.update({...noop,values:google},'local-other',now+1),'saved');
  assert.deepEqual(await store.commit(noop,actor,now+2),results[0]);assert.equal((await store.audit()).length,1);
  db.raw.close();
});

test('full receipt storage preserves the 24-hour retry boundary without consuming change history',async()=>{
  const {db,store}=setup();const noop=input('google',defaults.google);
  const first=await store.commit(noop,actor,now);
  for(let index=1;index<receiptLimits.count;index++)await store.commit(input('google',defaults.google),actor,now+1000);
  assert.equal(receiptCount(db),receiptLimits.count);assert.deepEqual(await store.audit(),[]);
  await assert.rejects(store.commit(input('google',defaults.google),actor,now+receiptLimits.windowMs-1),SettingsReceiptCapacityError);
  assert.deepEqual(await store.commit(noop,actor,now+receiptLimits.windowMs-1),first);
  // Changed writes still use their separate history budget, even with all receipt slots occupied.
  assert.equal(await store.update(input('google',google),actor,now+receiptLimits.windowMs-1),'saved');
  assert.equal((await store.audit()).length,1);
  await store.commit(input('google',google,2),actor,now+receiptLimits.windowMs);
  assert.equal(receiptCount(db),receiptLimits.count);assert.equal((await store.audit()).length,1);
  db.raw.close();
});

test('failed receipt insertion has no settings/audit effects and the same key retries once',async()=>{
  const {db,store}=setup();const noop=input('privacy',defaults.privacy);
  db.raw.exec("CREATE TRIGGER synthetic_receipt_failure BEFORE INSERT ON measurement_request_receipts BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
  await assert.rejects(store.commit(noop,actor,now));assert.equal(receiptCount(db),0);assert.equal((await store.read()).privacy.version,1);assert.deepEqual(await store.audit(),[]);
  db.raw.exec('DROP TRIGGER synthetic_receipt_failure');
  const first=await store.commit(noop,actor,now+1);assert.deepEqual(await store.commit(noop,actor,now+2),first);assert.equal(receiptCount(db),1);assert.deepEqual(await store.audit(),[]);db.raw.close();
});

test('migration preserves legacy settings/audit keys and receipts survive database reopen',async()=>{
  const dir=mkdtempSync('.git/settings-receipt-restart-');const path=join(dir,'fixture.sqlite');let db=new SqliteD1(path);
  try{
    db.raw.exec(readFileSync('migrations/0003_measurement_settings.sql','utf8'));
    const changed=input('google',google);const fingerprint=await digest(JSON.stringify({group:changed.group,values:changed.values,version:changed.version}));
    db.raw.prepare('UPDATE measurement_settings SET values_json=?,version=2,updated_at=? WHERE setting_group=?').run(JSON.stringify(google),now,'google');
    db.raw.prepare('INSERT INTO measurement_audit VALUES(?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),actor,'google',2,'["tagId","enabled"]',now,changed.requestKey,fingerprint);
    db.raw.exec(readFileSync('migrations/0004_measurement_request_receipts.sql','utf8'));
    let store=new SettingsStore(db);assert.equal(await store.update(changed,actor,now+1),'duplicate');
    const noop=input('google',google,2);const first=await store.commit(noop,actor,now+2);
    await store.update(input('google',{...google,enabled:false},2),actor,now+3);
    db.raw.close();db=new SqliteD1(path,false);store=new SettingsStore(db);
    assert.deepEqual(await store.commit(noop,actor,now+4),first);assert.equal((await store.read()).google.values.enabled,false);assert.equal((await store.audit()).length,2);assert.equal(receiptCount(db),1);
    await assert.rejects(store.commit({...noop,values:{...google,enabled:false}},actor,now+5),ReplayConflictError);
  }finally{db.raw.close();rmSync(dir,{recursive:true,force:true});}
});

test('legacy changed-write keys cannot be rebound as no-ops under a newer revision',async()=>{
  const {db,store}=setup();const changed=input('google',google);
  assert.equal(await store.update(changed,actor,now),'saved');
  await assert.rejects(store.commit({...changed,version:2},actor,now+1),ReplayConflictError);
  assert.equal(await store.update(changed,actor,now+2),'duplicate');assert.equal(receiptCount(db),0);assert.equal((await store.audit()).length,1);db.raw.close();
});

test('corrupt or oversized cached replies fail closed without leaking rejected data or changing history',async()=>{
  const {db,store}=setup();const noop=input('google',defaults.google);
  const first=await store.commit(noop,actor,now);const body=JSON.parse(first.response!);body.apiKey='sk-synthetic-not-a-real-secret';
  db.raw.prepare('UPDATE measurement_request_receipts SET response_json=?').run(JSON.stringify(body));
  await assert.rejects(store.commit(noop,actor,now+1),error=>error instanceof Error&&!error.message.includes(body.apiKey));
  assert.deepEqual(await store.audit(),[]);
  // Fault-injected historical actor metadata cannot make a retained result exceed its byte budget.
  db.raw.prepare('INSERT INTO measurement_audit VALUES(?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),'x'.repeat(receiptLimits.responseBytes),'clarity',2,'["enabled"]',now,crypto.randomUUID(),'synthetic-fingerprint');
  await assert.rejects(store.commit(input('privacy',defaults.privacy),actor,now+2),SettingsReceiptCapacityError);
  assert.equal(receiptCount(db),1);assert.equal((await store.read()).privacy.version,1);db.raw.close();
});

test('historical no-op replies never control the current public preview or grant consent',async()=>{
  const {db,store}=setup();
  await store.update(input('google',google),actor,now);
  const enabled={...defaults.privacy,previewEnabled:true};await store.update(input('privacy',enabled),actor,now+1);
  const noop=input('privacy',enabled,2);const original=await store.commit(noop,actor,now+2);
  await store.update(input('privacy',defaults.privacy,2),actor,now+3);
  const replay=await store.commit(noop,actor,now+4);assert.deepEqual(replay,original);assert.equal(JSON.parse(replay.response!).settings.privacy.values.previewEnabled,true);
  const html='<html><head></head><body>Synthetic static</body></html>';
  const response=await publicSettingsPreview(new Request('http://127.0.0.1:8788/articles/ai-agent/'),{LOCAL_EDITORIAL_MODE:'synthetic-only',EDITORIAL_DB:db,ASSETS:{fetch:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})}});
  assert.equal(await response.text(),html);assert.equal((await store.read()).privacy.values.analyticsConsent,'denied');assert.equal((await store.read()).advertising.values.enabled,false);db.raw.close();
});
