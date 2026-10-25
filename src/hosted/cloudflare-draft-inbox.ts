import type {SqlDatabase} from '../editorial/contracts.ts';
import {type VerifiedAdmin} from './contracts.ts';
import {draftFresh,draftSelection,claimDraft,readDraftOutbox,retainedDraft} from './cloudflare-draft-recovery.ts';
import {CloudflareDraftError,type CloudflareDraftAction,type CloudflareDraftResult,type CloudflareDraftInput} from './cloudflare-drafts.ts';

// Inbox writes are independent of inference. The checkpoint is durable before
// dispatch; any replay of an unsaved request requires explicit offline recovery.
export async function prepareDraftForInbox(action:CloudflareDraftAction,request:Request,input:unknown,db:SqlDatabase,admin:VerifiedAdmin){
 const fresh=()=>draftFresh(request,admin);fresh();
 const {selected,fingerprint}=await draftSelection(input,admin);
 const prior=await savedDraft(db,selected.requestKey,fingerprint);fresh();if(prior)return prior;
 const capacity=await db.prepare('SELECT (SELECT COUNT(*) FROM submissions) AS submissions, (SELECT COUNT(*) FROM editorial_audit) AS audit').first<{submissions:number;audit:number}>();fresh();
 if(!capacity||capacity.submissions>=1000||capacity.audit>=16000)throw new CloudflareDraftError('draft_inbox_capacity',503);
 const retain=await claimDraft(db,selected,fingerprint,admin);fresh();
 const draft=await action.prepare(request,selected,retain);fresh();
 const checkpoint=await readDraftOutbox(db,selected.requestKey,admin);fresh();
 if(!checkpoint?.prompt||checkpoint.event_id!==draft.generation.eventId||checkpoint.prompt_hash!==draft.promptSha256||draft.articleId!==selected.articleId||draft.citationId!==selected.citationId||draft.sources[0]?.sourceId!==selected.sourceId||draft.sources[0]?.receipt.requestKey!==selected.requestKey)throw new CloudflareDraftError('draft_checkpoint_invalid',503);
 return saveDraft(db,selected,fingerprint,draft,admin,fresh);
}
async function savedDraft(db:SqlDatabase,key:string,fingerprint:string){
 const row=await db.prepare('SELECT id, fingerprint FROM submissions WHERE request_key=?').bind(key).first<{id:string;fingerprint:string}>();
 if(!row)return null;if(row.fingerprint!==fingerprint)throw new CloudflareDraftError('draft_request_conflict',409);
 return {submissionId:row.id,duplicate:true,approved:false,published:false};
}
export async function recoverDraftForInbox(request:Request,key:string,db:SqlDatabase,admin:VerifiedAdmin){
 const fresh=()=>draftFresh(request,admin);fresh();
 const row=await readDraftOutbox(db,key,admin);fresh();
 if(!row)throw new CloudflareDraftError('draft_not_found',404);
 const selected=JSON.parse(row.selection) as CloudflareDraftInput;
 const {fingerprint}=await draftSelection(selected,admin);
 if(fingerprint!==row.fingerprint)throw new CloudflareDraftError('draft_checkpoint_invalid',503);
 const saved=await savedDraft(db,key,fingerprint);fresh();if(saved)return saved;
 const draft=await retainedDraft(db,row);fresh();
 return saveDraft(db,selected,fingerprint,draft,admin,fresh);
}
async function saveDraft(db:SqlDatabase,selected:CloudflareDraftInput,fingerprint:string,draft:CloudflareDraftResult,admin:VerifiedAdmin,fresh:()=>void){
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
 const saved=await savedDraft(db,selected.requestKey,fingerprint);if(!saved)throw new CloudflareDraftError('draft_save_unconfirmed',503);
 return {...saved,duplicate:saved.submissionId!==id};
}
