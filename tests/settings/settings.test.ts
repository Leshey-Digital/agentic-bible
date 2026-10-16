import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SqliteD1 } from '../editorial/sqlite.ts';
import { defaults, updateInput, validateValues, type Group } from '../../src/settings/contracts.ts';
import { SettingsStore } from '../../src/settings/store.ts';
import { localSession } from '../../src/editorial/auth.ts';
import { D1EditorialStore } from '../../src/editorial/store.ts';
import worker from '../../src/editorial/worker.ts';
import { eligible, publicSettingsPreview } from '../../src/settings/render.ts';
import { InputError, ReplayConflictError, CapacityError } from '../../src/editorial/validation.ts';

const origin='http://127.0.0.1:8788';
const now=1_792_168_000_000;
function setup(path=':memory:',initialize=true) {
  const db=new SqliteD1(path,initialize);
  if(initialize)db.raw.exec(readFileSync('migrations/0003_measurement_settings.sql','utf8'));
  return {db,store:new SettingsStore(db)};
}
const change=(group:Group,values:unknown,version=1,requestKey=crypto.randomUUID())=>updateInput({group,values,version,requestKey});
const google={tagId:'GT-SYNTHETIC1',ga4Id:'G-TEST000001',enabled:true};
const clarity={projectId:'synthetic01',enabled:true};
const preview={...defaults.privacy,previewEnabled:true};
const assetHtml='<!doctype html><html><head><title>Synthetic reading fixture</title></head><body>Reading</body></html>';
const assets={fetch:async()=>new Response(assetHtml,{headers:{'Content-Type':'text/html; charset=utf-8','ETag':'fixture'}})};

test('defaults are denied/off and malformed, secret, script and unsupported settings are rejected',()=>{
  assert.equal(defaults.privacy.analyticsConsent,'denied');assert.equal(defaults.advertising.enabled,false);
  for(const values of [null,[],{...google,apiKey:'sk-synthetic-private'}, {...google,tagId:'<script>alert(1)</script>'}, {...google,tagId:'GTM-ABC123'}, {...google,tagId:'AW-123456'}, {...google,ga4Id:'G-SHORT'}, {...google,enabled:'true'}, {...google,tagId:'https://example.org/'}, {...google,ga4Id:'G-TEST000001\n'}, {...google,tagId:'',ga4Id:''}])assert.throws(()=>validateValues('google',values),InputError);
  for(const projectId of ['sk-synthetic-private','Bearer secret','a'.repeat(21),'a/b','ABC123',''])assert.throws(()=>validateValues('clarity',{projectId,enabled:true}),InputError);
  for(const values of [{...preview,analyticsConsent:'granted'},{...preview,adConsent:'granted'},{...preview,respectDnt:false}])assert.throws(()=>validateValues('privacy',values),InputError);
  assert.throws(()=>validateValues('advertising',{enabled:true}),InputError);
  assert.throws(()=>updateInput({...change('google',google),script:'alert(1)'}),InputError);
  for(const version of [0,-1,true,'01','1\n',1.1])assert.throws(()=>change('google',google,version as number),InputError);
  assert.throws(()=>change('google',google,1,crypto.randomUUID()+'\n'),InputError);
});

test('provider sections persist independently; audit contains field names without values',async()=>{
  const {db,store}=setup();
  assert.equal((await store.read()).google.version,1);assert.deepEqual(await store.audit(),[]);
  assert.deepEqual(await Promise.all([store.update(change('google',google),'local-editor',now),store.update(change('clarity',clarity),'local-editor',now+1)]),['saved','saved']);
  const saved=await store.read();assert.deepEqual(saved.google.values,google);assert.deepEqual(saved.clarity.values,clarity);assert.equal(saved.privacy.version,1);
  const audit=await store.audit();assert.equal(audit.length,2);assert.deepEqual(audit[0].fields,['projectId','enabled']);
  const rows=JSON.stringify(db.raw.prepare('SELECT * FROM measurement_audit').all());
  for(const value of [google.tagId,google.ga4Id,clarity.projectId])assert.equal(rows.includes(value),false);
  assert.equal(await store.update(change('google',google,2),'local-editor',now+2),'unchanged');assert.equal((await store.audit()).length,2);db.raw.close();
});

