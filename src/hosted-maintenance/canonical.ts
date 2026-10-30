import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash,qualityFlags,type Publish} from '../publishing/contracts.ts';
import {publicationMarkdown} from '../wiki-bridge/markdown.ts';
import {maintenanceTarget} from '../maintenance-quality/target.ts';
import {WriterOutbox} from '../maintenance-github/outbox.ts';
import {session} from '../maintenance-github/transport.ts';
import {leaves,regular,commit,decodeBlob,qualifiedCanonicalCodeHash,type Entry} from '../maintenance-github/core.ts';
import {repository,branch,sha,digest,blobSha,historyPath,intentInput,assertCanonicalHistoryCapacity,writerLimits,commitMutation,stop,type Intent} from '../maintenance-github/contracts.ts';
import {readSourceBackedAuthority,sourceBackedCommand,type SourceBackedPublicationAuthority} from './authority.ts';
import {nativeMaintenanceRecord,nativeCanonicalReceipt,type NativeProof} from './records.ts';

export type HostedCanonicalOptions={enabled?:boolean;db?:SqlDatabase;expectedBaseCommit?:string;expectedMarkdownHash?:string;baselineMarkdown?:string;qualifiedCodeHash?:string;transport?:{kind:'expected-head-maintenance-http-v1';send:(request:Request)=>Promise<Response>};clock?:()=>number;checkpoint?:(phase:'intent'|'dispatched'|'remote-committed'|'verified')=>void|Promise<void>};
/** Reuses the existing canonical outbox and bounded GitHub session. It creates
 * one expected-head atomic article/history/pointer commit; it cannot deploy.
 * Every source/AI/GitHub dependency is explicit and no credential is acquired. */
