import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {articleInput,canonical,hash,type Article} from '../publishing/contracts.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import type {Apply,Rollback} from '../wiki-bridge/contracts.ts';
import {projectFiles} from '../wiki-bridge/files.ts';
import type {WikiBridge,SiteReceipt} from '../wiki-bridge/store.ts';

export class CorrectionError extends Error{code:string;constructor(code:string){super(code);this.code=code;}}
export function reject(code:string):never{throw new CorrectionError(code);}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
export type ReviewedCommand=(Apply|Rollback)&{authority:{kind:'local-admin-reviewed-correction';approvalId:string;sourceTreeHash:string}};
export type Operation={id:string;fingerprint:string;submission_id:string;submission_version:number;reviewer:'local-editor';kind:'apply'|'rollback';command_json:string;state:'approved'|'complete';receipt_json:string|null;created_at:number};
export const operation=(db:SqlDatabase,id:string)=>db.prepare('SELECT * FROM correction_operations WHERE id=?').bind(id).first<Operation>();
export async function reviewedCommand(id:string,db:SqlDatabase):Promise<ReviewedCommand>{
  if(!uuid(id))reject('invalid_approval');const op=await operation(db,id);if(!op||op.reviewer!=='local-editor')reject('approval_required');
  const command=JSON.parse(op.command_json) as ReviewedCommand;
  if(hash(canonical(command))!==op.fingerprint||command.authority?.kind!=='local-admin-reviewed-correction'||command.authority.approvalId!==id||command.eventId!=='correction-'+id||command.kind!==op.kind)reject('approval_corrupt');
  if(command.kind==='apply'){
    const article=articleInput(command.revision.article),credit=article.reviewedCorrections?.at(-1);
    if(article.id!=='tool-use'||!credit||credit.approvalId!==id||credit.submissionId!==op.submission_id||credit.submissionVersion!==op.submission_version||credit.reviewer!==op.reviewer||credit.approvedAt!==op.created_at)reject('approval_corrupt');
  }else if(command.targetSite!==null)reject('unsupported_correction_rollback');
  return command;
}
export async function verifyApproval(command:ReviewedCommand,db:SqlDatabase){
  const current=await reviewedCommand(command.authority.approvalId,db);if(canonical(current)!==canonical(command))reject('approval_changed');
  const op=(await operation(db,command.authority.approvalId))!;
  if(op.state==='approved'){
    const item=await db.prepare('SELECT version,last_event_id FROM submissions WHERE id=?').bind(op.submission_id).first<{version:number;last_event_id:string}>();
    if(!item||item.version!==op.submission_version+1||item.last_event_id!==op.id)reject('review_changed_pending');
  }
  return {bindings:[],files:{},evidenceHash:op.fingerprint};
}
export function baseline(repo:string){
  const markdown=readFileSync(join(repo,'src/content/articles/tool-use.md'),'utf8');const match=/^---\n([^]*?)\n---\n([^]*)$/.exec(markdown);if(!match)reject('unsupported_baseline');
  const scalar=(name:string)=>{const value=new RegExp('^'+name+': (.+)$','m').exec(match[1])?.[1];if(!value)reject('unsupported_baseline');return value.replace(/^'|'$/g,'');};
  const sources=[...match[1].matchAll(/  - id: (.+)\n    title: (.+)\n    url: (.+)\n    publisher: (.+)\n    context: (.+)/g)].map(([,id,title,url,publisher,context])=>({id,title,url,publisher,context}));
  if(sources.length!==3||sources.map(s=>s.id).join(',')!=='openai,claude,mcp-tools')reject('unsupported_baseline');
  return {markdown,hash:hash(markdown),title:scalar('title'),description:scalar('description'),verified:scalar('verified'),sources};
}
export type ReviewInput={requestKey:string;submissionId:string;version:number;note:string;citationId:string;expectedSite:string;expectedPublisher:string;sourceTreeHash:string;originalMarkdownHash:string;confirm:string;kind:'apply'|'rollback'};
function sameReviewInput(op:Operation,input:ReviewInput,reviewer:string,command:ReviewedCommand){
    const last=command.kind==='apply'?command.revision.article.blocks.at(-1):null;
    const text=last?.type==='paragraph'?last.content.find(p=>p.type==='text'):null;
    const citation=last?.type==='paragraph'?last.content.find(p=>p.type==='citation'):null;
    if(op.submission_id!==input.submissionId||op.submission_version!==input.version||op.kind!==input.kind||op.reviewer!==reviewer||command.originalMarkdownHash!==input.originalMarkdownHash||command.authority.sourceTreeHash!==input.sourceTreeHash||canonical(command.expectedSite).trim()!==input.expectedSite.trim()||canonical(command.expectedPublisher).trim()!==input.expectedPublisher.trim()||(input.kind==='apply'&&(text?.text!==input.note||citation?.sourceId!==input.citationId)))return false;
    return true;
}
export async function approve(db:SqlDatabase,bridge:WikiBridge,input:ReviewInput,reviewer:string,now=Date.now()){
  if(reviewer!=='local-editor'||!uuid(input.requestKey)||!uuid(input.submissionId)||!Number.isSafeInteger(input.version)||input.version<1||input.confirm!=='reviewed')reject('explicit_admin_review_required');
  if(typeof input.expectedSite!=='string'||typeof input.expectedPublisher!=='string'||input.expectedSite.length>300||input.expectedPublisher.length>300||!/^([a-f0-9]{64})$/.test(input.sourceTreeHash)||!/^([a-f0-9]{64})$/.test(input.originalMarkdownHash))reject('invalid_review_base');
  const existing=await operation(db,input.requestKey);
  const original=baseline(bridge.repo);const prior=bridge.publisher.current();const current=bridge.current();
  // Frozen original retries compare their complete request against the saved command below, before current-base checks.
  if(existing){
    const command=await reviewedCommand(existing.id,db);if(!sameReviewInput(existing,input,reviewer,command))reject('approval_key_conflict');
    return existing;
  }
  if(!['apply','rollback'].includes(input.kind)||original.hash!==input.originalMarkdownHash||projectFiles(bridge.repo).hash!==input.sourceTreeHash||canonical(current?.reference??null).trim()!==input.expectedSite.trim()||canonical(prior?.reference??null).trim()!==input.expectedPublisher.trim())reject('stale_correction_base');
  const authority:ReviewedCommand['authority']={kind:'local-admin-reviewed-correction',approvalId:input.requestKey,sourceTreeHash:input.sourceTreeHash};
  let command:ReviewedCommand;
  if(input.kind==='rollback'){
    if(!current||!prior||!current.manifest.state.articleRevision||!bridge.publisher.revision(current.manifest.state.articleRevision).reviewedCorrections)reject('no_active_correction');
    command={schemaVersion:1,mode:'local-synthetic-only',kind:'rollback',eventId:'correction-'+input.requestKey,originalMarkdownHash:original.hash,expectedSite:current.reference,expectedPublisher:prior.reference,targetSite:null,authority};
  }else{
    if(typeof input.note!=='string'||input.note!==input.note.trim()||input.note.length<20||input.note.length>1000||/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(input.note)||!original.sources.some(s=>s.id===input.citationId))reject('invalid_reviewed_note');
    const old=prior?.manifest.state.articles['tool-use']?bridge.publisher.revision(prior.manifest.state.articles['tool-use']):null;
    if(old&&!old.reviewedCorrections)reject('unsupported_correction_parent');if((old?.reviewedCorrections?.length??0)>=6)reject('correction_capacity');
    const used=new Set([...(old?.sources.map(s=>s.id)??[]),input.citationId]);
    const article:Article=articleInput({id:'tool-use',title:original.title,description:original.description,topic:'Capabilities',verified:original.verified,provenance:'supplied-local-fixture',sources:original.sources.filter(s=>used.has(s.id)),related:['ai-agent','model-context-protocol'],concerns:['editorial-review'],reviewedCorrections:[...(old?.reviewedCorrections??[]),{approvalId:input.requestKey,submissionId:input.submissionId,submissionVersion:input.version,reviewer,approvedAt:now}],blocks:[...(old?.blocks??[]),{type:'heading',id:'review-'+input.requestKey.replaceAll('-','').slice(0,24),text:'Reviewed correction '+((old?.reviewedCorrections?.length??0)+1)},{type:'paragraph',content:[{type:'text',text:input.note},{type:'citation',sourceId:input.citationId}]}]});
    command={schemaVersion:1,mode:'local-synthetic-only',kind:'apply',eventId:'correction-'+input.requestKey,originalMarkdownHash:original.hash,expectedSite:current?.reference??null,expectedPublisher:prior?.reference??null,revision:{schemaVersion:1,kind:'publish',eventId:'correction-'+input.requestKey,baseRevision:prior?.manifest.state.articles['tool-use']??null,article},evidence:[],authority};
  }
  const json=canonical(command);if(Buffer.byteLength(json)>32768)reject('correction_capacity');
  // Losing ON CONFLICT admission must not authorize later writes by key alone.
  // Rollback command fingerprints do not include submission metadata, so bind the full stored tuple.
  const fingerprint=hash(json),winning="o.id=? AND o.fingerprint=? AND o.submission_id=? AND o.submission_version=? AND o.reviewer=? AND o.kind=? AND o.command_json=? AND o.created_at=? AND o.state='approved'";
  const candidate=[input.requestKey,fingerprint,input.submissionId,input.version,reviewer,input.kind,json,now];
  await db.batch([
    db.prepare(`INSERT INTO correction_operations(id,fingerprint,submission_id,submission_version,reviewer,kind,command_json,state,created_at)
      SELECT ?,?,?,?,?,?,?,'approved',? FROM submissions WHERE id=? AND version=? AND article_id='tool-use' AND kind='correction' AND status IN ('new','follow-up',${input.kind==='rollback'?"'resolved'":"'new'"})
      AND NOT EXISTS(SELECT 1 FROM correction_operations WHERE state='approved') AND (SELECT COUNT(*) FROM correction_operations)<? ON CONFLICT DO NOTHING`).bind(input.requestKey,fingerprint,input.submissionId,input.version,reviewer,input.kind,json,now,input.submissionId,input.version,input.kind==='apply'?7:8),
    db.prepare(`UPDATE submissions SET version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM correction_operations o WHERE ${winning} AND o.submission_id=submissions.id AND o.submission_version=submissions.version)`).bind(input.requestKey,now,input.submissionId,input.version,...candidate),
    db.prepare(`INSERT OR IGNORE INTO editorial_audit(id,submission_id,actor,action,status,tags,created_at) SELECT o.id,s.id,o.reviewer,'correction-approved',s.status,s.tags,o.created_at FROM correction_operations o JOIN submissions s ON s.id=o.submission_id WHERE ${winning} AND s.last_event_id=o.id AND s.version=o.submission_version+1`).bind(...candidate),
  ]);
  const saved=await operation(db,input.requestKey);if(!saved)reject('stale_review_or_pending_or_capacity');
  const savedCommand=await reviewedCommand(saved.id,db);if(!sameReviewInput(saved,input,reviewer,savedCommand))reject('approval_key_conflict');await verifyApproval(savedCommand,db);return saved;
}
export async function complete(db:SqlDatabase,op:Operation,receipt:SiteReceipt){
  const event=op.id+'-complete',now=Date.now();
  await db.batch([
    db.prepare("UPDATE correction_operations SET state='complete',receipt_json=? WHERE id=? AND state='approved'").bind(canonical(receipt),op.id),
    db.prepare(`UPDATE submissions SET status='resolved',version=version+1,last_event_id=?,updated_at=? WHERE id=? AND version=? AND last_event_id=? AND EXISTS(SELECT 1 FROM correction_operations WHERE id=? AND state='complete')`).bind(event,now,op.submission_id,op.submission_version+1,op.id,op.id),
    db.prepare(`INSERT OR IGNORE INTO editorial_audit(id,submission_id,actor,action,status,tags,created_at) SELECT ?,s.id,?,?,'resolved',s.tags,? FROM submissions s WHERE s.id=? AND s.last_event_id=?`).bind(event,op.reviewer,op.kind==='apply'?'correction-published':'correction-rolled-back',now,op.submission_id,event),
  ]);
}
