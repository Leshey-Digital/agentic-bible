import {writeFileSync,mkdirSync,renameSync,openSync,closeSync,fsyncSync,constants} from 'node:fs';import {dirname} from 'node:path';import {randomUUID} from 'node:crypto';
import {responseJson} from './network.ts';
import {readReleaseFile} from './files.ts';
import {canonical,digest,verifyCandidate,type Candidate} from './artifact.ts';import {releaseTarget} from './public.ts';
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
export type Active={versionId:string;operation:string}|null;
export type Receipt={schemaVersion:1;state:'verified-serving';requestId:string;action:'deploy'|'rollback';candidateDigest:string;qualificationDigest:string;buildId:string;sourceCommit:string;versionId:string;previousVersion:string|null;hasPreviousVersion:boolean;target:typeof releaseTarget;verifiedAssets:number;verifiedAt:number};
export type Permit={ownerEnabled:true;environment:'staging';repository:'Leshey-Digital/agentic-bible';sourceCommit:string;qualificationDigest:string;reviewedQualificationDigest:string;exclusiveWriter:true;candidateDigest:string;requestId:string;expectedActive:string|null;action:'deploy'|'rollback';priorReceipt?:Receipt};
export type Ports={active:()=>Promise<Active>;version:(id:string)=>Promise<{versionId:string;candidateDigest:string}>;findVersion:(candidateDigest:string,requestId:string,selected?:string)=>Promise<string|null>;upload:(root:string,candidateDigest:string,requestId:string)=>Promise<string>;activate:(versionId:string,operation:string)=>Promise<void>;read:(path:string)=>Promise<Response>;assertSource:()=>Promise<void>};
function permit(candidate:Candidate,id:string,p:Permit){
 if(p.ownerEnabled!==true||p.environment!=='staging'||p.repository!=='Leshey-Digital/agentic-bible'||!/^[a-f0-9]{64}$/.test(p.qualificationDigest??'')||p.reviewedQualificationDigest!==p.qualificationDigest||p.exclusiveWriter!==true||p.sourceCommit!==candidate.sourceCommit||p.candidateDigest!==id||!uuid(p.requestId)||(p.expectedActive!==null&&!uuid(p.expectedActive))||!['deploy','rollback'].includes(p.action))throw Error('release_owner_and_reviewed_local_qualification_required');
 if(p.action==='rollback'){const r=p.priorReceipt;if(!r||r.state!=='verified-serving'||r.candidateDigest!==id||r.qualificationDigest!==p.qualificationDigest||r.sourceCommit!==candidate.sourceCommit||r.buildId!==candidate.buildId||canonical(r.target)!==canonical(releaseTarget)||!uuid(r.versionId)||r.versionId===p.expectedActive)throw Error('release_verified_prior_receipt_required');}
}
export function publicPath(path:string,buildId:string){return path==='index.html'?'/':path==='404.html'?'/__release_missing_'+buildId.slice(0,16)+'/':path.endsWith('/index.html')?'/'+path.slice(0,-10):'/'+path;}
export async function verifyServing(root:string,ports:Pick<Ports,'read'>){
 const {candidate}=verifyCandidate(root);let count=0;const started=Date.now();
 for(const [path,file]of Object.entries(candidate.assets)){
   if(path==='_headers'||path==='_redirects')continue;if(Date.now()-started>120000)throw Error('release_verification_deadline');
   const response=await ports.read(publicPath(path,candidate.buildId));if(response.status!==(path==='404.html'?404:200)||response.redirected||!response.headers.get('x-robots-tag')?.includes('noindex'))throw Error('release_served_status_or_policy');
   const reader=response.body?.getReader();if(!reader)throw Error('release_served_body');let total=0;const chunks:Uint8Array[]=[];
   try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>file.bytes){void reader.cancel();throw Error('release_served_capacity');}chunks.push(part.value);}}finally{reader.releaseLock();}
   if(total!==file.bytes||digest(Buffer.concat(chunks))!==file.sha256)throw Error('release_served_bytes_changed');count++;
 }
 const response=await ports.read('/api/runtime/status'),status=await responseJson(response,4096);if(response.status!==200||status.releaseCommit!==candidate.sourceCommit||status.releaseManifestVerified!==true||status.releaseManifestSha256!==candidate.manifestSha256||status.releaseBuildId!==candidate.buildId||status.releaseVerified!==false||status.publicIntake!==false||status.gitHubProposalsConfigured!==false||status.hostedCanonicalWrites!==false)throw Error('release_runtime_binding_or_closed_policy');
 return count;
}
export async function executeRelease(root:string,p:Permit,ports:Ports,journalPath:string):Promise<Receipt>{
 const {candidate,id}=verifyCandidate(root,p.candidateDigest);permit(candidate,id,p);const operation='ab-release:'+p.requestId+':'+id,scope=digest(canonical(p));let journal:any;
 try{journal=JSON.parse(readReleaseFile(journalPath,65536).toString('utf8'));if(journal.scope!==scope)throw Error('release_journal_conflict');}catch(error:any){if(error.code!=='ENOENT')throw error;journal={schemaVersion:1,scope,requestId:p.requestId,state:'planned',versionId:null,uploadAttempts:0};}
 if(journal.state==='verified'){const r=journal.receipt;if(!r||r.candidateDigest!==id||r.qualificationDigest!==p.qualificationDigest||r.requestId!==p.requestId||r.action!==p.action||r.sourceCommit!==candidate.sourceCommit||r.buildId!==candidate.buildId||r.previousVersion!==p.expectedActive||!uuid(r.versionId)||!Number.isSafeInteger(r.verifiedAt)||canonical(r.target)!==canonical(releaseTarget))throw Error('release_journal_receipt_corrupt');return r;}
 function save(){mkdirSync(dirname(journalPath),{recursive:true});const temp=journalPath+'.'+randomUUID()+'.tmp',fd=openSync(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,canonical(journal));fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,journalPath);const parent=openSync(dirname(journalPath),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(parent);}finally{closeSync(parent);}}save();
 const active=await ports.active();if(active?.versionId!==p.expectedActive&&!(active===null&&p.expectedActive===null)&&active?.operation!==operation)throw Error('release_active_changed');
 if(p.action==='deploy'&&journal.versionId&&active?.operation===operation&&journal.versionId!==active.versionId)throw Error('release_version_selection_conflict');
 let versionId=p.action==='rollback'?p.priorReceipt!.versionId:await ports.findVersion(id,p.requestId,journal.versionId??(active?.operation===operation?active.versionId:undefined));
 if(!versionId){await ports.assertSource();if(journal.uploadAttempts>=2)throw Error('release_upload_attempt_limit');journal.uploadAttempts++;journal.state='upload-pending';save();const uploaded=await ports.upload(root,id,p.requestId);versionId=await ports.findVersion(id,p.requestId,uploaded);}
 if(!uuid(versionId)||(await ports.version(versionId)).candidateDigest!==id)throw Error('release_version_binding');journal.versionId=versionId;journal.state='uploaded';save();
 const current=await ports.active();
 if(current?.versionId!==versionId||current.operation!==operation){
   if(current?.versionId!==p.expectedActive&&!(current===null&&p.expectedActive===null))throw Error('release_active_changed');
   if(p.action==='deploy')await ports.assertSource();verifyCandidate(root,id);journal.state='activation-pending';save();await ports.activate(versionId,operation);
 }
 const after=await ports.active();if(after?.versionId!==versionId||after.operation!==operation)throw Error('release_activation_unconfirmed');
 journal.state='verifying';save();const verifiedAssets=await verifyServing(root,ports);const final=await ports.active();if(final?.versionId!==versionId||final.operation!==operation)throw Error('release_active_changed_during_verification');
 const receipt:Receipt={schemaVersion:1,state:'verified-serving',requestId:p.requestId,action:p.action,candidateDigest:id,qualificationDigest:p.qualificationDigest,buildId:candidate.buildId,sourceCommit:candidate.sourceCommit,versionId,previousVersion:p.expectedActive,hasPreviousVersion:p.expectedActive!==null&&p.expectedActive!==versionId,target:releaseTarget,verifiedAssets,verifiedAt:Date.now()};
 journal.state='verified';journal.receipt=receipt;save();return receipt;
}
