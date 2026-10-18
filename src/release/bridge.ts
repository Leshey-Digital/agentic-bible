import {readFileSync,writeFileSync,mkdirSync,lstatSync,existsSync,openSync,closeSync,fstatSync,constants,renameSync} from 'node:fs';import {join,resolve,dirname} from 'node:path';import {randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {canonical,digest,verifyCandidate} from './artifact.ts';import {durableJson} from './qualification.ts';import {cloudflarePorts} from './cloudflare.ts';import {uploadConnectorCode,controlConnectorCode} from './capsule.ts';
function regular(path:string,max:number){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size>max)throw Error('release_bridge_file');return readFileSync(fd,'utf8');}finally{closeSync(fd);}}
const processStart=(pid:number)=>readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1].split(' ')[19];
export function inspectBridgeRequest(path:string,expected:string,allowRecordedResponse=false){
 const raw=regular(path,8192);if(digest(raw)!==expected)throw Error('release_bridge_request_digest');const request=JSON.parse(raw),lease=JSON.parse(regular(join(dirname(path),'lease.json'),8192));
 if(request.schemaVersion!==1||request.expiresAt<Date.now()||lease.nonce!==request.nonce||lease.pid!==request.pid||lease.start!==request.start)throw Error('release_bridge_stale_request');
 try{process.kill(request.pid,0);if(processStart(request.pid)!==request.start)throw Error();}catch{throw Error('release_bridge_dead_request');}
 if(!allowRecordedResponse&&existsSync(request.responsePath))throw Error('release_bridge_response_already_recorded');
 const code=regular(request.codePath,2*1024*1024);if(digest(code)!==request.codeSha256)throw Error('release_bridge_code_changed');return {request,code};
}
export function connectorBridge(repo:string,directory:string,sourceCommit:string,expectedActive:string|null,options:{read?:typeof fetch;onRequest?:(message:{requestPath:string;requestDigest:string})=>void}={}){
 const git=execFileSync('git',['-C',repo,'rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();directory=resolve(directory);if(!directory.startsWith(git+'/'))throw Error('release_bridge_owned_directory');
 let cursor=git;for(const part of directory.slice(git.length+1).split('/')){cursor=join(cursor,part);if(!existsSync(cursor))mkdirSync(cursor,{mode:0o700});const stat=lstatSync(cursor);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('release_bridge_unsafe_directory');}
 let requests=0;
 async function exchange(code:string,kind:string){
  if(++requests>24)throw Error('release_bridge_request_limit');const nonce=randomUUID(),codePath=join(directory,nonce+'.code.js'),requestPath=join(directory,nonce+'.request.json'),responsePath=join(directory,nonce+'.response.json');
  writeFileSync(codePath,code,{flag:'wx',mode:0o600});const request={schemaVersion:1,nonce,kind,pid:process.pid,start:processStart(process.pid),sourceCommit,codePath,codeSha256:digest(code),responsePath,expiresAt:Date.now()+120000};durableJson(requestPath,request);const lease=join(directory,nonce+'.lease.tmp');durableJson(lease,{nonce,pid:request.pid,start:request.start});renameSync(lease,join(directory,'lease.json'));const requestDigest=digest(canonical(request));
  console.log(JSON.stringify({state:'connector-request',requestPath,requestDigest,codeBytes:Buffer.byteLength(code),kind}));
  options.onRequest?.({requestPath,requestDigest});
  while(Date.now()<request.expiresAt){inspectBridgeRequest(requestPath,requestDigest,true);if(existsSync(responsePath)){const reply=JSON.parse(regular(responsePath,262144));if(reply.requestDigest!==requestDigest||reply.nonce!==nonce)throw Error('release_bridge_response_mismatch');if(/^release_[a-z_]+$/.test(reply.result?.error??''))throw Error(reply.result.error);return reply.result;}await new Promise(done=>setTimeout(done,250));}
  throw Error('release_bridge_outcome_unconfirmed');
 }
 const assertSource=async()=>{const output=execFileSync('git',['-c','credential.helper=','ls-remote','https://github.com/Leshey-Digital/agentic-bible.git','refs/heads/main'],{encoding:'utf8',timeout:10000,maxBuffer:4096,env:{PATH:process.env.PATH,GIT_TERMINAL_PROMPT:'0'}}).trim();if(output!==sourceCommit+'\trefs/heads/main')throw Error('release_main_changed');};
 return cloudflarePorts(null,assertSource,{send:options.read,api:async(path,body)=>{const r=await exchange(controlConnectorCode(path,body,expectedActive),'control');if(r?.success!==true||r.status!==200)throw Error('release_connector_outcome_unconfirmed');return r.result;},upload:async(root,id,requestId)=>{if(verifyCandidate(root,id).candidate.sourceCommit!==sourceCommit)throw Error('release_bridge_source_mismatch');const r=await exchange(uploadConnectorCode(root,id,requestId,expectedActive),'upload');if(r?.candidateDigest!==id||r.requestId!==requestId||!/^[a-f0-9-]{36}$/.test(r.versionId))throw Error('release_upload_unconfirmed');return r.versionId;}});
}
