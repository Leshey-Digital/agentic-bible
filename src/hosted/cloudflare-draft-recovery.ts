import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash,uuid,type VerifiedAdmin} from './contracts.ts';
import {CloudflareDraftError,type CloudflareDraftInput} from './cloudflare-drafts.ts';
import {cloudflareProseIdentity,cloudflareProseModel,type ProseDraft} from '../maintenance-adapters/cloudflare-prose.ts';
import {finishSourcedDraft,readSourcedDraftPrompt} from '../maintenance-adapters/sourced-draft.ts';
import {extractionProfile} from '../maintenance-adapters/profiles.ts';
import {hostedTarget} from './targets.ts';
import {MaintenanceBudget} from '../wiki-bridge/maintenance-budget.ts';
import {canonical as ledgerCanonical,hash as ledgerHash} from '../publishing/contracts.ts';

type Checkpoint={prompt:string;maxOutputTokens:number};
type Outbox={request_key:string;owner:string;fingerprint:string;selection:string;created_at:number;prompt:string|null;prompt_hash:string|null;max_tokens:number|null;event_id:string|null};
function fail(code:string,status=503):never{throw new CloudflareDraftError(code,status);}
export function draftFresh(request:Request,admin:VerifiedAdmin){
 if(admin.role!=='admin'||admin.csrfVerified!==true||!/^signed-admin:[a-f0-9]{64}$/.test(admin.subject)||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||request.signal.aborted)fail('verified_admin_required',403);
}
export async function draftSelection(input:unknown,admin:VerifiedAdmin){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='articleId,citationId,requestKey,sourceId'||!uuid((input as CloudflareDraftInput).requestKey))fail('invalid_request',400);
 const selected=structuredClone(input) as CloudflareDraftInput;
 if(!hostedTarget(selected.articleId)||!extractionProfile(selected.sourceId)||typeof selected.citationId!=='string'||selected.citationId.length<1||selected.citationId.length>48)fail('invalid_request',400);
 return {selected,fingerprint:await hash(canonical({kind:'private-ai-draft-selection',owner:admin.subject,input:selected}))};
}
export async function readDraftOutbox(db:SqlDatabase,key:string,admin:VerifiedAdmin){
 if(!uuid(key))fail('invalid_request',400);
 const row=await db.prepare('SELECT * FROM hosted_draft_outbox WHERE request_key=?').bind(key).first<Outbox>();
 // Foreign owners cannot discover a request or its selected article/source.
 if(row&&row.owner!==admin.subject)fail('draft_not_found',404);
 return row;
}
export async function claimDraft(db:SqlDatabase,selected:CloudflareDraftInput,fingerprint:string,admin:VerifiedAdmin){
 const inserted=await db.prepare(`INSERT INTO hosted_draft_outbox(request_key,owner,fingerprint,selection,created_at)
  SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM hosted_draft_outbox)<16 ON CONFLICT DO NOTHING`)
  .bind(selected.requestKey,admin.subject,fingerprint,canonical(selected),Date.now()).run();
 const row=await readDraftOutbox(db,selected.requestKey,admin);
 if(row&&row.fingerprint!==fingerprint)fail('draft_request_conflict',409);
 if(inserted.meta.changes!==1)fail(row?'draft_recovery_required':'draft_outbox_capacity',row?409:503);
 return async(checkpoint:Checkpoint)=>{
  const {prompt,maxOutputTokens}=checkpoint,{eventId}=cloudflareProseIdentity(prompt,maxOutputTokens),promptHash=await hash(prompt);
  const result=await db.prepare(`UPDATE hosted_draft_outbox SET prompt=?,prompt_hash=?,max_tokens=?,event_id=?
   WHERE request_key=? AND owner=? AND fingerprint=? AND selection=? AND prompt IS NULL`)
   .bind(prompt,promptHash,maxOutputTokens,eventId,selected.requestKey,admin.subject,fingerprint,canonical(selected)).run();
  const saved=await readDraftOutbox(db,selected.requestKey,admin);
  if(result.meta.changes!==1||saved?.prompt!==prompt||saved.prompt_hash!==promptHash||saved.event_id!==eventId||saved.max_tokens!==maxOutputTokens)fail('draft_checkpoint_unconfirmed');
 };
}
// A trusted, retained pre-dispatch prompt plus the existing settled paid result
// are the only recovery inputs. This function has no source/model/transport port.
export async function retainedDraft(db:SqlDatabase,row:Outbox){
 try{
  const selected=JSON.parse(row.selection) as CloudflareDraftInput;
  if(canonical(selected)!==row.selection||selected.requestKey!==row.request_key||(await draftSelection(selected,{subject:row.owner} as VerifiedAdmin)).fingerprint!==row.fingerprint)fail('draft_checkpoint_invalid');
  if(!row.prompt||!row.prompt_hash||!row.max_tokens||!row.event_id)fail('draft_output_unavailable',409);
  const identity=cloudflareProseIdentity(row.prompt,row.max_tokens);
  if(await hash(row.prompt)!==row.prompt_hash||identity.eventId!==row.event_id)fail('draft_checkpoint_invalid');
  const data=await readSourcedDraftPrompt(row.prompt),profile=extractionProfile(selected.sourceId);
  if(data.article.articleId!==selected.articleId||data.sources.length!==1||!profile)fail('draft_checkpoint_invalid');
  const source=data.sources[0];
  if(source.sourceId!==selected.sourceId||source.citationId!==selected.citationId||source.url!==profile.url||source.receipt.requestKey!==selected.requestKey)fail('draft_checkpoint_invalid');
  const budget=new MaintenanceBudget(db),paid=await budget.job(row.event_id);
  if(!paid||!['ready','complete'].includes(paid.state)||paid.currency_state!=='settled'||!paid.packet||ledgerHash(paid.packet)!==paid.packet_hash)fail('draft_output_unavailable',409);
  const packet=JSON.parse(paid.packet);
  if(packet.kind!=='cloudflare-prose-draft'||packet.schemaVersion!==2||packet.provider!=='cloudflare-workers-ai'||packet.model!==cloudflareProseModel||packet.priceId!==paid.currency_price_id||packet.requestHash!==identity.requestHash||packet.draftHash!==ledgerHash(packet.response)||packet.costUpperBoundMicroUsd!==paid.currency_reserved||packet.costSettledMicroUsd!==paid.currency_actual||paid.output_tokens!==row.max_tokens||ledgerCanonical(packet)!==paid.packet)fail('draft_checkpoint_invalid');
  if(paid.response!==ledgerCanonical({draftHash:packet.draftHash,usage:packet.usage,provider:packet.provider,model:packet.model})||paid.actual_cost!==packet.usage.inputTokens+packet.usage.outputTokens)fail('draft_checkpoint_invalid');
  const receipt={schemaVersion:1,provider:packet.provider,model:packet.model,priceId:packet.priceId,requestHash:packet.requestHash,usage:packet.usage,costUpperBoundMicroUsd:packet.costUpperBoundMicroUsd,costSettledMicroUsd:packet.costSettledMicroUsd,draftHash:packet.draftHash};
  if(paid.state==='complete'&&paid.receipt!==ledgerCanonical(receipt))fail('draft_checkpoint_invalid');
  await budget.verifyStoredCurrency(paid,packet.usage,true);
  const active=await db.prepare('SELECT policy_json,policy_hash FROM maintenance_currency_policy WHERE id=1').first<{policy_json:string;policy_hash:string}>();
  if(!active)fail('draft_checkpoint_invalid');await budget.validateCurrencyHistory(active);
  const generation:ProseDraft={kind:'unverified-prose-draft',model:packet.model,text:packet.response,usage:packet.usage,costUpperBoundMicroUsd:packet.costUpperBoundMicroUsd,costSettledMicroUsd:packet.costSettledMicroUsd,eventId:row.event_id};
  return await finishSourcedDraft(row.prompt,generation);
 }catch(error){if(error instanceof CloudflareDraftError)throw error;return fail('draft_checkpoint_invalid');}
}
