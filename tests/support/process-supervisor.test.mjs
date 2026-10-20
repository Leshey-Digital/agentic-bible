import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,rmSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSupervised,stopSupervised} from './process-supervisor.mjs';

const node=process.execPath;
const workerCode=`if(process.env.SCENARIO==='timeout')process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`;
const childCode=`import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';const worker=spawn(process.execPath,['-e',${JSON.stringify(workerCode)}],{stdio:'ignore'});writeFileSync(process.argv[1],JSON.stringify({parent:process.pid,worker:worker.pid}));if(process.env.SCENARIO==='normal')setTimeout(()=>process.exit(0),100);else if(process.env.SCENARIO==='error')setTimeout(()=>process.exit(17),100);else setInterval(()=>{},1000)`;

async function waitFor(path){
  const deadline=Date.now()+5000;
  while(!existsSync(path)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(existsSync(path),'supervised child wrote its PID receipt');
  return JSON.parse(readFileSync(path,'utf8'));
}
function absent(pid){assert.equal(existsSync('/proc/'+pid),false,'owned PID was fully reaped: '+pid);}
function run(command,args,options={}){return spawnSupervised(command,args,{stdio:'ignore',...options});}

test('Linux test supervisor reaps only its Wrangler-owned subtree on normal completion, timeout and error',
  {skip:process.platform!=='linux',timeout:15000},async()=>{
    const root=mkdtempSync(join(tmpdir(),'ab-supervisor-'));
    let unrelated;const supervisors=[];
    try{
      const unrelatedCode=`process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`;
      unrelated=spawn(node,['-e',unrelatedCode],{stdio:'ignore'});

      for(const scenario of ['normal','timeout','error']){
        const receipt=join(root,scenario+'.json');
        const owned=run(node,['-e',childCode,receipt],{env:{...process.env,SCENARIO:scenario}});
        supervisors.push(owned);
        const pids=await waitFor(receipt);
        if(scenario==='timeout'){const started=Date.now();await stopSupervised(owned);assert.ok(Date.now()-started<5000,'SIGKILL escalation is bounded');}
        else await new Promise((resolve,reject)=>{owned.once('error',reject);owned.once('close',(code,signal)=>resolve({code,signal}));});
        if(scenario==='normal')assert.equal(owned.exitCode,0);
        if(scenario==='timeout')assert.equal(owned.exitCode,143);
        if(scenario==='error')assert.equal(owned.exitCode,17);
        absent(pids.parent);absent(pids.worker);
        assert.equal(unrelated.exitCode,null,'unrelated process remains running');
      }

      const failed=run('/path/that/does/not/exist',[]);supervisors.push(failed);
      const outcome=await new Promise(resolve=>failed.once('close',(code,signal)=>resolve({code,signal})));
      assert.equal(outcome.code,127);
      assert.equal(unrelated.exitCode,null,'spawn error does not affect unrelated process');
    }finally{
      for(const child of supervisors)if(child.exitCode===null&&child.signalCode===null)await stopSupervised(child);
      if(unrelated&&unrelated.exitCode===null&&unrelated.signalCode===null){
        const exited=new Promise(resolve=>unrelated.once('close',resolve));unrelated.kill('SIGTERM');await exited;
      }
      rmSync(root,{recursive:true,force:true});
    }
  });