export function createHostedCanonicalPublisher(options:HostedCanonicalOptions={}){
 const ready=!!options.db&&sha(options.expectedBaseCommit)&&digest(options.expectedMarkdownHash)&&digest(options.qualifiedCodeHash)&&typeof options.baselineMarkdown==='string'&&Buffer.byteLength(options.baselineMarkdown)<=65536&&hash(options.baselineMarkdown)===options.expectedMarkdownHash&&options.transport?.kind==='expected-head-maintenance-http-v1'&&typeof options.transport.send==='function',state=!ready?'unconfigured' as const:options.enabled===true?'configured' as const:'disabled' as const;
 const db=options.db,expectedBase=options.expectedBaseCommit!,originalHash=options.expectedMarkdownHash!,send=options.transport?.send.bind(options.transport),clock=options.clock??Date.now,checkpoint=options.checkpoint,baseline=options.baselineMarkdown!,codeHash=options.qualifiedCodeHash!;
 return Object.freeze({state,async preflight(articleId:string){
  if(state!=='configured'||!db||!send)stop('hosted_canonical_'+state);const target=maintenanceTarget(articleId);let calls=0;
  const api=session({reserve:async()=>{if(++calls>4)stop('native_preflight_read_limit');}},'native-read-only-preflight','read-only',{send},clock);
  if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==expectedBase)stop('writer_stale_base');const base=commit(await api.request('/git/commits/'+expectedBase),expectedBase),tree=leaves(await api.request('/git/trees/'+base.tree.sha+'?recursive=1'),base.tree.sha);
  if(qualifiedCanonicalCodeHash(tree)!==codeHash)stop('native_unqualified_canonical_code');const entry=regular(tree,target.articlePath),markdown=decodeBlob(await api.request('/git/blobs/'+entry.sha),entry.sha,writerLimits.markdownBytes);if(markdown!==baseline||hash(markdown)!==originalHash)stop('writer_canonical_base_conflict');return {commit:expectedBase,markdownSha256:originalHash,markdown};
 },async publish(value:unknown,authority:SourceBackedPublicationAuthority){
  if(state!=='configured'||!db||!send)stop('hosted_canonical_'+state);
  const command=sourceBackedCommand(value,authority),target=maintenanceTarget(command.article.id),id=command.eventId;
  const proof=await readSourceBackedAuthority(command,authority,db);if(proof.proposal.base.commit!==expectedBase||proof.proposal.base.markdownSha256!==originalHash||proof.proposal.base.revision!==command.baseRevision)stop('native_canonical_base_binding');
  const authorityHash=hash(canonical(proof)),fingerprint=hash(canonical({kind:'source-backed-canonical-v1',command,authorityHash,expectedBase,originalHash})),outbox=new WriterOutbox(db,'quality-gated-v1');
  const now=()=>{const value=clock();if(!Number.isSafeInteger(value)||value<0||value>253402300799999)stop('writer_clock');return value;};
  const claimed=await outbox.claim(id,fingerprint,now()),owner=claimed.owner;let row=claimed.row;
  try{
   let intent!:Intent;
   if(row.state!=='preparing')intent=outbox.intent(row);
   const api=session(outbox,id,owner,{send},now,()=>revalidate());let baseTree:Map<string,Entry>|undefined;
   const treeAt=async(oid:string)=>{const c=commit(await api.request('/git/commits/'+oid),oid);return {commit:c,leaves:leaves(await api.request('/git/trees/'+c.tree.sha+'?recursive=1'),c.tree.sha)};};
   const revalidate=async()=>{const current=await readSourceBackedAuthority(command,authority,db);if(hash(canonical(current))!==authorityHash)stop('native_canonical_authority_changed');};
   if(row.state==='complete'){
    const record=nativeMaintenanceRecord(JSON.parse(intent.files[historyPath(id)]));
    if(!row.receipt||hash(row.receipt)!==row.receipt_hash)stop('writer_receipt_corrupt');const receipt=JSON.parse(row.receipt);
    if(canonical(receipt)!==canonical(nativeCanonicalReceipt(record,receipt.commit))||canonical(intent)!==canonical(projection(command,proof,expectedBase,originalHash,record.previous)))stop('writer_receipt_corrupt');return receipt;
   }
   if(row.state==='preparing'){
    if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==expectedBase)stop('writer_stale_base');
    baseTree=(await treeAt(expectedBase)).leaves;if(qualifiedCanonicalCodeHash(baseTree)!==codeHash)stop('native_unqualified_canonical_code');assertCanonicalHistoryCapacity(baseTree.keys(),64);
    const baseline=decodeBlob(await api.request('/git/blobs/'+regular(baseTree,target.articlePath).sha),regular(baseTree,target.articlePath).sha,writerLimits.markdownBytes);if(hash(baseline)!==originalHash)stop('writer_canonical_base_conflict');
    let previous:null|{eventId:string;revisionId:string;path:string;sha256:string}=null;
    if(command.baseRevision===null){if(baseTree.has(target.pointerPath))stop('writer_previous_revision_conflict');}
    else{
     const bytes=decodeBlob(await api.request('/git/blobs/'+regular(baseTree,target.pointerPath).sha),regular(baseTree,target.pointerPath).sha,8192),pointer=JSON.parse(bytes),prior=await outbox.get(pointer.eventId);
     if(!prior||prior.state!=='complete'||!prior.receipt||hash(prior.receipt)!==prior.receipt_hash)stop('writer_previous_authority_required');
     const old=outbox.intent(prior),record=JSON.parse(old.files[historyPath(pointer.eventId)]),receipt=JSON.parse(prior.receipt);
     if(old.files[target.pointerPath]!==bytes||record.articleId!==command.article.id||record.articleRevision!==command.baseRevision||receipt.articleRevision!==command.baseRevision||receipt.markdownSha256!==originalHash||regular(baseTree,historyPath(pointer.eventId)).sha!==blobSha(old.files[historyPath(pointer.eventId)]))stop('writer_previous_revision_conflict');
     previous={eventId:pointer.eventId,revisionId:command.baseRevision,path:historyPath(pointer.eventId),sha256:hash(old.files[historyPath(pointer.eventId)])};
    }
    if(baseTree.has(historyPath(id)))stop('writer_history_already_exists');intent=projection(command,proof,expectedBase,originalHash,previous);await revalidate();await outbox.prepare(id,owner,intent,now());await checkpoint?.('intent');row=(await outbox.get(id))!;
   }else{
    const record=nativeMaintenanceRecord(JSON.parse(intent.files[historyPath(id)]));if(canonical(intent)!==canonical(projection(command,proof,expectedBase,originalHash,record.previous)))stop('writer_intent_corrupt');
   }
   let oid:string;
   if(row.state==='dispatched'){
    const tip=(await api.request('/git/ref/heads/'+branch))?.object?.sha;if(!sha(tip))stop('writer_ref_rejected');
    const found=await api.request('/commits?sha='+tip+'&path='+encodeURIComponent(historyPath(id))+'&per_page=2');if(!Array.isArray(found)||found.length!==1||!sha(found[0]?.sha))stop('writer_head_conflict_or_unconfirmed');oid=found[0].sha;
   }else{
    await revalidate();if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==expectedBase)stop('writer_stale_base');
    await outbox.dispatch(id,owner,now());await checkpoint?.('dispatched');await revalidate();
    const response=await api.request('',{operationName:'CanonicalMaintenanceCommit',query:commitMutation,variables:{input:{branch:{repositoryNameWithOwner:repository,branchName:branch},expectedHeadOid:expectedBase,clientMutationId:fingerprint,message:{headline:'Automatic maintenance: '+command.article.id,body:'Event: '+id+'\nAuthority: '+authorityHash+'\n'},fileChanges:{additions:Object.entries(intent.files).map(([path,contents])=>({path,contents:Buffer.from(contents).toString('base64')}))}}}});
    if(response?.errors||response?.data?.createCommitOnBranch?.clientMutationId!==fingerprint||!sha(response?.data?.createCommitOnBranch?.commit?.oid))stop('writer_commit_unconfirmed');oid=response.data.createCommitOnBranch.commit.oid;await checkpoint?.('remote-committed');
   }
   const actual=await treeAt(oid);if(actual.commit.parents.length!==1||actual.commit.parents[0].sha!==expectedBase||actual.commit.message.trimEnd()!==('Automatic maintenance: '+command.article.id+'\n\nEvent: '+id+'\nAuthority: '+authorityHash).trimEnd())stop('writer_commit_conflict');
   baseTree??=(await treeAt(expectedBase)).leaves;const expected=new Map(baseTree);
   for(const [path,text]of Object.entries(intent.files)){const entry=regular(actual.leaves,path);if(entry.sha!==blobSha(text)||decodeBlob(await api.request('/git/blobs/'+entry.sha),entry.sha,path===target.articlePath?writerLimits.markdownBytes:32768)!==text)stop('writer_blob_conflict');expected.set(path,{path,type:'blob',mode:'100644',sha:blobSha(text)});}
   const inventory=(tree:Map<string,Entry>)=>canonical([...tree.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')));
   if(inventory(actual.leaves)!==inventory(expected))stop('writer_unrelated_files_changed');
   const tip=(await api.request('/git/ref/heads/'+branch))?.object?.sha;if(!sha(tip))stop('writer_ref_rejected');
   if(tip!==oid){const found=await api.request('/commits?sha='+tip+'&path='+encodeURIComponent(historyPath(id))+'&per_page=2');if(!Array.isArray(found)||found.length!==1||found[0]?.sha!==oid)stop('writer_history_unconfirmed');const current=(await treeAt(tip)).leaves;if(regular(current,historyPath(id)).sha!==blobSha(intent.files[historyPath(id)]))stop('writer_history_unconfirmed');}
   if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==tip)stop('writer_tip_changed_after_verification');
   const record=nativeMaintenanceRecord(JSON.parse(intent.files[historyPath(id)])),receipt=nativeCanonicalReceipt(record,oid);await checkpoint?.('verified');await outbox.complete(id,owner,receipt,now());return receipt;
  }finally{await outbox.release(id,owner);}
 }});
}
function projection(command:Publish,proof:NativeProof,expectedBase:string,originalHash:string,previous:NativeMaintenanceRecordPrevious):Intent{
 const target=maintenanceTarget(command.article.id),articleRevision=hash(canonical(command.article)),authorityHash=hash(canonical(proof)),formatted=publicationMarkdown(command.article,{id:authorityHash,manifestHash:authorityHash},proof.bindings),flags=qualityFlags(command.article);
 const front={...formatted.front,status:'Published source-backed maintenance',author:'AI-assisted sourced maintenance',publication:{schemaVersion:2,revisionId:articleRevision,sourceBacked:{qualityReceiptHash:hash(canonical(proof.quality)),generationEventId:proof.proposal.generation.eventId},flags,evidence:formatted.front.publication.evidence}};
 const markdown='---\n'+Object.entries(front).map(([key,value])=>key+': '+JSON.stringify(value)).join('\n')+'\n---\n\n'+formatted.body+'\n';
 const record=nativeMaintenanceRecord({schemaVersion:3,kind:'source-backed-automatic-maintenance-revision',eventId:command.eventId,articleId:command.article.id,articleRevision,previous,expectedBaseCommit:expectedBase,originalMarkdownSha256:originalHash,markdownSha256:hash(markdown),authorityHash,sourceBindings:proof.bindings,evidenceHash:hash(canonical(proof.bindings)),proposal:proof.proposal,quality:proof.quality,flags});
 const recordBytes=canonical(record),pointer=canonical({schemaVersion:command.article.id==='tool-use'?1:2,...(command.article.id==='tool-use'?{}:{articleId:command.article.id}),kind:'source-backed-maintenance-head',eventId:command.eventId,articleRevision,markdownSha256:hash(markdown),recordPath:historyPath(command.eventId),recordSha256:hash(recordBytes),flags});
 return intentInput({schemaVersion:2,articleId:command.article.id,expectedBase,previousEvent:previous?.eventId??null,files:{[target.articlePath]:markdown,[target.pointerPath]:pointer,[historyPath(command.eventId)]:recordBytes}},command.eventId);
}
type NativeMaintenanceRecordPrevious=import('./records.ts').NativeMaintenanceRecord['previous'];
export type HostedCanonicalPublisher=ReturnType<typeof createHostedCanonicalPublisher>;
