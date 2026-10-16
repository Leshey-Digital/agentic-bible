import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn,spawnSync} from 'node:child_process';
import {closeSync,mkdirSync,openSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:net';

async function requireFreePort(){
  const server=createServer();
  await new Promise((resolve,reject)=>{server.once('error',()=>reject(new Error('Port 8788 must be free; refusing to use an existing local Worker.')));server.listen(8788,'127.0.0.1',()=>server.close(resolve));});
}

test('actual Worker/D1 no-op receipts survive restart, failures, capacity and expiry without changing history',{timeout:360_000},async()=>{
  await requireFreePort();
  // Reset only this suite's disposable synthetic DB, never interactive or other suite state.
  const state=resolve('.git/settings-receipt-worker-state');rmSync(state,{recursive:true,force:true});mkdirSync(state,{recursive:true});
  const cli=resolve('node_modules/wrangler/bin/wrangler.js');const common=['--config','wrangler.editorial.local.jsonc','--persist-to',state];
  const env={...process.env,XDG_CONFIG_HOME:resolve('.git/runtime-config'),XDG_CACHE_HOME:resolve('.git/runtime-cache'),WRANGLER_SEND_METRICS:'false'};
  const logPath=resolve(state,'worker.log');const fd=openSync(logPath,'a');const origin='http://127.0.0.1:8788';let child;let cookie;let csrf;
  const command=args=>{const result=spawnSync(process.execPath,[cli,...args,...common],{env,encoding:'utf8',timeout:60_000});assert.equal(result.status,0,'Local D1 command failed');};
  const sql=statement=>{const path=resolve(state,'fixture.sql');writeFileSync(path,statement);command(['d1','execute','EDITORIAL_DB','--local','--file',path]);};
  const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
  async function start(){
    await requireFreePort();
    child=spawn(process.execPath,[cli,'dev','--local',...common,'--ip','127.0.0.1','--port','8788'],{env,stdio:['ignore',fd,fd]});
    for(let i=0;i<200;i++){if(child.exitCode!==null)throw new Error('Local Worker exited');try{if((await fetch(origin+'/api/editorial/status')).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('Worker startup timed out');
  }
  async function stop(){const current=child;child=undefined;if(!current||current.exitCode!==null||current.signalCode!==null)return;const done=new Promise(r=>current.once('exit',r));current.kill('SIGTERM');await done;}
  const api=(path,options={})=>fetch(origin+path,{...options,headers:{Cookie:cookie,...options.headers}});
  const json=async path=>{const response=await api(path);assert.equal(response.status,200);return response.json();};
  const headers=()=>({Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrf});
  const patch=data=>api('/api/admin/settings',{method:'PATCH',headers:headers(),body:JSON.stringify(data)});
  const body=(current,group,values=current.settings[group].values)=>({group,values,version:current.settings[group].version,requestKey:crypto.randomUUID()});
  const get=()=>json('/api/admin/settings');
  const save=async(group,values)=>{const response=await patch(body(await get(),group,values));assert.equal(response.status,200);return response.json();};
  const exactReplay=async(data,raw)=>{const response=await patch(data);assert.equal(response.status,200);assert.equal(await response.text(),raw);};
  command(['d1','migrations','apply','EDITORIAL_DB','--local']);
  try{
    await start();const signed=await fetch(origin+'/admin/sign-in/',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'identity=local-editor'});
    assert.equal(signed.status,303);cookie=signed.headers.get('set-cookie').split(';')[0];csrf=(await json('/api/admin/session')).csrf;
    const submitted=await api('/api/submissions',{method:'POST',headers:headers(),body:JSON.stringify({requestKey:crypto.randomUUID(),articleId:'ai-agent',kind:'correction',message:'Synthetic receipt restart fixture: preserve this editorial record unchanged.',sourceUrl:'',website:''})});assert.equal(submitted.status,201);
    const reference=(await submitted.json()).reference;const inboxBefore=await json('/api/admin/submissions/'+reference);
    const catalog=JSON.parse(readFileSync('dist/source-catalog.json','utf8'));
    assert.equal((await api('/api/admin/monitor/run',{method:'POST',headers:headers(),body:JSON.stringify({sourceId:catalog.sources[0].id,scenario:'baseline',requestKey:crypto.randomUUID()})})).status,200);
    const sourceBefore=await json('/api/admin/monitor/state');
    const first=body(await get(),'google');let response=await patch(first);assert.equal(response.status,200);const firstRaw=await response.text();
    await save('google',{tagId:'GT-RECEIPT77',ga4Id:'',enabled:false});await exactReplay(first,firstRaw);
    assert.equal((await patch({...first,values:{tagId:'GT-REBOUND77',ga4Id:'',enabled:false}})).status,409);
    const second=body(await get(),'clarity');response=await patch(second);assert.equal(response.status,200);const secondRaw=await response.text();
    await save('clarity',{projectId:'synthetic77',enabled:false});const beforeRestart=await get();
    await stop();await start();await exactReplay(first,firstRaw);await exactReplay(second,secondRaw);assert.deepEqual(await get(),beforeRestart);
    assert.deepEqual(await json('/api/admin/submissions/'+reference),inboxBefore);assert.deepEqual(await json('/api/admin/monitor/state'),sourceBefore);
    await stop();sql("CREATE TRIGGER synthetic_receipt_failure BEFORE INSERT ON measurement_request_receipts BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");await start();
    const failed=body(await get(),'privacy');assert.equal((await patch(failed)).status,503);assert.deepEqual(await get(),beforeRestart);
    await stop();sql('DROP TRIGGER synthetic_receipt_failure;');await start();response=await patch(failed);assert.equal(response.status,200);const failedRaw=await response.text();await exactReplay(failed,failedRaw);assert.deepEqual(await get(),beforeRestart);
    const privacy=beforeRestart.settings.privacy.values;await save('privacy',{...privacy,previewEnabled:true});
    const historical=body(await get(),'privacy');response=await patch(historical);assert.equal(response.status,200);const historicalRaw=await response.text();
    await save('privacy',privacy);await exactReplay(historical,historicalRaw);assert.equal(JSON.parse(historicalRaw).settings.privacy.values.previewEnabled,true);
    assert.equal((await(await api('/articles/ai-agent/')).text()).includes('measurement-policy'),false);
    const current=await get();assert.equal(current.audit.length,4);assert.equal(current.trackingEnabled,false);assert.equal(current.adsEnabled,false);
    // Fill the remaining 124 slots with allowlisted synthetic snapshots through local SQL, not app hooks.
    const snapshot=JSON.stringify({...current,result:'unchanged'});const expiry=Date.now()+86_400_000;const dummy=[];
    for(let i=0;i<124;i++)dummy.push(crypto.randomUUID());
    await stop();sql(dummy.map(key=>`INSERT INTO measurement_request_receipts VALUES('local-editor',${quote(key)},${quote('0'.repeat(64))},${quote(snapshot)},${Date.now()},${expiry});`).join('\n'));await start();
    assert.equal((await patch(body(await get(),'advertising'))).status,503);await exactReplay(first,firstRaw);assert.deepEqual(await get(),current);
    await save('google',{tagId:'GT-CAPACITY77',ga4Id:'',enabled:false});const capped=await get();assert.equal(capped.audit.length,5);
    // No unexpired eviction: only an expired receipt frees a slot; successful old keys remain replayable.
    await stop();sql(`UPDATE measurement_request_receipts SET created_at=1,expires_at=${Date.now()-1} WHERE request_key=${quote(dummy[0])};`);await start();
    const afterExpiry=body(await get(),'google');response=await patch(afterExpiry);assert.equal(response.status,200);await exactReplay(afterExpiry,await response.text());await exactReplay(first,firstRaw);assert.deepEqual(await get(),capped);
    await stop();sql("CREATE TRIGGER synthetic_settings_failure BEFORE UPDATE ON measurement_settings BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");await start();
    const changed=body(await get(),'clarity',{projectId:'synthetic88',enabled:false});assert.equal((await patch(changed)).status,503);assert.deepEqual(await get(),capped);
    await stop();sql('DROP TRIGGER synthetic_settings_failure;');await start();assert.equal((await patch(changed)).status,200);assert.equal((await patch(changed)).status,200);
    const final=await get();assert.equal(final.audit.length,6);assert.equal(final.settings.clarity.version,capped.settings.clarity.version+1);assert.equal(JSON.stringify(final.audit).includes('synthetic88'),false);
    assert.deepEqual(await json('/api/admin/submissions/'+reference),inboxBefore);assert.deepEqual(await json('/api/admin/monitor/state'),sourceBefore);
    const secret='sk-synthetic-receipt-rejected';const invalid=await patch(body(final,'google',{tagId:secret,ga4Id:'',enabled:false}));assert.equal(invalid.status,422);assert.equal((await invalid.text()).includes(secret),false);assert.equal(readFileSync(logPath,'utf8').includes(secret),false);
    const logout=await api('/admin/sign-out/',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});assert.equal(logout.status,303);assert.equal((await api('/api/admin/settings')).status,401);
  }finally{await stop();closeSync(fd);}
});
