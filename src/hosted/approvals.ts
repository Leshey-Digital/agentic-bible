import type {SqlDatabase} from '../editorial/contracts.ts';
import {approved,canonical,hash,limits,reject,uuid,type ApprovedNote,type VerifiedAdmin} from './contracts.ts';
type Stored={id:string;owner_hash:string;input_json:string;note_json:string;fingerprint:string;approved_at:number;revoked_at:number|null};
export const ownerHash=(admin:VerifiedAdmin)=>hash('agentic-bible-hosted-admin\n'+admin.subject);
async function stored(db:SqlDatabase,id:string){return db.prepare('SELECT n.*,r.revoked_at FROM hosted_reviewed_notes n LEFT JOIN hosted_note_revocations r ON r.approval_id=n.id WHERE n.id=?').bind(id).first<Stored>();}
export async function lookupApproval(db:SqlDatabase,id:string,admin:VerifiedAdmin):Promise<ApprovedNote|null>{
  if(admin.expiresAt<=Date.now())return null;const row=await stored(db,id);if(!row||row.revoked_at!==null||row.owner_hash!==await ownerHash(admin))return null;
  const note=approved(JSON.parse(row.note_json),id,Date.now());if(await hash(canonical(note))!==row.fingerprint||note.reviewerRef!=='admin-'+row.owner_hash.slice(0,24)||note.approvedAt!==row.approved_at)reject('hosted_approval_corrupt');return note;
}
export async function createApproval(db:SqlDatabase,value:any,admin:VerifiedAdmin,now=Date.now()){
  const keys=['approvalId','submissionId','submissionRevision','baseCommit','baseMarkdownSha256','note','citationId','confirm'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(',')||value.confirm!=='reviewed'||value.submissionRevision!==1)reject('explicit_hosted_review_required');
  const owner=await ownerHash(admin),note=approved({schemaVersion:1,mode:'verified-admin-github-proposal',approvalId:value.approvalId,submissionId:value.submissionId,submissionRevision:1,reviewerRef:'admin-'+owner.slice(0,24),approvedAt:now,baseCommit:value.baseCommit,baseMarkdownSha256:value.baseMarkdownSha256,note:value.note,citationId:value.citationId},value.approvalId,now);
  const input=canonical(value),json=canonical(note),fingerprint=await hash(json);
  // A single immutable admission has no follow-up write for a losing candidate to authorize.
  await db.prepare('INSERT INTO hosted_reviewed_notes(id,owner_hash,input_json,note_json,fingerprint,approved_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM hosted_reviewed_notes)<? ON CONFLICT DO NOTHING').bind(note.approvalId,owner,input,json,fingerprint,now,limits.rows).run();
  const saved=await stored(db,note.approvalId);if(!saved)reject('hosted_approval_capacity');if(saved.owner_hash!==owner||saved.input_json!==input)reject('hosted_approval_key_conflict');if(saved.revoked_at!==null)reject('hosted_approval_revoked');
  const result=await lookupApproval(db,note.approvalId,admin);if(!result)reject('hosted_approval_required');return result;
}
export async function revokeApproval(db:SqlDatabase,id:string,admin:VerifiedAdmin,now=Date.now()){
  if(!uuid(id))reject('invalid_hosted_approval');const owner=await ownerHash(admin),row=await stored(db,id);if(!row||row.owner_hash!==owner)reject('hosted_approval_required');
  await db.prepare('INSERT INTO hosted_note_revocations(approval_id,owner_hash,revoked_at) SELECT id,owner_hash,? FROM hosted_reviewed_notes WHERE id=? AND owner_hash=? ON CONFLICT DO NOTHING').bind(now,id,owner).run();return {approvalId:id,revoked:true,published:false};
}
export async function listApprovals(db:SqlDatabase,admin:VerifiedAdmin){
  const rows=await db.prepare('SELECT n.*,r.revoked_at FROM hosted_reviewed_notes n LEFT JOIN hosted_note_revocations r ON r.approval_id=n.id WHERE n.owner_hash=? ORDER BY n.approved_at DESC LIMIT 4').bind(await ownerHash(admin)).all<Stored>();
  return rows.results.map(row=>({approvalId:row.id,note:JSON.parse(row.note_json).note,citationId:JSON.parse(row.note_json).citationId,baseCommit:JSON.parse(row.note_json).baseCommit,approvedAt:row.approved_at,revoked:row.revoked_at!==null}));
}
