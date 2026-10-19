import {spawn} from 'node:child_process';

export function spawnProcessGroup(command,args,options={}){
  return spawn(command,args,{...options,detached:true});
}

export function signalProcessGroup(child,signal){
  if(!Number.isInteger(child.pid))return false;
  try{process.kill(-child.pid,signal);return true;}
  catch(error){if(error?.code==='ESRCH')return false;throw error;}
}
