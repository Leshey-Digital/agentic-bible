import {hostedTarget} from './targets.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {approved,canonical,hash,limits,uuid,type VerifiedAdmin} from './contracts.ts';
import {ownerHash,lookupApproval} from './approvals.ts';
import {ContributionError} from './contributions.ts';
export async function createSubmissionReview(db:SqlDatabase,id:string,value:any,admin:VerifiedAdmin,now=Date.now()){
  const keys=['approvalId','submissionRevision','baseCommit','baseMarkdownSha256','note','citationId','confirm'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(',')||value.confirm!=='reviewed'||!uuid(value.approvalId)||!Number.isSafeInteger(value.submissionRevision)||value.submissionRevision<1)throw new ContributionError('explicit_submission_review_required');
  const item=await db.prepare('SELECT article_id FROM submissions WHERE id=?').bind(id).first<{article_id:string}>(),target=hostedTarget(item?.article_id);if(!target)throw new ContributionError('invalid_submission_article',409);
  const owner=await ownerHash(admin),note=approved({schemaVersion:2,...target,mode:'verified-admin-github-proposal',approvalId:value.approvalId,submissionId:id,submissionRevision:value.submissionRevision,reviewerRef:'admin-'+owner.slice(0,24),approvedAt:now,baseCommit:value.baseCommit,baseMarkdownSha256:value.baseMarkdownSha256,note:value.note,citationId:value.citationId},value.approvalId,now);
  const input=canonical(value),noteJson=canonical(note),fingerprint=await hash(noteJson),event=crypto.randomUUID();
  if(admin.expiresAt<=Date.now())throw new ContributionError('verified_admin_required',403);
  await db.batch([
    db.prepare(`INSERT INTO hosted_reviewed_notes(id,owner_hash,input_json,note_json,fingerprint,approved_at)
      SELECT ?,?,?,?,?,? FROM submissions WHERE id=? AND article_id=? AND version=? AND status='follow-up'
      AND (SELECT COUNT(*) FROM editorial_audit WHERE submission_id=submissions.id)<64 AND (SELECT COUNT(*) FROM editorial_audit)<16000
      AND (SELECT COUNT(*) FROM hosted_reviewed_notes)<? ON CONFLICT DO NOTHING`).bind(note.approvalId,owner,input,noteJson,fingerprint,now,id,target.articleId,value.submissionRevision,limits.submissionRows),
    db.prepare(`INSERT INTO hosted_submission_reviews(approval_id,submission_id,submission_version,owner_hash,input_json,created_at)
      SELECT n.id,s.id,s.version,n.owner_hash,n.input_json,n.approved_at FROM hosted_reviewed_notes n JOIN submissions s ON s.id=?
      WHERE n.id=? AND n.owner_hash=? AND n.input_json=? AND n.note_json=? AND n.fingerprint=? AND n.approved_at=?
      AND s.article_id=? AND s.version=? AND s.status='follow-up' AND changes()=1`).bind(id,note.approvalId,owner,input,noteJson,fingerprint,now,target.articleId,value.submissionRevision),
    db.prepare(`INSERT INTO editorial_audit(id,submission_id,actor,action,status,tags,created_at)
      SELECT ?,s.id,?,'hosted-note-reviewed',s.status,s.tags,? FROM submissions s JOIN hosted_submission_reviews r ON r.submission_id=s.id
      WHERE r.approval_id=? AND r.owner_hash=? AND r.input_json=? AND r.created_at=? AND changes()=1`).bind(event,admin.subject,now,note.approvalId,owner,input,now),
  ]);
  const binding=await db.prepare('SELECT * FROM hosted_submission_reviews WHERE approval_id=?').bind(note.approvalId).first<{submission_id:string;submission_version:number;owner_hash:string;input_json:string}>();
  if(!binding){const count=await db.prepare('SELECT COUNT(*) count FROM hosted_reviewed_notes').first<{count:number}>();if(count&&count.count>=limits.submissionRows)throw new ContributionError('hosted_submission_review_capacity',503);}
  if(!binding||binding.submission_id!==id||binding.submission_version!==value.submissionRevision||binding.owner_hash!==owner||binding.input_json!==input)throw new ContributionError('submission_review_conflict',409);
  const saved=await lookupApproval(db,note.approvalId,admin);if(!saved)throw new ContributionError('submission_review_stale_or_revoked',409);
  return {approval:saved,published:false,articleChanged:false};
}
