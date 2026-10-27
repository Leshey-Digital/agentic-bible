import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash,uuid,type Ports,type VerifiedAdmin} from './contracts.ts';
import {lookupApproval} from './approvals.ts';
import {projectNote} from './markdown.ts';
import {sourceCitations} from './targets.ts';

export class RevisionPreviewError extends Error{
 readonly code:string;readonly status:number;
 constructor(code:string,status=409){super(code);this.code=code;this.status=status;}
}
function fail(code:string,status=409):never{throw new RevisionPreviewError(code,status);}
// This is the same append-only projection used by the existing GitHub proposal
// transport. No source fetch, write, model, proposal or publication port exists.
export async function previewReviewedRevision(db:SqlDatabase,submissionId:string,approvalId:string,admin:VerifiedAdmin,request:Request,reviewSource?:Ports['reviewSource']){
 const fresh=()=>{if(admin.role!=='admin'||admin.csrfVerified!==true||!/^signed-admin:[a-f0-9]{64}$/.test(admin.subject)||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||request.signal.aborted)fail('verified_admin_required',403);};fresh();
 if(!uuid(submissionId)||!uuid(approvalId))fail('invalid_request',400);
 if(!reviewSource)fail('revision_build_source_unavailable',503);
 const note=await lookupApproval(db,approvalId,admin);fresh();
 if(!note||note.schemaVersion!==2||note.submissionId!==submissionId)fail('revision_review_unavailable',404);
 const fingerprint=await hash(canonical(note)),source=structuredClone(await reviewSource(note.articleId));fresh();
 if(source.sourceAuthority!=='immutable-build'||source.articleId!==note.articleId||source.contentPath!==note.contentPath||source.baseCommit!==note.baseCommit||source.baseMarkdownSha256!==note.baseMarkdownSha256)fail('revision_source_mismatch');
 const citations=sourceCitations(source.markdown);
 if(canonical(citations)!==canonical(source.citations)||!citations.includes(note.citationId))fail('revision_source_mismatch');
 const markdown=await projectNote(source.markdown,note),markdownSha256=await hash(markdown);fresh();
 if(!markdown.startsWith(source.markdown))fail('revision_projection_invalid',503);
 // Recheck current submission/revocation authority after all async projection
 // work. Historical approvals are evidence but cannot authorize this preview.
 const current=await lookupApproval(db,approvalId,admin);fresh();
 if(!current||canonical(current)!==canonical(note))fail('revision_review_changed');
 const diff=revisionAppendDiff(source.markdown,markdown,note.contentPath);
 return {schemaVersion:1,kind:'reviewed-correction-revision-preview',articleId:note.articleId,contentPath:note.contentPath,submissionId,submissionRevision:note.submissionRevision,approvalId,approvalFingerprint:fingerprint,baseCommit:note.baseCommit,baseMarkdownSha256:note.baseMarkdownSha256,markdownSha256,markdown,diff,
  checks:{baseHashMatched:true,citationDeclared:true,existingMarkdownPreserved:true,projection:'github-reviewed-correction-v1'},sourceAuthority:'immutable-build',remoteBaseChecked:false,approvedForPublication:false,published:false,articleChanged:false};
}

export function revisionAppendDiff(base:string,markdown:string,path:string){
 const terminated=base.endsWith('\n'),before=base.split('\n'),after=markdown.split('\n');
 if(terminated)before.pop();after.pop();
 const start=Math.max(0,before.length-3),old=before.slice(start),context=terminated?old:old.slice(0,-1);
 const lines=context.map(line=>' '+line);
 if(!terminated)lines.push('-'+old.at(-1),'\\ No newline at end of file','+'+after[before.length-1]);
 lines.push(...after.slice(before.length).map(line=>'+'+line));
 return '--- a/'+path+'\n+++ b/'+path+'\n@@ -'+(start+1)+','+old.length+' +'+(start+1)+','+(after.length-start)+' @@\n'+lines.join('\n')+'\n';
}