test('same-section races cannot overwrite; exact replay is idempotent and changed replay conflicts',async()=>{
  const {db,store}=setup();const input=change('google',google);
  const result=await Promise.all([store.update(input,'local-editor',now),store.update(input,'local-editor',now)]);assert.deepEqual(result,['saved','duplicate']);
  assert.equal((await store.audit()).length,1);assert.equal(await store.update(input,'local-editor',now),'duplicate');
  await assert.rejects(store.update({...input,values:{...google,tagId:'GT-DIFFERENT1'}},'local-editor',now),ReplayConflictError);
  const races=await Promise.all([store.update(change('google',{...google,tagId:'GT-NEXTONE1'},2),'local-editor',now+1),store.update(change('google',{...google,tagId:'GT-NEXTTWO1'},2),'local-editor',now+1)]);
  assert.equal(races.filter(result=>result==='saved').length,1);assert.equal(races.filter(result=>result==='stale').length,1);assert.equal((await store.read()).google.version,3);assert.equal((await store.audit()).length,2);db.raw.close();
});

test('audit and settings roll back together on storage failure',async()=>{
  const {db,store}=setup();db.raw.exec("CREATE TRIGGER reject_settings BEFORE UPDATE ON measurement_settings BEGIN SELECT RAISE(ABORT,'synthetic fault'); END;");
  await assert.rejects(store.update(change('google',google),'local-editor',now));assert.equal((await store.read()).google.version,1);assert.deepEqual(await store.audit(),[]);db.raw.close();
});

test('local history cap is enforced before writes and recent audit reads are bounded',async()=>{
  const {db,store}=setup();
  const insert=db.raw.prepare('INSERT INTO measurement_audit VALUES(?,?,?,?,?,?,?,?)');
  for(let index=0;index<1000;index++)insert.run(`fixture-${index}`,'local-editor','google',index+2,'["tagId"]',now+index,`fixture-${index}`,'synthetic-fingerprint');
  await assert.rejects(store.update(change('clarity',clarity),'local-editor',now),CapacityError);assert.equal((await store.read()).clarity.version,1);assert.equal((await store.audit()).length,30);db.raw.close();
});

test('local settings and audit survive closing and reopening SQLite',async()=>{
  const dir=mkdtempSync('.git/settings-unit-');const path=join(dir,'settings.sqlite');
  try {const first=setup(path);await first.store.update(change('clarity',clarity),'local-editor',now);first.db.raw.close();const second=setup(path,false);assert.deepEqual((await second.store.read()).clarity.values,clarity);assert.equal((await second.store.audit()).length,1);second.db.raw.close();}finally{rmSync(dir,{recursive:true,force:true});}
});

test('public rendering is disabled by default and only emits an inert allowlisted local policy when opted in',async()=>{
  const {db,store}=setup();const env={ASSETS:assets,EDITORIAL_DB:db,LOCAL_EDITORIAL_MODE:'synthetic-only'};
  await store.update(change('google',google),'local-editor',now);await store.update(change('clarity',clarity),'local-editor',now);
  const request=new Request(origin+'/articles/ai-agent/');assert.equal(await(await publicSettingsPreview(request,env)).text(),assetHtml);
  await store.update(change('privacy',preview),'local-editor',now);
  const response=await publicSettingsPreview(request,env);const html=await response.text();assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('ETag'),null);
  assert.ok(html.includes('<template id="measurement-policy">'));assert.ok(html.includes(google.tagId));assert.ok(html.includes('trackingEnabled&quot;:false'));assert.ok(html.includes('denied'));assert.equal(html.includes('<script'),false);assert.equal(html.includes('https://'),false);assert.equal(html.includes('local-editor'),false);db.raw.close();
});

test('private/forms/search/query/errors and privacy preference requests never expose policy identifiers',async()=>{
  const {db,store}=setup();const env={ASSETS:assets,EDITORIAL_DB:db,LOCAL_EDITORIAL_MODE:'synthetic-only'};
  await store.update(change('google',google),'local-editor',now);await store.update(change('privacy',preview),'local-editor',now);
  for(const path of ['/admin/','/admin/settings/','/api/admin/settings','/contribute/','/search/','/articles/ai-agent/?q=private-search','/404.html','/unknown/','/source-catalog.json']){
    const request=new Request(origin+path);assert.equal(eligible(request),false);assert.equal(await(await publicSettingsPreview(request,env)).text(),assetHtml);
  }
  for(const headers of [{DNT:'1'},{'Sec-GPC':'1'}])assert.equal(await(await publicSettingsPreview(new Request(origin+'/',{headers}),env)).text(),assetHtml);
  for(const url of ['https://staging.agenticbible.si/','https://agenticbible.si/'])assert.equal(await(await publicSettingsPreview(new Request(url),env)).text(),assetHtml);
  const errorAssets={fetch:async()=>new Response(assetHtml,{status:404,headers:{'Content-Type':'text/html'}})};
  assert.equal(await(await publicSettingsPreview(new Request(origin+'/'),{...env,ASSETS:errorAssets})).text(),assetHtml);
  db.raw.exec("UPDATE measurement_settings SET values_json='{\"tagId\":\"sk-synthetic-private\",\"ga4Id\":\"\",\"enabled\":true}' WHERE setting_group='google'");
  assert.equal(await(await publicSettingsPreview(new Request(origin+'/'),env)).text(),assetHtml);db.raw.close();
});

