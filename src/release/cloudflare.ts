import {execFileSync} from 'node:child_process';import {readFileSync,mkdtempSync,cpSync} from 'node:fs';import {join,dirname,resolve} from 'node:path';import {createRequire} from 'node:module';
import {releaseTarget} from './public.ts';import {verifyCandidate} from './artifact.ts';import type {Ports} from './controller.ts';
import {expectedStagingBindings,expectedStagingSettingsBindings,hasExactBindings} from './bindings.ts';
import {sameLegacyVersion,type LegacyVersionSnapshot} from './legacy-baseline.ts';
const root='https://api.cloudflare.com/client/v4/accounts/'+releaseTarget.account+'/workers/scripts/'+releaseTarget.worker;
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
export function cloudflarePorts(token:string|null,assertSource:()=>Promise<void>,options:{send?:typeof fetch;uploadCommand?:typeof execFileSync;api?:(path:string,body?:unknown)=>Promise<any>;upload?:Ports['upload'];legacyActivate?:Ports['activateLegacy']}={}):Ports{
 if(options.api||options.upload){if(token!==null||!options.api||!options.upload)throw Error('release_connector_transport_required');}else if(typeof token!=='string'||token.length<16||token.length>512||/\s/.test(token))throw Error('release_cloudflare_secret_required');const send=options.send??fetch,command=options.uploadCommand??execFileSync;let calls=0;
 async function api(path:string,body?:unknown){
   if(++calls>16)throw Error('release_provider_request_limit');if(options.api)return options.api(path,body);const response=await send(new Request(root+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(5000)}));
   if(response.status===404&&(path==='/deployments'||path.startsWith('/versions?')))throw Error('release_named_worker_bootstrap_required');if(response.status!==200||response.redirected||Number(response.headers.get('content-length'))>262144)throw Error('release_cloudflare_outcome_unconfirmed');
   const reader=response.body?.getReader();if(!reader)throw Error('release_cloudflare_response');let size=0;const chunks:Uint8Array[]=[];try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>262144){void reader.cancel();throw Error('release_cloudflare_capacity');}chunks.push(part.value);}}finally{reader.releaseLock();}
   const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(value.success!==true)throw Error('release_cloudflare_outcome_unconfirmed');return value.result;
 }
 function annotations(value:any){return value.annotations??value.metadata?.annotations??{};}
 async function versionDetail(id:string){
   if(!uuid(id))throw Error('release_version_id');const value=await api('/versions/'+id),message=annotations(value)['workers/message'];
   if(!hasExactBindings(value.resources?.bindings,expectedStagingBindings))throw Error('release_unreviewed_bindings');
   if(value.id!==id||typeof message!=='string'||!/^ab-candidate:[a-f0-9]{64}:[a-f0-9-]{36}$/.test(message))throw Error('release_foreign_version');
   return {versionId:id,candidateDigest:message.split(':')[1],message};
 }
 async function legacyVersionDetail(id:string):Promise<LegacyVersionSnapshot>{
   if(!uuid(id))throw Error('release_legacy_version_id');const value=await api('/versions/'+id),message=annotations(value)['workers/message'],bindings=value.resources?.bindings;
   const created=value.metadata?.created_on??value.created_on,source=value.metadata?.source??value.source,etag=value.resources?.script?.etag??value.etag;
   if(value.id!==id||!Number.isSafeInteger(value.number)||typeof created!=='string'||typeof source!=='string'||typeof etag!=='string'||(message!==undefined&&message!==null&&message!=='')||!hasExactBindings(bindings,expectedStagingBindings))throw Error('release_legacy_version_unreviewed');
   return {versionId:id,number:value.number,createdOn:created,source,etag,candidateMessage:null,bindings:bindings.map((b:any)=>({name:b.name,type:b.type,...(b.type==='d1'?{id:b.id}:{})}))};
 }
 return {
  assertSource,
  active:async()=>{const result=await api('/deployments'),list=result?.deployments??result;if(!Array.isArray(list)||list.length>100)throw Error('release_deployments_response');if(!list.length)return null;const entry=list[0];if(entry.strategy!=='percentage'||entry.versions?.length!==1||entry.versions[0].percentage!==100)throw Error('release_split_traffic_unsupported');return {versionId:entry.versions[0].version_id,operation:annotations(entry)['workers/message']??''};},
  version:async id=>{const value=await versionDetail(id);return {versionId:value.versionId,candidateDigest:value.candidateDigest};},
  legacyVersion:legacyVersionDetail,
  findVersion:async(id,requestId,selected)=>{
   if(!/^[a-f0-9]{64}$/.test(id)||!uuid(requestId)||(selected!==undefined&&!uuid(selected)))throw Error('release_version_lookup_input');
   const result=await api('/versions?per_page=100'),items=result?.items??result;if(!Array.isArray(items)||items.length>=100)throw Error('release_version_history_boundary');
   const message='ab-candidate:'+id+':'+requestId,found=items.filter(v=>annotations(v)['workers/message']===message).map(v=>v.id);
   // Two journaled upload invocations, each with up to three pinned Wrangler POST attempts.
   // Keep all detail checks within the existing 16-request budget; never choose an unchecked sibling.
   if(found.length>6)throw Error('release_duplicate_version_limit');
   if(found.some(v=>!uuid(v))||new Set(found).size!==found.length)throw Error('release_version_history_conflict');
   for(const versionId of found)if((await versionDetail(versionId)).message!==message)throw Error('release_version_marker_conflict');
   if(selected!==undefined&&!found.includes(selected))throw Error('release_version_selection_missing');
   return selected??found.sort()[0]??null;
  },
  upload:async(directory,id,requestId)=>{verifyCandidate(directory,id);if(options.upload)return options.upload(directory,id,requestId);const settings=await api('/settings');if(!hasExactBindings(settings?.bindings,expectedStagingSettingsBindings))throw Error('release_runtime_bindings_required');const require=createRequire(import.meta.url),cli=join(dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js'),scratch=mkdtempSync(join(resolve(directory),'..','release-upload-')),output=join(scratch,'output.jsonl');cpSync(directory,join(scratch,'candidate'),{recursive:true});
    try{command(process.execPath,[cli,'versions','upload','--config',join(scratch,'candidate/wrangler.json'),'--no-bundle','--tag',id.slice(0,32),'--message','ab-candidate:'+id+':'+requestId],{timeout:90000,maxBuffer:262144,env:{PATH:process.env.PATH,CLOUDFLARE_API_TOKEN:token??undefined,CLOUDFLARE_ACCOUNT_ID:releaseTarget.account,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_OUTPUT_FILE_PATH:output,XDG_CONFIG_HOME:join(scratch,'config'),XDG_CACHE_HOME:join(scratch,'cache')},stdio:['ignore','pipe','pipe']});}catch{throw Error('release_upload_outcome_unconfirmed');}
    const rows=readFileSync(output,'utf8').trim().split('\n').map(line=>JSON.parse(line)),row=rows.find(v=>v.type==='version-upload'&&v.version===1);if(!row||!/^[a-f0-9-]{36}$/.test(row.version_id))throw Error('release_upload_unconfirmed');return row.version_id;},
  activate:async(id,operation)=>{if(!/^[a-f0-9-]{36}$/.test(id)||!/^ab-release:[a-f0-9-]{36}:[a-f0-9]{64}$/.test(operation))throw Error('release_activation_input');await api('/deployments',{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':operation}});},
  activateLegacy:async(id,operation,expectedActive,baseline,baselineDigest)=>{
   const match=/^ab-legacy-rollback:([a-f0-9-]{36}):([a-f0-9]{64})$/.exec(operation);
   if(!uuid(id)||!uuid(expectedActive)||id!==baseline.versionId||!match||match[2]!==baselineDigest||!/^[a-f0-9]{64}$/.test(baselineDigest))throw Error('release_legacy_activation_input');
   if(options.legacyActivate)return options.legacyActivate(id,operation,expectedActive,baseline,baselineDigest);
   const before=await api('/deployments'),list=before?.deployments??before;if(!Array.isArray(list)||!list.length||list[0].strategy!=='percentage'||list[0].versions?.length!==1||list[0].versions[0].percentage!==100||list[0].versions[0].version_id!==expectedActive)throw Error('release_active_changed');
   const fresh=await legacyVersionDetail(id);if(!sameLegacyVersion(fresh,baseline))throw Error('release_legacy_baseline_version_changed');
   await api('/deployments',{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':operation}});
  },
  read:async path=>{if(!path.startsWith('/')||path.includes('?')||path.includes('#')||path.includes('..')||!/^\/[a-zA-Z0-9_./-]*$/.test(path))throw Error('release_read_path');return send(new Request(releaseTarget.origin+path,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(5000)}));},
 };
}
