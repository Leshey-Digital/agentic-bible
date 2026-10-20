import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const directory=dirname(fileURLToPath(import.meta.url));
const supervisor=join(directory,'process-supervisor.py');

// Wrangler and Miniflare keep workerd in this child session; daemonizing descendants
// are outside this helper's scope. Linux subreaper mode adopts/reaps owned orphans.
export function spawnSupervised(command,args,options={}){
  if(process.platform==='linux')return spawn('python3',[supervisor,'--parent-pid',String(process.pid),'--',command,...args],options);
  return spawn(command,args,options);
}

export async function stopSupervised(child,signal='SIGTERM'){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  const closed=new Promise(resolve=>child.once('close',resolve));
  child.kill(signal);
  await closed;
}
