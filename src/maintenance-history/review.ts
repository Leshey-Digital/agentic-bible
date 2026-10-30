import {readingArticleIds} from '../lib/article-ids.ts';
import {canonical,hash,digest,gitSha,uuid,type VerifiedAdmin} from '../hosted/contracts.ts';
import {ownerHash} from '../hosted/approvals.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
declare const __AGENTIC_MAINTENANCE_CATALOG_SHA256__:string|undefined;
export class MaintenanceReviewError extends Error{code:string;status:number;constructor(code:string,status=409){super(code);this.code=code;this.status=status;}}
function reject(code:string,status=409):never{throw new MaintenanceReviewError(code,status);}
export const historyBindingConfigured=()=>typeof __AGENTIC_MAINTENANCE_CATALOG_SHA256__==='string'&&digest(__AGENTIC_MAINTENANCE_CATALOG_SHA256__);
export type CatalogEntry={articleId?:string;current:boolean;receipt:{schemaVersion:1;mode:'local-synthetic-only'|'hosted-source-backed';state:'canonical-commit-verified';livePublished:false;eventId:string;authorityHash:string;baseCommit:string;commit:string;articleRevision:string;markdownSha256:string;historyPath:string;historySha256:string;flags:string[]}};
export type Catalog={schemaVersion:1|2|3;mode:'controlled-static-preview';enabled:true;sourceCommit:string;noindex:true;history:CatalogEntry[]};
export async function verifiedCatalog(assets:{fetch(request:Request):Promise<Response>}){
 if(!historyBindingConfigured())reject('maintenance_review_unconfigured',503);
 const response=await assets.fetch(new Request('https://staging.agenticbible.si/maintenance-history.json',{signal:AbortSignal.timeout(2000)}));
 if(response.status!==200||Number(response.headers.get('content-length'))>65536)reject('maintenance_catalog_unavailable',503);
 const reader=response.body?.getReader();if(!reader)reject('maintenance_catalog_unavailable',503);const chunks:Uint8Array[]=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>65536){void reader.cancel();reject('maintenance_catalog_unavailable',503);}chunks.push(value);}}finally{reader.releaseLock();}
 const body=new Uint8Array(bytes);let at=0;for(const chunk of chunks){body.set(chunk,at);at+=chunk.length;}
 if(await hash(body)!==__AGENTIC_MAINTENANCE_CATALOG_SHA256__)reject('maintenance_catalog_binding_conflict',503);
 const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
 if(!v||![1,2,3].includes(v.schemaVersion)||v.mode!=='controlled-static-preview'||v.enabled!==true||v.noindex!==true||!gitSha(v.sourceCommit)||!Array.isArray(v.history)||v.history.length>(v.schemaVersion>=2?64:16)||v.history.some((e:any,i:number)=>!e||(v.schemaVersion===1?e.current!==(i===0):!readingArticleIds.includes(e.articleId)||e.current!==!v.history.slice(0,i).some((prior:any)=>prior.articleId===e.articleId))||!e.receipt||e.receipt.schemaVersion!==1||!(v.schemaVersion===3?['local-synthetic-only','hosted-source-backed']:['local-synthetic-only']).includes(e.receipt.mode)||e.receipt.state!=='canonical-commit-verified'||e.receipt.livePublished!==false||!gitSha(e.receipt.commit)||!gitSha(e.receipt.baseCommit)||!digest(e.receipt.articleRevision)||!digest(e.receipt.markdownSha256)||!digest(e.receipt.historySha256)||!digest(e.receipt.authorityHash))||new Set(v.history.map((e:any)=>e.receipt.commit)).size!==v.history.length)reject('maintenance_review_unconfigured',503);
 return {catalog:v as Catalog,catalogHash:__AGENTIC_MAINTENANCE_CATALOG_SHA256__!};
}
type ReviewInput={requestId:string;catalogHash:string;receiptCommit:string;expectedVersion:number;decision:'reviewed'|'follow-up'|'revert-requested';targetCommit:string|null;note:string;confirm:'reviewed-current-revision'};
type Row={request_id:string;owner_hash:string;input_json:string;fingerprint:string;receipt_commit:string;catalog_hash:string;version:number;decision:string;target_commit:string|null;note:string;created_at:number};
const keys=['requestId','catalogHash','receiptCommit','expectedVersion','decision','targetCommit','note','confirm'];
function input(value:any):ReviewInput{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(',')||!uuid(value.requestId)||!digest(value.catalogHash)||!gitSha(value.receiptCommit)||!Number.isSafeInteger(value.expectedVersion)||value.expectedVersion<0||value.expectedVersion>=16||!['reviewed','follow-up','revert-requested'].includes(value.decision)||value.confirm!=='reviewed-current-revision'||typeof value.note!=='string'||value.note!==value.note.trim()||value.note.length<20||value.note.length>1000||/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value.note)||(value.decision==='revert-requested'?!gitSha(value.targetCommit):value.targetCommit!==null))reject('maintenance_review_input',400);
 return structuredClone(value);
}
function auth(admin:VerifiedAdmin){if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||typeof admin.subject!=='string'||!/^signed-admin:[a-f0-9]{64}$/.test(admin.subject))reject('verified_admin_required',403);}
async function integrity(row:Row){let value:ReviewInput;try{value=input(JSON.parse(row.input_json));}catch{return reject('maintenance_review_corrupt',503);}if(row.request_id!==value.requestId||!digest(row.owner_hash)||await hash(canonical({owner:row.owner_hash,input:value,createdAt:row.created_at}))!==row.fingerprint||row.receipt_commit!==value.receiptCommit||row.catalog_hash!==value.catalogHash||row.version!==value.expectedVersion+1||row.decision!==value.decision||row.target_commit!==value.targetCommit||row.note!==value.note||!Number.isSafeInteger(row.created_at)||row.created_at<0)reject('maintenance_review_corrupt',503);return value;}
function result(row:Row){return {requestId:row.request_id,receiptCommit:row.receipt_commit,catalogHash:row.catalog_hash,version:row.version,decision:row.decision,targetCommit:row.target_commit,note:row.note,reviewerRef:'admin-'+row.owner_hash.slice(0,24),createdAt:row.created_at,articleChanged:false,flagsRemoved:false};}
export async function listMaintenanceReviews(db:SqlDatabase,admin:VerifiedAdmin,view:Awaited<ReturnType<typeof verifiedCatalog>>){auth(admin);const rows=(await db.prepare('SELECT * FROM hosted_maintenance_reviews ORDER BY created_at,request_id LIMIT 64').all<Row>()).results;for(const row of rows)await integrity(row);return {...view,reviewerRef:'admin-'+(await ownerHash(admin)).slice(0,24),reviews:rows.map(result),scope:'controlled-published-build-only',canonicalRevertSupported:false};}
export async function saveMaintenanceReview(db:SqlDatabase,admin:VerifiedAdmin,value:unknown,view:Awaited<ReturnType<typeof verifiedCatalog>>,now=Date.now()){
 auth(admin);const v=input(value),owner=await ownerHash(admin),raw=canonical(v),fingerprint=await hash(canonical({owner,input:v,createdAt:now}));
 const get=()=>db.prepare('SELECT * FROM hosted_maintenance_reviews WHERE request_id=?').bind(v.requestId).first<Row>();
 const replay=async(row:Row)=>{await integrity(row);if(row.owner_hash!==owner||row.input_json!==raw)reject('maintenance_review_key_conflict');return {...result(row),replayed:true,current:view.catalog.history.some(e=>e.current&&e.receipt.commit===row.receipt_commit)};};
 const existing=await get();if(existing)return replay(existing);
 const selected=view.catalog.history.find(e=>e.current&&e.receipt.commit===v.receiptCommit);if(v.catalogHash!==view.catalogHash||!selected)reject('maintenance_review_stale_revision');
 if(v.decision==='revert-requested'&&!view.catalog.history.some(e=>!e.current&&e.receipt.commit===v.targetCommit&&(e.articleId??'tool-use')===(selected.articleId??'tool-use')))reject('maintenance_review_revert_target');
 // D1 serializes this single immutable admission. Concurrent version losers cannot
 // write a follow-up audit. Replay uses the original exact payload and owner.
 await db.prepare(`INSERT INTO hosted_maintenance_reviews(request_id,owner_hash,input_json,fingerprint,receipt_commit,catalog_hash,version,decision,target_commit,note,created_at)
 SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM hosted_maintenance_reviews)<64 AND COALESCE((SELECT MAX(version) FROM hosted_maintenance_reviews WHERE receipt_commit=?),0)=? ON CONFLICT DO NOTHING`).bind(v.requestId,owner,raw,fingerprint,v.receiptCommit,v.catalogHash,v.expectedVersion+1,v.decision,v.targetCommit,v.note,now,v.receiptCommit,v.expectedVersion).run();
 const row=await get();if(row){if(row.owner_hash!==owner||row.input_json!==raw)reject('maintenance_review_key_conflict');await integrity(row);return {...result(row),replayed:false,current:true};}
 const count=await db.prepare('SELECT COUNT(*) n FROM hosted_maintenance_reviews').first<{n:number}>();reject(count&&count.n>=64?'maintenance_review_capacity':'maintenance_review_stale_version');
}

// Server-only immutable authority lookup. The note remains private; this is not a
// claim that a request alone authorizes canonical restoration.
export async function reviewedRevertAuthority(db:SqlDatabase,id:string,admin:VerifiedAdmin){
 auth(admin);if(!uuid(id))reject('maintenance_review_input',400);
 const row=await db.prepare('SELECT * FROM hosted_maintenance_reviews WHERE request_id=?').bind(id).first<Row>();
 if(!row)reject('restoration_review_required',403);const value=await integrity(row);
 if(row.owner_hash!==await ownerHash(admin)||value.decision!=='revert-requested')reject('restoration_review_required',403);
 const latest=await db.prepare('SELECT MAX(version) n FROM hosted_maintenance_reviews WHERE receipt_commit=?').bind(row.receipt_commit).first<{n:number}>();
 return {input:value,fingerprint:row.fingerprint,version:row.version,owner:row.owner_hash,latest:latest?.n===row.version};
}
