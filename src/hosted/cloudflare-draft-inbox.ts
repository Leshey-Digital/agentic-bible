import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash,uuid,type VerifiedAdmin} from './contracts.ts';
import {CloudflareDraftError,type CloudflareDraftAction,type CloudflareDraftInput} from './cloudflare-drafts.ts';

// A saved draft is an inbox suggestion, never a review approval. Replay reads
// the existing row before source acquisition or inference; uncertain unsaved
// outcomes remain closed in the source/AI ledgers and are not retried here.
export async function prepareDraftForInbox(action:CloudflareDraftAction,request:Request,input:unknown,db:SqlDatabase,admin:VerifiedAdmin){
 const fresh=()=>{if(admin.role!=='admin'||admin.csrfVerified!==true||!/^signed-admin:[a-f0-9]{64}$/.test(admin.subject)||admin.expiresAt<=Date.now()||request.signal.aborted)throw new CloudflareDraftError('verified_admin_required',403);};fresh();
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='articleId,citationId,requestKey,sourceId'||!uuid((input as CloudflareDraftInput).requestKey))throw new CloudflareDraftError('invalid_request',400);
 const selected=structuredClone(input) as CloudflareDraftInput,fingerprint=await hash(canonical({kind:'private-ai-draft-selection',owner:admin.subject,input:selected}));
 const read=()=>db.prepare('SELECT id, fingerprint FROM submissions WHERE request_key=?').bind(selected.requestKey).first<{id:string;fingerprint:string}>();
 const prior=await read();fresh();
 if(prior){if(prior.fingerprint!==fingerprint)throw new CloudflareDraftError('draft_request_conflict',409);return {submissionId:prior.id,duplicate:true,approved:false,published:false};}
 const capacity=await db.prepare('SELECT (SELECT COUNT(*) FROM submissions) AS submissions, (SELECT COUNT(*) FROM editorial_audit) AS audit').first<{submissions:number;audit:number}>();fresh();
 if(!capacity||capacity.submissions>=1000||capacity.audit>=16000)throw new CloudflareDraftError('draft_inbox_capacity',503);
 const draft=await action.prepare(request,selected);fresh();
 const pin=draft.sources[0];
 const message=`UNVERIFIED AI DRAFT — NOT EDITORIAL APPROVAL.\n${draft.note}\nCitation: ${draft.citationId}\nBase: ${draft.baseCommit}\nArticle SHA256: ${draft.baseMarkdownSha256}\nSource SHA256: ${pin.rawHash}\nEvidence SHA256: ${pin.evidenceHash}\nPrompt SHA256: ${draft.promptSha256}\nResponse SHA256: ${draft.responseSha256}\nGeneration: ${draft.generation.eventId}`;
 if(message.length>2000)throw new CloudflareDraftError('draft_inbox_capacity',503);
 const id=crypto.randomUUID(),event=crypto.randomUUID(),now=Date.now(),tags='["ai-draft","unverified"]';fresh();
 await db.batch([
  db.prepare(`INSERT INTO submissions (id,request_key,fingerprint,article_id,kind,message,source_url,status,tags,last_event_id,created_at,updated_at)
   SELECT ?,?,?,?,?,?,?,'new',?,?,?,? WHERE (SELECT COUNT(*) FROM submissions)<1000 AND (SELECT COUNT(*) FROM editorial_audit)<16000 ON CONFLICT DO NOTHING`)
   .bind(id,selected.requestKey,fingerprint,draft.articleId,'correction',message,pin.url,tags,event,now,now),
  db.prepare(`INSERT INTO editorial_audit (id,submission_id,actor,action,status,tags,created_at)
   SELECT ?,id,?,'submitted',status,tags,? FROM submissions WHERE id=? AND last_event_id=?`).bind(event,admin.subject,now,id,event)
 ]);
 const saved=await read();if(!saved||saved.fingerprint!==fingerprint)throw new CloudflareDraftError('draft_save_unconfirmed',503);
 return {submissionId:saved.id,duplicate:saved.id!==id,approved:false,published:false};
}
