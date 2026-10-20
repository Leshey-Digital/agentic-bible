import {readFileSync,writeFileSync,mkdirSync,lstatSync,existsSync,renameSync} from 'node:fs';import {join,resolve,dirname} from 'node:path';import {randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {canonical,digest,verifyCandidate} from './artifact.ts';import {durableJson} from './qualification.ts';import {cloudflarePorts} from './cloudflare.ts';import {uploadConnectorCode,controlConnectorCode} from './capsule.ts';
import {readReleaseFile} from './files.ts';
const regular=(path:string,max:number)=>readReleaseFile(path,max).toString('utf8');
const processStart=(pid:number)=>readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1].split(' ')[19];
// Preserve this executor's existing network route without inheriting application
// credentials or configuring persistent Git credentials/proxy settings.
function sourceReadEnvironment(){const env:NodeJS.ProcessEnv={PATH:process.env.PATH,GIT_TERMINAL_PROMPT:'0'};for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'])if(process.env[key]!==undefined)env[key]=process.env[key];return env;}
export function inspectBridgeRequest(path:string,expected:string,allowRecordedResponse=false){
 const raw=regular(path,8192);if(digest(raw)!==expected)throw Error('release_bridge_request_digest');const request=JSON.parse(raw),lease=JSON.parse(regular(join(dirname(path),'lease.json'),8192));
 if(request.schemaVersion!==1||request.expiresAt<Date.now()||lease.nonce!==request.nonce||lease.pid!==request.pid||lease.start!==request.start)throw Error('release_bridge_stale_request');
 try{process.kill(request.pid,0);if(processStart(request.pid)!==request.start)throw Error();}catch{throw Error('release_bridge_dead_request');}
 if(!allowRecordedResponse&&existsSync(request.responsePath))throw Error('release_bridge_response_already_recorded');
 const code=regular(request.codePath,2*1024*1024);if(digest(code)!==request.codeSha256)throw Error('release_bridge_code_changed');return {request,code};
}
export function recordBridgeResponse(path:string,expected:string,result:unknown){
 const {request}=inspectBridgeRequest(path,expected);let nodes=0;
 const r=result as any,keys=Object.keys(r??{}).sort().join(','),uuid=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
 if(r?.error!==undefined){if(keys!=='error'||!/^release_[a-z_]{1,100}$/.test(r.error))throw Error('release_bridge_unsanitized_response');}
 else if(request.kind==='upload'){if(keys!=='candidateDigest,requestId,versionId'||!uuid(r.versionId)||r.candidateDigest!==request.candidateDigest||r.requestId!==request.operationRequestId)throw Error('release_bridge_response_mismatch');}
 else if(request.kind!=='control'||keys!=='result,status,success'||!Number.isSafeInteger(r.status)||typeof r.success!=='boolean'||!r.result||typeof r.result!=='object')throw Error('release_bridge_unsanitized_response');
 const allowed=new Set(['status','success','result','id','number','created_on','source','etag','strategy','versions','version_id','percentage','annotations','workers/message','resources','bindings','name','type','items','deployments','versionId','candidateDigest','requestId','error']);
 const inspect=(value:any,depth=0)=>{if(++nodes>4096||depth>12)throw Error('release_bridge_response_capacity');if(value&&typeof value==='object'){if(Array.isArray(value)){for(const x of value)inspect(x,depth+1);}else for(const [key,x]of Object.entries(value)){if(!allowed.has(key))throw Error('release_bridge_unsanitized_response');if(key==='workers/message'&&x!==''&&!/^(ab-candidate:[a-f0-9]{64}:[a-f0-9-]{36}|ab-release:[a-f0-9-]{36}:[a-f0-9]{64}|ab-legacy-rollback:[a-f0-9-]{36}:[a-f0-9]{64})$/.test(String(x)))throw Error('release_bridge_unsanitized_response');inspect(x,depth+1);}}};inspect(result);
 const reply={nonce:request.nonce,requestDigest:expected,result};if(Buffer.byteLength(canonical(reply))>262144)throw Error('release_bridge_response_capacity');const temp=request.responsePath+'.'+randomUUID()+'.tmp';durableJson(temp,reply);renameSync(temp,request.responsePath);
}
export function connectorBridge(repo:string,directory:string,sourceCommit:string,expectedActive:string|null,options:{read?:typeof fetch;qualificationDigest?:string;onRequest?:(message:{requestPath:string;requestDigest:string})=>void}={}){
 const git=execFileSync('git',['-C',repo,'rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();directory=resolve(directory);if(!directory.startsWith(git+'/'))throw Error('release_bridge_owned_directory');
 let cursor=git;for(const part of directory.slice(git.length+1).split('/')){cursor=join(cursor,part);if(!existsSync(cursor))mkdirSync(cursor,{mode:0o700});const stat=lstatSync(cursor);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('release_bridge_unsafe_directory');}
 let requests=0;
 async function exchange(code:string,kind:string,detail?:{candidateDigest:string;operationRequestId:string}){
  if(++requests>24)throw Error('release_bridge_request_limit');const nonce=randomUUID(),codePath=join(directory,nonce+'.code.js'),requestPath=join(directory,nonce+'.request.json'),responsePath=join(directory,nonce+'.response.json');
  writeFileSync(codePath,code,{flag:'wx',mode:0o600});const request={schemaVersion:1,nonce,kind,pid:process.pid,start:processStart(process.pid),sourceCommit,qualificationDigest:options.qualificationDigest,...detail,codePath,codeSha256:digest(code),responsePath,expiresAt:Date.now()+120000};durableJson(requestPath,request);const lease=join(directory,nonce+'.lease.tmp');durableJson(lease,{nonce,pid:request.pid,start:request.start});renameSync(lease,join(directory,'lease.json'));const requestDigest=digest(canonical(request));
  console.log(JSON.stringify({state:'connector-request',requestPath,requestDigest,codeBytes:Buffer.byteLength(code),kind}));
  options.onRequest?.({requestPath,requestDigest});
  while(Date.now()<request.expiresAt){inspectBridgeRequest(requestPath,requestDigest,true);if(existsSync(responsePath)){const reply=JSON.parse(regular(responsePath,262144));if(reply.requestDigest!==requestDigest||reply.nonce!==nonce)throw Error('release_bridge_response_mismatch');if(/^release_[a-z_]+$/.test(reply.result?.error??''))throw Error(reply.result.error);return reply.result;}await new Promise(done=>setTimeout(done,250));}
  throw Error('release_bridge_outcome_unconfirmed');
 }
 const assertSource=async()=>{const output=execFileSync('git',['-c','credential.helper=','ls-remote','https://github.com/Leshey-Digital/agentic-bible.git','refs/heads/main'],{encoding:'utf8',timeout:10000,maxBuffer:4096,env:sourceReadEnvironment()}).trim();if(output!==sourceCommit+'\trefs/heads/main')throw Error('release_main_changed');};
 return cloudflarePorts(null,assertSource,{send:options.read,api:async(path,body)=>{const r=await exchange(controlConnectorCode(path,body,expectedActive),'control');if(r?.success!==true||r.status!==200)throw Error('release_connector_outcome_unconfirmed');return r.result;},legacyActivate:async(versionId,operation,active,baseline,baselineDigest)=>{const body={strategy:'percentage',versions:[{version_id:versionId,percentage:100}],annotations:{'workers/message':operation}},guard={baselineDigest,version:baseline};const r=await exchange(controlConnectorCode('/deployments',body,active,guard),'control');if(r?.success!==true||r.status!==200)throw Error('release_connector_outcome_unconfirmed');},upload:async(root,id,requestId)=>{if(verifyCandidate(root,id).candidate.sourceCommit!==sourceCommit)throw Error('release_bridge_source_mismatch');const r=await exchange(uploadConnectorCode(root,id,requestId,expectedActive),'upload',{candidateDigest:id,operationRequestId:requestId});if(r?.candidateDigest!==id||r.requestId!==requestId||!/^[a-f0-9-]{36}$/.test(r.versionId))throw Error('release_upload_unconfirmed');return r.versionId;}});
}
