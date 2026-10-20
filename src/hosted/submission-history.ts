import type {SqlDatabase} from '../editorial/contracts.ts';
import {approved,canonical,digest,gitSha,hash,limits,repository,type VerifiedAdmin} from './contracts.ts';
import {ownerHash} from './approvals.ts';

// Historical evidence only: this read never refreshes GitHub or grants write authority.
export async function submissionHistory(db:SqlDatabase,id:string,admin:VerifiedAdmin){
  const owner=await ownerHash(admin);
  const rows=await db.prepare(`SELECT r.approval_id,r.submission_version,r.input_json AS review_input,r.created_at,
    n.owner_hash,n.input_json,n.note_json,n.fingerprint,n.approved_at,
    s.version AS current_version,s.status AS current_status,s.article_id,
    v.revoked_at,p.fingerprint AS proposal_fingerprint,p.state AS proposal_state,p.receipt_json
    FROM hosted_submission_reviews r JOIN hosted_reviewed_notes n ON n.id=r.approval_id
    JOIN submissions s ON s.id=r.submission_id
    LEFT JOIN hosted_note_revocations v ON v.approval_id=r.approval_id
    LEFT JOIN github_content_proposals p ON p.approval_id=r.approval_id
    WHERE r.submission_id=? AND r.owner_hash=? AND n.owner_hash=?
    ORDER BY r.created_at DESC,r.approval_id DESC LIMIT ?`).bind(id,owner,owner,limits.submissionRows).all<any>();
  const items=[];
  for(const row of rows.results){
    const note=approved(JSON.parse(row.note_json),row.approval_id,Date.now());
    if(note.schemaVersion!==2||note.submissionId!==id||note.submissionRevision!==row.submission_version||note.articleId!==row.article_id||note.reviewerRef!=='admin-'+owner.slice(0,24)||note.approvedAt!==row.approved_at||row.created_at!==row.approved_at||row.review_input!==row.input_json||await hash(canonical(note))!==row.fingerprint)throw Error('review_history_corrupt');
    let proposal:{state:string;url?:string;pullRequest?:number}={state:'not-started'};
    if(row.proposal_state){
      if(row.proposal_fingerprint!==row.fingerprint)throw Error('review_history_corrupt');
      if(row.proposal_state==='pending')proposal={state:'outcome-unconfirmed'};
      else if(row.proposal_state==='proposed'){
        const receipt=JSON.parse(row.receipt_json);
        if(receipt?.schemaVersion!==2||receipt.state!=='draft-proposed'||receipt.published!==false||receipt.approvalId!==note.approvalId||receipt.articleId!==note.articleId||receipt.contentPath!==note.contentPath||receipt.baseCommit!==note.baseCommit||receipt.branch!=='content-corrections/'+note.approvalId||!gitSha(receipt.headCommit)||!digest(receipt.markdownSha256)||!Number.isSafeInteger(receipt.pullRequest)||receipt.pullRequest<1||receipt.url!==`https://github.com/${repository}/pull/${receipt.pullRequest}`)throw Error('review_history_corrupt');
        proposal={state:'draft-recorded',url:receipt.url,pullRequest:receipt.pullRequest};
      }else throw Error('review_history_corrupt');
    }
    items.push({approvalId:note.approvalId,submissionRevision:note.submissionRevision,articleId:note.articleId,approvedAt:note.approvedAt,baseCommit:note.baseCommit,note:note.note,citationId:note.citationId,approvalState:row.revoked_at!==null?'revoked':row.current_version!==row.submission_version||row.current_status!=='follow-up'?'stale':'current',proposal});
  }
  if(admin.expiresAt<=Date.now())throw Error('verified_admin_required');
  return {items,published:false,articleChanged:false,remoteStateChecked:false};
}
