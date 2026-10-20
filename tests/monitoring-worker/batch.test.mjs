import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import {spawnSupervised,stopSupervised} from '../support/process-supervisor.mjs';

test('actual Worker/D1 receipts survive restart, failed completion and retention pressure', {timeout:300000}, async()=>{
  // Only this dedicated disposable directory is reset. Interactive/editorial browser state is untouched.
  const state=resolve('.git/monitor-command-worker-state');rmSync(state,{recursive:true,force:true});mkdirSync(state,{recursive:true});
  const cli=resolve('node_modules/wrangler/bin/wrangler.js');
  const env={...process.env,XDG_CONFIG_HOME:resolve('.git/runtime-config'),XDG_CACHE_HOME:resolve('.git/runtime-cache'),WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'};
  const common=['--config','wrangler.editorial.local.jsonc','--persist-to',state];
  const log=openSync(resolve(state,'worker.log'),'a');let child;
  const origin='http://127.0.0.1:8788';
  async function start(){
    child=spawnSupervised(process.execPath,[cli,'dev','--local',...common,'--ip','127.0.0.1','--port','8788'],{env,stdio:['ignore',log,log]});
    for(let i=0;i<200;i++){
      if(child.exitCode!==null)throw new Error('Local Worker exited before ready.');
      try{if((await fetch(origin+'/api/editorial/status')).ok)return;}catch{}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    throw new Error('Local Worker did not become ready.');
  }
  async function stop(){
    const current=child;child=undefined;
    if(current.exitCode!==null||current.signalCode!==null)return;
    await stopSupervised(current,'SIGTERM');
  }
  function command(args){
    const result=spawnSync(process.execPath,[cli,...args,...common],{env,encoding:'utf8',timeout:60000});
    assert.equal(result.status,0,'Local D1 command failed; inspect isolated worker state.');return result.stdout;
  }
  const sql=statement=>command(['d1','execute','EDITORIAL_DB','--local','--command',statement]);
  command(['d1','migrations','apply','EDITORIAL_DB','--local']);
  let cookie;let csrf;
  async function signIn(){
    const response=await fetch(origin+'/admin/sign-in/',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'identity=local-editor'});
    assert.equal(response.status,303);cookie=response.headers.get('set-cookie').split(';')[0];
    csrf=(await(await api('session')).json()).csrf;
  }
  const api=(path,options={})=>fetch(origin+'/api/admin/'+path,{...options,headers:{Cookie:cookie,...options.headers}});
  const post=(action,key,extra={})=>api('monitor/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({requestKey:key,...extra})});
  const stateNow=async()=>{const response=await api('monitor/state');assert.equal(response.status,200);return response.json();};
  const ok=async(action,key)=>{const response=await post(action,key);assert.equal(response.status,200);return response.text();};
  try{
    await start();await signIn();
    const scheduleKey=crypto.randomUUID();const scheduled=await ok('schedule',scheduleKey);
    await ok('schedule',crypto.randomUUID());
    const processKey=crypto.randomUUID();const processed=await ok('process',processKey);
    assert.equal((await stateNow()).budget.attempts,4);
    await stop();
    // Inject a local SQLite failure after the job work but before its receipt can complete.
    sql("CREATE TRIGGER synthetic_batch_finish_failure BEFORE UPDATE OF state ON monitor_batch_commands WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
    await start();
    assert.equal(await ok('schedule',scheduleKey),scheduled);
    assert.equal(await ok('process',processKey),processed);
    const crashKey=crypto.randomUUID();assert.equal((await post('process',crashKey)).status,503);
    assert.equal((await stateNow()).budget.attempts,8);
    await stop();sql('DROP TRIGGER synthetic_batch_finish_failure;');await start();
    const recovered=await ok('process',crashKey);
    assert.equal((await stateNow()).budget.attempts,8);
    await stop();await start();
    assert.equal(await ok('process',crashKey),recovered);
    assert.equal(await ok('schedule',scheduleKey),scheduled);
    assert.equal(await ok('process',processKey),processed);
    assert.equal((await post('process',scheduleKey)).status,409);
    const before=await stateNow();assert.equal(before.jobs.length,8);assert.equal(before.budget.attempts,8);
    await stop();
    const time=Date.now();const expires=time+86400000;
    const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({action:'schedule'}))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const fixtureKeys=Array.from({length:124},()=>crypto.randomUUID());
    sql('INSERT INTO monitor_batch_commands(request_key,action,fingerprint,state,result,created_at,expires_at) VALUES '+fixtureKeys.map(key=>`('${key}','schedule','${fingerprint}','complete','{}',${time},${expires})`).join(',')+';');
    await start();
    assert.equal((await post('schedule',crypto.randomUUID())).status,503);
    assert.equal(await ok('schedule',scheduleKey),scheduled);
    assert.deepEqual(await stateNow(),before,'Capacity failure/replay must neither evict a receipt nor alter jobs or reservations.');
    await stop();sql(`UPDATE monitor_batch_commands SET expires_at=${Date.now()-1} WHERE request_key='${fixtureKeys[0]}';`);await start();
    await ok('process',crypto.randomUUID());
    assert.equal(await ok('schedule',scheduleKey),scheduled);
    assert.deepEqual(await stateNow(),before);
    const logout=await fetch(origin+'/admin/sign-out/',{method:'POST',redirect:'manual',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});
    assert.equal(logout.status,303);assert.equal((await api('monitor/state')).status,401);
  }finally{if(child)await stop();closeSync(log);}
});
