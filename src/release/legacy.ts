import {writeFileSync,mkdirSync,renameSync,openSync,closeSync,fsyncSync,constants} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {responseJson} from './network.ts';
import {readReleaseFile} from './files.ts';
import {canonical,digest,verifyCandidate,type Candidate} from './artifact.ts';
import {releaseTarget} from './public.ts';
import {sameLegacyVersion,validateLegacyBaseline,type LegacyBaseline} from './legacy-baseline.ts';
import {publicPath,type Ports} from './controller.ts';

const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const operationFor=(requestId:string,baselineDigest:string)=>'ab-legacy-rollback:'+requestId+':'+baselineDigest;
export type LegacyRollbackPermit={ownerEnabled:true;exclusiveWriter:true;requestId:string;expectedActive:string};
export type LegacyRollbackReview={decision:'accepted';sourceCommit:string;candidateDigest:string;qualificationDigest:string;legacyBaselineDigest:string};
export type LegacyRollbackRecord={schemaVersion:1;state:'legacy-baseline-restored';action:'rollback-legacy';requestId:string;legacyBaselineDigest:string;candidateDigest:string;qualificationDigest:string;sourceCommit:string;activeVersion:string;versionId:string;target:typeof releaseTarget;verifiedAssets:number;verifiedAt:number};

export async function verifyLegacyServing(baseline:LegacyBaseline,ports:Pick<Ports,'read'>){
 const {runtime,assets}=baseline;let count=0;const started=Date.now();
 for(const [path,file]of Object.entries(assets)){
  if(Date.now()-started>120000)throw Error('release_legacy_verification_deadline');
  const response=await ports.read(publicPath(path,runtime.releaseBuildId));
  if(response.status!==(path==='404.html'?404:200)||response.redirected||!response.headers.get('x-robots-tag')?.includes('noindex'))throw Error('release_legacy_served_status_or_policy');
  const reader=response.body?.getReader();if(!reader)throw Error('release_legacy_served_body');let total=0;const chunks:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>file.bytes){void reader.cancel();throw Error('release_legacy_served_capacity');}chunks.push(part.value);}}finally{reader.releaseLock();}
  if(total!==file.bytes||digest(Buffer.concat(chunks))!==file.sha256)throw Error('release_legacy_served_bytes_changed');count++;
 }
 const response=await ports.read('/api/runtime/status'),actual=await responseJson(response,4096),{status:expectedStatus,...expectedRuntime}=runtime;
 if(response.status!==expectedStatus||canonical(actual)!==canonical(expectedRuntime))throw Error('release_legacy_runtime_changed');
 return count;
}

