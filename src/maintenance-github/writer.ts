import {readMaintenanceBase,type CanonicalBasePort} from '../maintenance-base/read.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import type {WikiBridge} from '../wiki-bridge/store.ts';
import {completedMaintenance} from '../wiki-bridge/maintenance.ts';
import {publicationMarkdown} from '../wiki-bridge/build.ts';
import {projectFiles} from '../wiki-bridge/files.ts';
import {qualityFlags} from '../publishing/contracts.ts';
import {WriterOutbox,type WriterRow} from './outbox.ts';
import {session,type ControlledGitHub} from './transport.ts';
import {repository,branch,articlePath,pointerPath,writerLimits,commitMutation,canonical,hash,sha,digest,event,historyPath,blobSha,intentInput,stop,type Intent,type WriterReceipt} from './contracts.ts';
export {WriterError,writerLimits} from './contracts.ts';
type Authority=Awaited<ReturnType<typeof completedMaintenance>>;
type Selection={schemaVersion:1;mode:'local-synthetic-only';expectedBaseCommit:string;previousRevision:string|null;command:unknown};
type Context={canonicalBase?:CanonicalBasePort;enabled?:boolean;transport?:ControlledGitHub;db:SqlDatabase;bridge:WikiBridge;sourceDirectory:string;policy:unknown;clock?:()=>number;checkpoint?:(phase:'intent'|'dispatched'|'remote-committed'|'verified')=>void|Promise<void>};
type Entry={path:string;type:string;mode:string;sha:string};
function selection(value:unknown):Selection{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='command,expectedBaseCommit,mode,previousRevision,schemaVersion')stop('writer_invalid_selection');const v=value as Selection;
 if(v.schemaVersion!==1||v.mode!=='local-synthetic-only'||!sha(v.expectedBaseCommit)||(v.previousRevision!==null&&!digest(v.previousRevision)))stop('writer_invalid_selection');return v;
}
function leaves(value:any,expected:string):Map<string,Entry>{
 if(value?.sha!==expected||value.truncated!==false||!Array.isArray(value.tree)||value.tree.length>writerLimits.treeEntries)stop('writer_tree_rejected');const result=new Map<string,Entry>(),all=new Set<string>();
 for(const e of value.tree){if(typeof e.path!=='string'||e.path.length>240||!/^[A-Za-z0-9_./\[\]-]+$/.test(e.path)||e.path.split('/').some((p:string)=>!p||p==='.'||p==='..')||!sha(e.sha)||!['tree','blob','commit'].includes(e.type)||!['040000','100644','100755','120000','160000'].includes(e.mode)||all.has(e.path))stop('writer_tree_rejected');if(e.type==='tree'&&e.mode!=='040000'||e.type==='blob'&&!['100644','100755','120000'].includes(e.mode)||e.type==='commit'&&e.mode!=='160000')stop('writer_tree_rejected');all.add(e.path);if(e.type!=='tree')result.set(e.path,e);}
 for(const path of [articlePath,pointerPath,'src/content/maintenance/history/x.json'])for(const e of result.values())if(path.startsWith(e.path+'/'))stop('writer_unsafe_path');return result;
}
function commit(value:any,oid:string){if(value?.sha!==oid||!sha(value.tree?.sha)||!Array.isArray(value.parents)||value.parents.some((p:any)=>!sha(p.sha))||typeof value.message!=='string')stop('writer_commit_rejected');return value;}
function regular(tree:Map<string,Entry>,path:string){const entry=tree.get(path);if(!entry||entry.type!=='blob'||entry.mode!=='100644')stop('writer_regular_file_required');return entry;}
function decodeBlob(value:any,oid:string,max:number){if(value?.sha!==oid||value.encoding!=='base64'||!Number.isSafeInteger(value.size)||value.size<1||value.size>max||typeof value.content!=='string'||value.content.length>max*2)stop('writer_blob_rejected');const encoded=value.content.replace(/\n/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))stop('writer_blob_rejected');const bytes=Buffer.from(encoded,'base64');if(bytes.length!==value.size)stop('writer_blob_rejected');let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return stop('writer_blob_rejected');}if(blobSha(text)!==oid)stop('writer_blob_rejected');return text;}
function message(id:string,authorityHash:string){return 'Automatic maintenance: tool-use\n\nEvent: '+id+'\nAuthority: '+authorityHash+'\n';}
function cachedReceipt(row:WriterRow,authorityHash:string,intent:Intent,authority:Authority):WriterReceipt{
 if(!row.receipt||hash(row.receipt)!==row.receipt_hash)stop('writer_receipt_corrupt');let r;try{r=JSON.parse(row.receipt);}catch{return stop('writer_receipt_corrupt');}
 const expected={schemaVersion:1,mode:'local-synthetic-only',state:'canonical-commit-verified',livePublished:false,eventId:row.event_id,authorityHash,baseCommit:intent.expectedBase,commit:r?.commit,articleRevision:authority.articleRevision,markdownSha256:hash(intent.files[articlePath]),historyPath:historyPath(row.event_id),historySha256:hash(intent.files[historyPath(row.event_id)]),flags:qualityFlags(authority.command.revision.article)};
 if(!sha(r?.commit)||canonical(r)!==canonical(expected))stop('writer_receipt_corrupt');return r;
}
async function projection(authority:Authority,v:Selection,outbox:WriterOutbox,previousEvent:string|null):Promise<Intent>{
 let previous:null|{eventId:string;revisionId:string;path:string;sha256:string}=null;
 if(v.previousRevision!==null){if(!event(previousEvent))stop('writer_previous_authority_required');const row=await outbox.get(previousEvent);if(!row||row.state!=='complete'||!row.receipt||hash(row.receipt)!==row.receipt_hash)stop('writer_previous_authority_required');const intent=outbox.intent(row),record=JSON.parse(intent.files[historyPath(previousEvent)]);if(record.articleRevision!==v.previousRevision)stop('writer_previous_revision_conflict');previous={eventId:previousEvent,revisionId:v.previousRevision,path:historyPath(previousEvent),sha256:hash(intent.files[historyPath(previousEvent)])};}
 else if(previousEvent!==null)stop('writer_previous_revision_conflict');
 const {front,body}=publicationMarkdown(authority.command.revision.article,authority.receipt.publisher,authority.bindings);front.publication.revisionId=authority.articleRevision;front.publication.flags=qualityFlags(authority.command.revision.article);
 const markdown='---\n'+Object.entries(front).map(([key,value])=>key+': '+JSON.stringify(value)).join('\n')+'\n---\n\n'+body+'\n';
 const descriptor={...(authority.canonicalBase?{canonicalBase:authority.canonicalBase}:{}),schemaVersion:1,kind:'controlled-automatic-maintenance-revision',eventId:authority.command.eventId,articleId:'tool-use',articleRevision:authority.articleRevision,previous,expectedBaseCommit:v.expectedBaseCommit,markdownSha256:hash(markdown),authorityHash:hash(canonical(authority)),packetHash:authority.packetHash,providerResponseHash:authority.providerResponseHash,sourceTreeHash:authority.sourceTreeHash,evidenceHash:authority.evidenceHash,sourceBindings:authority.bindings,localPublicationReceipt:authority.receipt,generation:authority.generation,flags:qualityFlags(authority.command.revision.article)};
 const record=canonical(descriptor),pointer=canonical({schemaVersion:1,kind:'controlled-automatic-maintenance-head',eventId:authority.command.eventId,articleRevision:authority.articleRevision,markdownSha256:hash(markdown),recordPath:historyPath(authority.command.eventId),recordSha256:hash(record),flags:descriptor.flags});
 return intentInput({schemaVersion:1,expectedBase:v.expectedBaseCommit,previousEvent,files:{[articlePath]:markdown,[historyPath(authority.command.eventId)]:record,[pointerPath]:pointer}},authority.command.eventId);
}
// Fixed repository/ref and a controlled fixture port only. No default HTTP, secret or route.
export async function writeMaintenanceRevision(value:unknown,context:Context):Promise<WriterReceipt>{
 if(context.enabled!==true||context.transport?.kind!=='controlled-github-maintenance-fixture'||typeof context.transport.send!=='function')stop('writer_disabled');
 const v=selection(value),clock=context.clock??Date.now,now=clock();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('writer_clock');
 const authority=await completedMaintenance(v.command,context);if(v.previousRevision!==(authority.canonicalBase?.receipt.articleRevision??authority.command.revision.baseRevision))stop('writer_previous_revision_conflict');if(authority.canonicalBase&&v.expectedBaseCommit!==authority.canonicalBase.sourceCommit)stop('writer_canonical_base_conflict');const id=authority.command.eventId,authorityHash=hash(canonical(authority)),fingerprint=hash(canonical({expectedBase:v.expectedBaseCommit,previousRevision:v.previousRevision,authorityHash})),outbox=new WriterOutbox(context.db),claimed=await outbox.claim(id,fingerprint,now),owner=claimed.owner;let row=claimed.row;
 try{
  if(row.state!=='preparing'){const saved=outbox.intent(row),expected=await projection(authority,v,outbox,saved.previousEvent);if(canonical(saved)!==canonical(expected))stop('writer_intent_corrupt');if(row.state==='complete')return cachedReceipt(row,authorityHash,saved,authority);}
  const assertCurrent=()=>{if(authority.canonicalBase&&(!context.canonicalBase||canonical(readMaintenanceBase(context.canonicalBase,context.bridge.repo,true).metadata)!==canonical(authority.canonicalBase)))stop('writer_canonical_base_conflict');const active=context.bridge.current(),publisher=context.bridge.publisher.current();if(!active||canonical(active.reference)!==canonical(authority.receipt.site)||active.manifest.state.articleRevision!==authority.articleRevision||canonical(publisher?.reference)!==canonical(authority.receipt.publisher)||context.bridge.status().pending.length)stop('writer_candidate_not_current');};
  if(row.state!=='dispatched')assertCurrent();
  const project=projectFiles(context.bridge.repo);if(project.hash!==authority.sourceTreeHash)stop('writer_authority_changed');
  const checkBaseCode=(tree:Map<string,Entry>)=>{for(const [path,bytes]of Object.entries(project.files)){if(path===articlePath)continue;const entry=tree.get(path);if(!entry||entry.type!=='blob'||entry.mode!=='100644'||entry.sha!==blobSha(bytes))stop('writer_canonical_code_conflict');}for(const path of tree.keys())if((path.startsWith('src/')||path.startsWith('public/'))&&!(path in project.files)&&path!==pointerPath&&!/^src\/content\/maintenance\/history\/[a-f0-9]{64}\.json$/.test(path))stop('writer_canonical_code_conflict');};
  const api=session(outbox,id,owner,context.transport,clock);let baseTree:Map<string,Entry>|undefined;
  async function treeAt(oid:string){const c=commit(await api.request('/git/commits/'+oid),oid);return {commit:c,leaves:leaves(await api.request('/git/trees/'+c.tree.sha+'?recursive=1'),c.tree.sha)};}
  async function verify(oid:string,intent:Intent,tip?:string){
   const result=await treeAt(oid);if(result.commit.parents.length!==1||result.commit.parents[0].sha!==v.expectedBaseCommit||result.commit.message.trimEnd()!==message(id,authorityHash).trimEnd())stop('writer_commit_conflict');
   baseTree??=(await treeAt(v.expectedBaseCommit)).leaves;const expected=new Map(baseTree);
   for(const [path,text]of Object.entries(intent.files)){const entry=regular(result.leaves,path);if(entry.sha!==blobSha(text))stop('writer_tree_conflict');const actual=decodeBlob(await api.request('/git/blobs/'+entry.sha),entry.sha,path===articlePath?writerLimits.markdownBytes:32768);if(actual!==text)stop('writer_blob_conflict');expected.set(path,{path,type:'blob',mode:'100644',sha:blobSha(text)});}
   const inventory=(map:Map<string,Entry>)=>[...map.values()].map(e=>({path:e.path,type:e.type,mode:e.mode,sha:e.sha})).sort((a,b)=>a.path.localeCompare(b.path,'en'));
   if(canonical(inventory(result.leaves))!==canonical(inventory(expected)))stop('writer_unrelated_files_changed');
   const current=tip??(await api.request('/git/ref/heads/'+branch))?.object?.sha;if(!sha(current))stop('writer_ref_rejected');
   if(current!==oid){const found=await api.request('/commits?sha='+current+'&path='+encodeURIComponent(historyPath(id))+'&per_page=2');if(!Array.isArray(found)||found.length!==1||found[0]?.sha!==oid)stop('writer_history_unconfirmed');const tree=(await treeAt(current)).leaves;if(regular(tree,historyPath(id)).sha!==blobSha(intent.files[historyPath(id)]))stop('writer_history_unconfirmed');}
   if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==current)stop('writer_tip_changed_after_verification');
   return {schemaVersion:1 as const,mode:'local-synthetic-only' as const,state:'canonical-commit-verified' as const,livePublished:false as const,eventId:id,authorityHash,baseCommit:v.expectedBaseCommit,commit:oid,articleRevision:authority.articleRevision,markdownSha256:hash(intent.files[articlePath]),historyPath:historyPath(id),historySha256:hash(intent.files[historyPath(id)]),flags:qualityFlags(authority.command.revision.article)};
  }
  let intent:Intent;
  if(row.state==='preparing'){
   if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==v.expectedBaseCommit)stop('writer_stale_base');baseTree=(await treeAt(v.expectedBaseCommit)).leaves;checkBaseCode(baseTree);const source=regular(baseTree,articlePath),baseline=decodeBlob(await api.request('/git/blobs/'+source.sha),source.sha,writerLimits.markdownBytes);let previousEvent:string|null=null;
   if(v.previousRevision===null){if(baseTree.has(pointerPath)||hash(baseline)!==authority.command.originalMarkdownHash)stop('writer_canonical_base_conflict');}
   else{regular(baseTree,pointerPath);const pointer=JSON.parse(decodeBlob(await api.request('/git/blobs/'+regular(baseTree,pointerPath).sha),regular(baseTree,pointerPath).sha,32768));if(!event(pointer.eventId))stop('writer_previous_authority_required');const parentEvent:string=pointer.eventId;previousEvent=parentEvent;const prior=await outbox.get(parentEvent);if(!prior||prior.state!=='complete')stop('writer_previous_authority_required');const old=outbox.intent(prior);if(old.files[pointerPath]!==canonical(pointer)||hash(baseline)!==hash(old.files[articlePath])||regular(baseTree,historyPath(parentEvent)).sha!==blobSha(old.files[historyPath(parentEvent)]))stop('writer_canonical_base_conflict');}
   if(baseTree.has(historyPath(id)))stop('writer_history_already_exists');intent=await projection(authority,v,outbox,previousEvent);await outbox.prepare(id,owner,intent,clock());await context.checkpoint?.('intent');row=(await outbox.get(id))!;
  }else intent=outbox.intent(row);
  let oid:string;
  if(row.state==='dispatched'){
   const tip=(await api.request('/git/ref/heads/'+branch))?.object?.sha;if(!sha(tip))stop('writer_ref_rejected');const found=await api.request('/commits?sha='+tip+'&path='+encodeURIComponent(historyPath(id))+'&per_page=2');if(!Array.isArray(found)||found.length!==1||!sha(found[0]?.sha))stop('writer_head_conflict_or_unconfirmed');oid=found[0].sha;
  }else{
   if(hash(canonical(await completedMaintenance(v.command,context)))!==authorityHash)stop('writer_authority_changed');assertCurrent();await outbox.dispatch(id,owner,clock());await context.checkpoint?.('dispatched');assertCurrent();
   const response=await api.request('',{operationName:'CanonicalMaintenanceCommit',query:commitMutation,variables:{input:{branch:{repositoryNameWithOwner:repository,branchName:branch},expectedHeadOid:v.expectedBaseCommit,clientMutationId:fingerprint,message:{headline:'Automatic maintenance: tool-use',body:'Event: '+id+'\nAuthority: '+authorityHash+'\n'},fileChanges:{additions:Object.entries(intent.files).map(([path,contents])=>({path,contents:Buffer.from(contents).toString('base64')}))}}}});
   if(response?.errors||response?.data?.createCommitOnBranch?.clientMutationId!==fingerprint||!sha(response?.data?.createCommitOnBranch?.commit?.oid))stop('writer_commit_unconfirmed');oid=response.data.createCommitOnBranch.commit.oid;await context.checkpoint?.('remote-committed');
  }
  const receipt=await verify(oid,intent);await context.checkpoint?.('verified');await outbox.complete(id,owner,receipt,clock());return receipt;
 }finally{await outbox.release(id,owner);}
}