test('conditional browser reloads cannot reuse an old static document after preview changes',async()=>{
  const {db,store}=setup();await store.update(change('google',google),'local-editor',now);await store.update(change('privacy',preview),'local-editor',now);
  let requests=0;const conditionalAssets={fetch:async(request:Request)=>{requests++;assert.equal(request.headers.get('If-None-Match'),null);assert.equal(request.headers.get('If-Modified-Since'),null);return assets.fetch();}};
  const env={ASSETS:conditionalAssets,EDITORIAL_DB:db,LOCAL_EDITORIAL_MODE:'synthetic-only'};
  const request=new Request(origin+'/articles/ai-agent/',{headers:{'If-None-Match':'cached-static','If-Modified-Since':'Wed, 01 Jan 2025 00:00:00 GMT'}});
  const enabled=await publicSettingsPreview(request,env);assert.ok((await enabled.text()).includes('measurement-policy'));assert.equal(enabled.headers.get('ETag'),null);
  await store.update(change('privacy',defaults.privacy,2),'local-editor',now+1);
  const disabled=await publicSettingsPreview(request,env);assert.equal(await disabled.text(),assetHtml);assert.equal(disabled.headers.get('Cache-Control'),'private, no-store');assert.equal(requests,2);db.raw.close();
});

test('Worker settings endpoints enforce identity, roles, origin, CSRF and remote fail-closed gates',async()=>{
  const {db}=setup();const env={ASSETS:assets,EDITORIAL_DB:db,LOCAL_EDITORIAL_MODE:'synthetic-only'};const path='/api/admin/settings';
  assert.equal((await worker.fetch(new Request(origin+path),env)).status,401);
  const reader=(await localSession('local-reader',new D1EditorialStore(db)))!;
  assert.equal((await worker.fetch(new Request(origin+path,{headers:{Cookie:reader.cookie}}),env)).status,403);
  const admin=(await localSession('local-editor',new D1EditorialStore(db)))!;
  const input=change('google',google);const headers={Cookie:admin.cookie,Origin:origin,'X-CSRF-Token':admin.session.csrf,'Content-Type':'application/json'};
  for(const extra of [{'X-CSRF-Token':''},{Origin:'https://evil.invalid'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await worker.fetch(new Request(origin+path,{method:'PATCH',headers:{...headers,...extra},body:JSON.stringify(input)}),env)).status,403);
  assert.equal((await worker.fetch(new Request(origin+path,{method:'PATCH',headers,body:JSON.stringify(input)}),env)).status,200);
  for(const remote of ['https://staging.agenticbible.si','https://agenticbible.si'])assert.equal((await worker.fetch(new Request(remote+path,{headers}),env)).status,503);
  assert.equal((await worker.fetch(new Request(origin+path,{method:'DELETE',headers}),env)).status,405);db.raw.close();
});

test('rejected script/credential input is absent from response HTML/JSON, persisted settings and audit',async()=>{
  const {db,store}=setup();const env={ASSETS:assets,EDITORIAL_DB:db,LOCAL_EDITORIAL_MODE:'synthetic-only'};
  const admin=(await localSession('local-editor',new D1EditorialStore(db)))!;
  const secret='sk-synthetic-private-do-not-store';
  const bad={group:'google',values:{...google,tagId:secret,apiKey:secret},version:1,requestKey:crypto.randomUUID()};
  const api=await worker.fetch(new Request(origin+'/api/admin/settings',{method:'PATCH',headers:{Cookie:admin.cookie,Origin:origin,'X-CSRF-Token':admin.session.csrf,'Content-Type':'application/json'},body:JSON.stringify(bad)}),env);
  assert.equal(api.status,422);assert.equal((await api.text()).includes(secret),false);
  const form=new URLSearchParams({group:'google',version:'1',requestKey:crypto.randomUUID(),csrf:admin.session.csrf,tagId:secret,ga4Id:google.ga4Id,enabled:'true'});
  const html=await worker.fetch(new Request(origin+'/admin/settings/',{method:'POST',headers:{Cookie:admin.cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:form}),env);
  assert.equal(html.status,422);assert.equal((await html.text()).includes(secret),false);assert.deepEqual((await store.read()).google.values,defaults.google);assert.deepEqual(await store.audit(),[]);db.raw.close();
});
