import {canonical,hash,uuid,digest,gitSha,type VerifiedAdmin} from '../hosted/contracts.ts';
import {ownerHash} from '../hosted/approvals.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {MaintenanceReviewError,reviewedRevertAuthority,type CatalogEntry,verifiedCatalog} from './review.ts';
export type RestoreReference={eventId:string;commit:string;articleRevision:string;markdownSha256:string;historyPath:string;historySha256:string;receiptHash:string};
export type RestorationApproval={schemaVersion:1;kind:'reviewed-controlled-restoration';approvalId:string;requestId:string;ownerHash:string;reviewerRef:string;reviewFingerprint:string;reviewVersion:number;catalogHash:string;sourceCommit:string;current:RestoreReference;target:RestoreReference;approvedAt:number};
type ApprovalRow={approval_id:string;request_id:string;owner_hash:string;input_json:string;approval_json:string;fingerprint:string;approved_at:number;revoked_at:number|null};
function fail(code:string,status=409):never{throw new MaintenanceReviewError(code,status);}
export async function restoreReference(receipt:CatalogEntry['receipt']):Promise<RestoreReference>{return {eventId:receipt.eventId,commit:receipt.commit,articleRevision:receipt.articleRevision,markdownSha256:receipt.markdownSha256,historyPath:receipt.historyPath,historySha256:receipt.historySha256,receiptHash:await hash(canonical(receipt))};}
function validRef(r:any){return r&&Object.keys(r).sort().join(',')==='articleRevision,commit,eventId,historyPath,historySha256,markdownSha256,receiptHash'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(r.eventId)&&gitSha(r.commit)&&[r.articleRevision,r.markdownSha256,r.historySha256,r.receiptHash].every(digest)&&/^src\/content\/maintenance\/history\/[a-f0-9]{64}\.json$/.test(r.historyPath);}
export function approvalShape(value:any):RestorationApproval{
 const keys=['schemaVersion','kind','approvalId','requestId','ownerHash','reviewerRef','reviewFingerprint','reviewVersion','catalogHash','sourceCommit','current','target','approvedAt'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(',')||value.schemaVersion!==1||value.kind!=='reviewed-controlled-restoration'||!uuid(value.approvalId)||!uuid(value.requestId)||!digest(value.ownerHash)||value.reviewerRef!=='admin-'+value.ownerHash.slice(0,24)||!digest(value.reviewFingerprint)||!Number.isSafeInteger(value.reviewVersion)||value.reviewVersion<1||value.reviewVersion>16||!digest(value.catalogHash)||!gitSha(value.sourceCommit)||!validRef(value.current)||!validRef(value.target)||value.current.commit===value.target.commit||!Number.isSafeInteger(value.approvedAt)||value.approvedAt<0)fail('restoration_approval_corrupt',503);
 return value;
}
async function stored(db:SqlDatabase,id:string){return db.prepare('SELECT a.*,r.revoked_at FROM hosted_restoration_approvals a LEFT JOIN hosted_restoration_revocations r ON r.approval_id=a.approval_id WHERE a.approval_id=?').bind(id).first<ApprovalRow>();}
export async function lookupRestorationApproval(db:SqlDatabase,id:string,admin:VerifiedAdmin,now=Date.now()){
 if(!uuid(id))fail('restoration_approval_required',403);const row=await stored(db,id);if(!row||row.owner_hash!==await ownerHash(admin))fail('restoration_approval_required',403);
 let value:RestorationApproval;try{value=approvalShape(JSON.parse(row.approval_json));}catch{fail('restoration_approval_corrupt',503);}
 if(row.input_json!==canonical({approvalId:id,requestId:row.request_id,confirm:'approve-canonical-restoration'})||await hash(canonical(value))!==row.fingerprint||value.approvalId!==id||value.requestId!==row.request_id||value.ownerHash!==row.owner_hash||value.approvedAt!==row.approved_at)fail('restoration_approval_corrupt',503);
 const original=await reviewedRevertAuthority(db,value.requestId,admin);
 if(original.owner!==value.ownerHash||original.fingerprint!==value.reviewFingerprint||original.version!==value.reviewVersion||original.input.catalogHash!==value.catalogHash||original.input.receiptCommit!==value.current.commit||original.input.targetCommit!==value.target.commit)fail('restoration_approval_corrupt',503);
 return {approval:value,approvalHash:row.fingerprint,active:row.revoked_at===null&&original.latest&&now>=value.approvedAt&&now-value.approvedAt<=3600000};
}
export async function createRestorationApproval(db:SqlDatabase,value:any,admin:VerifiedAdmin,view:Awaited<ReturnType<typeof verifiedCatalog>>,now=Date.now()){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='approvalId,confirm,requestId'||!uuid(value.approvalId)||!uuid(value.requestId)||value.confirm!=='approve-canonical-restoration')fail('explicit_restoration_approval_required',400);
 const owner=await ownerHash(admin),raw=canonical(value),existing=await stored(db,value.approvalId);
 if(existing){if(existing.owner_hash!==owner||existing.input_json!==raw)fail('restoration_approval_key_conflict');return lookupRestorationApproval(db,value.approvalId,admin,now);}
 const request=await reviewedRevertAuthority(db,value.requestId,admin),selected=view.catalog.history.find(e=>e.current&&e.receipt.commit===request.input.receiptCommit),current=selected?.receipt,target=view.catalog.history.find(e=>!e.current&&e.receipt.commit===request.input.targetCommit&&(e.articleId??'tool-use')===(selected?.articleId??'tool-use'))?.receipt;
 if(!request.latest||request.input.catalogHash!==view.catalogHash||request.input.receiptCommit!==current?.commit||!target)fail('restoration_stale_review');
 const approval:RestorationApproval={schemaVersion:1,kind:'reviewed-controlled-restoration',approvalId:value.approvalId,requestId:value.requestId,ownerHash:owner,reviewerRef:'admin-'+owner.slice(0,24),reviewFingerprint:request.fingerprint,reviewVersion:request.version,catalogHash:view.catalogHash,sourceCommit:view.catalog.sourceCommit,current:await restoreReference(current),target:await restoreReference(target),approvedAt:now};
 const encoded=canonical(approval),fingerprint=await hash(encoded);
 await db.prepare(`INSERT INTO hosted_restoration_approvals(approval_id,request_id,owner_hash,input_json,approval_json,fingerprint,approved_at)
 SELECT ?,request_id,owner_hash,?,?,?,? FROM hosted_maintenance_reviews WHERE request_id=? AND owner_hash=? AND fingerprint=? AND version=? AND decision='revert-requested'
 AND version=(SELECT MAX(version) FROM hosted_maintenance_reviews WHERE receipt_commit=?) AND (SELECT COUNT(*) FROM hosted_restoration_approvals)<16 ON CONFLICT DO NOTHING`).bind(value.approvalId,raw,encoded,fingerprint,now,value.requestId,owner,request.fingerprint,request.version,current.commit).run();
 const saved=await stored(db,value.approvalId);if(!saved)fail('restoration_approval_capacity_or_superseded');if(saved.owner_hash!==owner||saved.input_json!==raw)fail('restoration_approval_key_conflict');return lookupRestorationApproval(db,value.approvalId,admin,now);
}
export async function revokeRestorationApproval(db:SqlDatabase,id:string,admin:VerifiedAdmin,now=Date.now()){
 const {approval}=await lookupRestorationApproval(db,id,admin,now);await db.prepare('INSERT INTO hosted_restoration_revocations(approval_id,owner_hash,revoked_at) SELECT approval_id,owner_hash,? FROM hosted_restoration_approvals WHERE approval_id=? AND owner_hash=? ON CONFLICT DO NOTHING').bind(now,id,approval.ownerHash).run();return {approvalId:id,revoked:true,articleChanged:false};
}