function writeJournal(path:string,journal:any){
 mkdirSync(dirname(path),{recursive:true});const temp=path+'.'+randomUUID()+'.tmp',fd=openSync(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{writeFileSync(fd,canonical(journal));fsyncSync(fd);}finally{closeSync(fd);}
 renameSync(temp,path);const parent=openSync(dirname(path),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(parent);}finally{closeSync(parent);}
}

function legacyPermit(candidate:Candidate,id:string,permit:LegacyRollbackPermit,review:LegacyRollbackReview,baseline:LegacyBaseline,baselineDigest:string){
 if(permit.ownerEnabled!==true||permit.exclusiveWriter!==true||!uuid(permit.requestId)||!uuid(permit.expectedActive)||review.decision!=='accepted'||review.sourceCommit!==candidate.sourceCommit||review.candidateDigest!==id||review.legacyBaselineDigest!==baselineDigest||baselineDigest!==digest(canonical(baseline))||canonical(baseline.target)!==canonical(releaseTarget))throw Error('release_owner_review_and_legacy_baseline_required');
}

export async function executeLegacyRollback(root:string,baselineInput:unknown,baselineDigest:string,review:LegacyRollbackReview,permit:LegacyRollbackPermit,ports:Ports,journalPath:string):Promise<LegacyRollbackRecord>{
 const {candidate,id}=verifyCandidate(root,review.candidateDigest),baseline=validateLegacyBaseline(baselineInput);legacyPermit(candidate,id,permit,review,baseline,baselineDigest);
 if(!ports.legacyVersion||!ports.activateLegacy)throw Error('release_legacy_rollback_transport_required');
 const operation=operationFor(permit.requestId,baselineDigest),scope=digest(canonical({action:'rollback-legacy',requestId:permit.requestId,expectedActive:permit.expectedActive,baselineDigest,candidateDigest:id,qualificationDigest:review.qualificationDigest,sourceCommit:candidate.sourceCommit}));
 let journal:any;
 try{journal=JSON.parse(readReleaseFile(journalPath,65536).toString('utf8'));if(journal.scope!==scope||journal.kind!=='legacy-baseline-rollback'||journal.requestId!==permit.requestId)throw Error('release_legacy_journal_conflict');}
 catch(error:any){if(error.code!=='ENOENT')throw error;journal={schemaVersion:1,kind:'legacy-baseline-rollback',scope,requestId:permit.requestId,baselineDigest,expectedActive:permit.expectedActive,state:'planned',versionId:null};}
 const save=()=>writeJournal(journalPath,journal);
 if(journal.state==='verified'){const record=journal.record;if(!record||record.state!=='legacy-baseline-restored'||record.legacyBaselineDigest!==baselineDigest||record.candidateDigest!==id||record.qualificationDigest!==review.qualificationDigest||record.sourceCommit!==candidate.sourceCommit||record.activeVersion!==permit.expectedActive||record.versionId!==baseline.version.versionId||!Number.isSafeInteger(record.verifiedAt)||record.verifiedAssets<1||canonical(record.target)!==canonical(releaseTarget))throw Error('release_legacy_journal_record_corrupt');return record;}
 save();
 const active=await ports.active(),resuming=active?.versionId===baseline.version.versionId&&active.operation===operation;
 if(!resuming&&active?.versionId!==permit.expectedActive)throw Error('release_active_changed');
 if(!resuming){
  const activeMarker=/^ab-release:[a-f0-9-]{36}:([a-f0-9]{64})$/.exec(active?.operation??'');if(!activeMarker)throw Error('release_legacy_active_candidate_required');
  const currentCandidate=await ports.version(permit.expectedActive);if(currentCandidate.versionId!==permit.expectedActive||currentCandidate.candidateDigest!==id||activeMarker[1]!==id)throw Error('release_legacy_active_candidate_mismatch');
 }
 const fresh=await ports.legacyVersion(baseline.version.versionId);if(!sameLegacyVersion(fresh,baseline.version))throw Error('release_legacy_baseline_version_changed');
 if(!resuming){
  journal.versionId=baseline.version.versionId;journal.state='activation-pending';save();
  await ports.activateLegacy(baseline.version.versionId,operation,permit.expectedActive,baseline.version,baselineDigest);
 }
 const after=await ports.active();if(after?.versionId!==baseline.version.versionId||after.operation!==operation)throw Error('release_legacy_activation_unconfirmed');
 journal.state='verifying';save();const verifiedAssets=await verifyLegacyServing(baseline,ports);
 const final=await ports.active();if(final?.versionId!==baseline.version.versionId||final.operation!==operation)throw Error('release_active_changed_during_legacy_verification');
 const record:LegacyRollbackRecord={schemaVersion:1,state:'legacy-baseline-restored',action:'rollback-legacy',requestId:permit.requestId,legacyBaselineDigest:baselineDigest,candidateDigest:id,qualificationDigest:review.qualificationDigest,sourceCommit:candidate.sourceCommit,activeVersion:permit.expectedActive,versionId:baseline.version.versionId,target:releaseTarget,verifiedAssets,verifiedAt:Date.now()};
 journal.state='verified';journal.record=record;save();return record;
}
