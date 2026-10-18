import {maintenanceTarget} from '../maintenance-quality/target.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import type {VerifiedAdmin} from '../hosted/contracts.ts';
import {lookupRestorationApproval} from '../maintenance-history/restoration-approvals.ts';
import {readCanonicalMaintenance} from '../maintenance-history/canonical.ts';
import {WriterOutbox} from '../maintenance-github/outbox.ts';
import {session,type ControlledGitHub} from '../maintenance-github/transport.ts';
import {canonical,hash,sha,historyPath,blobSha,commitMutation,repository,branch,type Intent} from '../maintenance-github/contracts.ts';
import {projectFiles} from '../wiki-bridge/files.ts';
import {ownedGit} from './git.ts';
import {stop,restoreEvent,makeRestorationRecord,restorationMarkdown,restorationPointer,restorationReceipt,restoreMessage,restoreReceiptReference,type RestorationReceipt} from './contracts.ts';
type Context={enabled?:boolean;admin:VerifiedAdmin;db:SqlDatabase;repo:string;canonicalRepo:string;transport?:ControlledGitHub;clock?:()=>number;checkpoint?:(phase:'intent'|'dispatched'|'remote-committed'|'verified')=>void|Promise<void>};
// Trusted server/local coordinator only. No client-supplied principal/paths and no
// shipped write route, default network transport, credential or paid operation.
export async function restoreMaintenanceRevision(value:unknown,context:Context):Promise<RestorationReceipt>{
 if(context.enabled!==true||context.transport?.kind!=='controlled-github-maintenance-fixture'||typeof context.transport.send!=='function')stop('restore_disabled');
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='approvalId'||typeof (value as any).approvalId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test((value as any).approvalId))stop('restore_invalid_selection');
 const clock=context.clock??Date.now,now=clock();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('restore_clock');
 const authority=await lookupRestorationApproval(context.db,(value as any).approvalId,context.admin,now),a=authority.approval,id=restoreEvent(a.approvalId),outbox=new WriterOutbox(context.db),fingerprint=hash(canonical({kind:'reviewed-canonical-restoration-v1',approvalHash:authority.approvalHash,expectedBase:a.sourceCommit})),{row:initial,owner}=await outbox.claim(id,fingerprint,now);let row=initial;
 try{
  const source=readCanonicalMaintenance({mode:'controlled-static-preview',repo:context.canonicalRepo,sourceCommit:a.sourceCommit}),current=source.history.find(e=>e.current&&e.receipt.commit===a.current.commit),target=source.history.find(e=>e.receipt.commit===a.target.commit);
  if(!current||!target||target.articleId!==current.articleId||source.history.indexOf(target)<=source.history.indexOf(current)||canonical(restoreReceiptReference(current.receipt))!==canonical(a.current)||canonical(restoreReceiptReference(target.receipt))!==canonical(a.target))stop('restore_approved_source_conflict');
  if(source.history.length>=16)stop('restore_history_capacity');
  const {articleId,articlePath,pointerPath}=maintenanceTarget(current.articleId),generic=articleId!=='tool-use',record=makeRestorationRecord(a,authority.approvalHash,target.markdown,target.flags,articleId),intent:Intent={schemaVersion:generic?2:1,...(generic?{articleId}:{}),expectedBase:a.sourceCommit,previousEvent:current.eventId,files:{[articlePath]:restorationMarkdown(target.markdown,record),[historyPath(id)]:canonical(record),[pointerPath]:canonical(restorationPointer(record))}};
  if(row.state!=='preparing'&&canonical(outbox.intent(row))!==canonical(intent))stop('restore_intent_corrupt');
  if(row.state==='complete'){
   if(!row.receipt||hash(row.receipt)!==row.receipt_hash)stop('restore_receipt_corrupt');let cached;try{cached=JSON.parse(row.receipt);}catch{return stop('restore_receipt_corrupt');}
   if(!sha(cached?.commit)||canonical(cached)!==canonical(restorationReceipt(record,cached.commit)))stop('restore_receipt_corrupt');const historical=readCanonicalMaintenance({mode:'controlled-static-preview',repo:context.canonicalRepo,sourceCommit:cached.commit}).history[0];if(!historical||canonical(historical.receipt)!==canonical(cached)||historical.markdown!==intent.files[articlePath])stop('restore_receipt_corrupt');return cached;
  }
  const active=async()=>{const fresh=await lookupRestorationApproval(context.db,a.approvalId,context.admin,clock());if(!fresh.active||fresh.approvalHash!==authority.approvalHash)stop('restore_approval_inactive');};
  const git=ownedGit(context.canonicalRepo);
  if(row.state!=='dispatched'){
   await active();const maintained=source.history.filter(e=>e.current),maintainedPaths=new Set(maintained.map(e=>maintenanceTarget(e.articleId).articlePath)),maintainedPointers=new Set(maintained.map(e=>maintenanceTarget(e.articleId).pointerPath));const project=projectFiles(context.repo),entries=git(['ls-tree','-r','-z',a.sourceCommit]).toString().split('\0').filter(Boolean).map(line=>{const [meta,path]=line.split('\t'),[mode,type,oid]=meta.split(' ');return {mode,type,oid,path};});if(entries.length>1024)stop('restore_tree_capacity');const tree=new Map(entries.map(e=>[e.path,e]));
   for(const [path,bytes]of Object.entries(project.files)){if(path===articlePath||maintainedPaths.has(path))continue;const actual=tree.get(path);if(!actual||actual.mode!=='100644'||actual.type!=='blob'||actual.oid!==blobSha(bytes))stop('restore_canonical_code_conflict');}
   for(const e of entries)if((e.path.startsWith('src/')||e.path.startsWith('public/'))&&!(e.path in project.files)&&e.path!==pointerPath&&!maintainedPointers.has(e.path)&&!/^src\/content\/maintenance\/history\/[a-f0-9]{64}\.json$/.test(e.path))stop('restore_canonical_code_conflict');
  }
  const api=session(outbox,id,owner,context.transport,clock);
  if(row.state==='preparing'){
   if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==a.sourceCommit)stop('restore_stale_head');
   await outbox.prepare(id,owner,intent,clock());await context.checkpoint?.('intent');row=(await outbox.get(id))!;
  }
  let oid:string;
  if(row.state==='dispatched'){
   const tip=(await api.request('/git/ref/heads/'+branch))?.object?.sha;if(!sha(tip))stop('restore_ref_rejected');const visible=readCanonicalMaintenance({mode:'controlled-static-preview',repo:context.canonicalRepo,sourceCommit:tip}).history.find(e=>e.eventId===id);
   if(!visible)stop('restore_dispatched_outcome_unconfirmed');oid=visible.receipt.commit;
  }else{
   await active();if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==a.sourceCommit)stop('restore_stale_head');
   await outbox.dispatch(id,owner,clock());await context.checkpoint?.('dispatched');await active();
   const message=restoreMessage(id,authority.approvalHash,articleId),parts=message.trimEnd().split('\n\n');
   const result=await api.request('',{operationName:'CanonicalMaintenanceCommit',query:commitMutation,variables:{input:{branch:{repositoryNameWithOwner:repository,branchName:branch},expectedHeadOid:a.sourceCommit,clientMutationId:fingerprint,message:{headline:parts[0],body:parts.slice(1).join('\n\n')+'\n'},fileChanges:{additions:Object.entries(intent.files).map(([path,contents])=>({path,contents:Buffer.from(contents).toString('base64')}))}}}});
   if(result?.errors||result?.data?.createCommitOnBranch?.clientMutationId!==fingerprint||!sha(result?.data?.createCommitOnBranch?.commit?.oid))stop('restore_commit_unconfirmed');oid=result.data.createCommitOnBranch.commit.oid;await context.checkpoint?.('remote-committed');
  }
  const verified=readCanonicalMaintenance({mode:'controlled-static-preview',repo:context.canonicalRepo,sourceCommit:oid}),entry=verified.history.find(e=>e.eventId===id),receipt=restorationReceipt(record,oid);
  if(verified.history[0]?.eventId!==id||!entry||canonical(entry.receipt)!==canonical(receipt)||entry.markdown!==intent.files[articlePath])stop('restore_commit_conflict');
  // The complete tree may change exactly the three declared paths, never an old
  // record or unrelated file. Record verification also checks single parent/CAS base.
  const names=git(['diff-tree','--no-commit-id','--name-only','-r',a.sourceCommit,oid]).toString().trim().split('\n').filter(Boolean).sort();if(canonical(names)!==canonical(Object.keys(intent.files).sort()))stop('restore_unrelated_files_changed');
  const tip=(await api.request('/git/ref/heads/'+branch))?.object?.sha;if(!sha(tip))stop('restore_ref_rejected');
  if(tip!==oid){const later=readCanonicalMaintenance({mode:'controlled-static-preview',repo:context.canonicalRepo,sourceCommit:tip}).history.find(e=>e.eventId===id);if(!later||canonical(later.receipt)!==canonical(receipt))stop('restore_history_unconfirmed');}
  if((await api.request('/git/ref/heads/'+branch))?.object?.sha!==tip)stop('restore_tip_changed_after_verification');
  await context.checkpoint?.('verified');await outbox.complete(id,owner,receipt,clock());return receipt;
 }finally{await outbox.release(id,owner);}
}
