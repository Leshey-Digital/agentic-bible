import type {SqlDatabase} from '../editorial/contracts.ts';
import {digest} from '../editorial/validation.ts';
import {checkedManifest} from './articles.ts';
import {canonicalOrigin,articleIds} from './policy.ts';
export type IndexingConfiguration={enabled:boolean;provider:'indexnow'|null;origin:string|null;ownershipVerified:boolean};
export const disabledIndexing:Readonly<IndexingConfiguration>=Object.freeze({enabled:false,provider:null,origin:null,ownershipVerified:false});
// Deliberately no HTTP transport is registered. A future verified integration must supply this capability.
export type IndexingProvider={id:'indexnow';origin:string;ownershipVerified:true;supports:'canonical-article-updates';notify:(input:{id:string;url:string;revision:string;signal:AbortSignal})=>Promise<{status:200|202}>};
type Notification={id:string;event_key:string;provider:string;url:string;revision:string;state:'pending'|'inflight'|'acknowledged'|'uncertain';attempts:number;token:string|null;acknowledgment:200|202|null};
type Receipt={eventKey:string;ids:string[]};
export class IndexingError extends Error{code:string;constructor(code:string){super(code);this.code=code;}}
const fail=(code:string):never=>{throw new IndexingError(code);};
function configured(config:IndexingConfiguration){
  if(config.enabled!==true)return 'disabled';
  if(config.provider!=='indexnow'||config.ownershipVerified!==true||!config.origin)return 'provider-not-configured';
  try{canonicalOrigin(config.origin);}catch{return 'provider-not-configured';}return null;
}
function capability(config:IndexingConfiguration,provider?:IndexingProvider){
  return !!provider&&provider.id==='indexnow'&&provider.origin===config.origin&&provider.ownershipVerified===true&&provider.supports==='canonical-article-updates'&&typeof provider.notify==='function';
}
export async function enqueueIndexing(db:SqlDatabase,value:unknown,eventKey:string,config:IndexingConfiguration=disabledIndexing){
  const reason=configured(config);if(reason)return {status:reason,ids:[]};
  const manifest=checkedManifest(value);
  if(manifest.mode!=='canonical'||manifest.origin!==config.origin||!manifest.entries.length)return {status:'ineligible-build',ids:[]};
  if(typeof eventKey!=='string'||eventKey!==eventKey.trim()||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(eventKey))return fail('invalid_indexing_event');
  const fingerprint=await digest(JSON.stringify(manifest));
  const prior=await db.prepare('SELECT fingerprint,receipt FROM indexing_enqueue_receipts WHERE event_key=?').bind(eventKey).first<{fingerprint:string;receipt:string}>();
  if(prior){if(prior.fingerprint!==fingerprint)return fail('indexing_event_conflict');return {status:'queued',...JSON.parse(prior.receipt) as Receipt};}
  const ids=await Promise.all(manifest.entries.map(e=>digest(JSON.stringify(['indexnow',eventKey,e.url,e.revision]))));const receipt:Receipt={eventKey,ids};
  await db.batch([
    db.prepare(`INSERT INTO indexing_enqueue_receipts(event_key,fingerprint,receipt) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM indexing_enqueue_receipts)<32 AND (SELECT COUNT(*) FROM indexing_notifications)+?<=96 ON CONFLICT DO NOTHING`).bind(eventKey,fingerprint,JSON.stringify(receipt),manifest.entries.length),
    ...manifest.entries.map((e,i)=>db.prepare(`INSERT INTO indexing_notifications(id,event_key,provider,url,revision) SELECT ?,?,'indexnow',?,? WHERE EXISTS(SELECT 1 FROM indexing_enqueue_receipts WHERE event_key=? AND fingerprint=?) ON CONFLICT DO NOTHING`).bind(ids[i],eventKey,e.url,e.revision,eventKey,fingerprint))
  ]);
  const stored=await db.prepare('SELECT fingerprint,receipt FROM indexing_enqueue_receipts WHERE event_key=?').bind(eventKey).first<{fingerprint:string;receipt:string}>();
  if(!stored)return fail('indexing_capacity');if(stored.fingerprint!==fingerprint)return fail('indexing_event_conflict');return {status:'queued',...JSON.parse(stored.receipt) as Receipt};
}
function supportedRow(row:Notification,config:IndexingConfiguration){
  return row.provider==='indexnow'&&articleIds.some(id=>row.url===`${config.origin}/articles/${id}/`)&&/^[a-f0-9]{64}$/.test(row.revision);
}
export async function deliverIndexing(db:SqlDatabase,id:string,config:IndexingConfiguration=disabledIndexing,provider?:IndexingProvider){
  const reason=configured(config);if(reason)return {status:reason};if(!capability(config,provider))return {status:'provider-not-configured'};
  if(typeof id!=='string'||id.length!==64||!/^[a-f0-9]{64}$/.test(id))return fail('invalid_indexing_id');
  let row=await db.prepare('SELECT * FROM indexing_notifications WHERE id=?').bind(id).first<Notification>();
  if(!row||!supportedRow(row,config))return fail('invalid_indexing_notification');
  if(row.state==='acknowledged')return {status:'acknowledged',id,acknowledgment:row.acknowledgment,indexed:'unknown'};
  if(row.state!=='pending')return {status:'outcome-uncertain-explicit-recovery-required',id};
  if(row.attempts>=3)return fail('indexing_attempts_exhausted');
  const token=crypto.randomUUID();const claimed=await db.prepare("UPDATE indexing_notifications SET state='inflight',token=?,attempts=attempts+1 WHERE id=? AND state='pending' AND attempts<3").bind(token,id).run();
  if(!claimed.meta.changes)return {status:'not-claimed',id};
  const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const result=await Promise.race([provider!.notify({id,url:row.url,revision:row.revision,signal:abort.signal}),new Promise<never>((_done,reject)=>{timer=setTimeout(()=>{abort.abort();reject(new Error('deadline'));},2000);})]);
    if(!result||![200,202].includes(result.status))throw new Error('invalid acknowledgment');
    await db.prepare("UPDATE indexing_notifications SET state='acknowledged',acknowledgment=? WHERE id=? AND state='inflight' AND token=?").bind(result.status,id,token).run();
    row=await db.prepare('SELECT * FROM indexing_notifications WHERE id=?').bind(id).first<Notification>();if(row?.state!=='acknowledged'||row.token!==token)return {status:'outcome-uncertain-explicit-recovery-required',id};
    return {status:'acknowledged',id,acknowledgment:row.acknowledgment,indexed:'unknown'};
  }catch{
    await db.prepare("UPDATE indexing_notifications SET state='uncertain' WHERE id=? AND state='inflight' AND token=?").bind(id,token).run();return {status:'outcome-uncertain-explicit-recovery-required',id};
  }finally{if(timer)clearTimeout(timer);abort.abort();}
}
export async function retryIndexing(db:SqlDatabase,id:string,expectedAttempt:number,config:IndexingConfiguration=disabledIndexing){
  const reason=configured(config);if(reason)return {status:reason};
  if(typeof id!=='string'||id.length!==64||!/^[a-f0-9]{64}$/.test(id)||!Number.isInteger(expectedAttempt)||expectedAttempt<1||expectedAttempt>3)return fail('invalid_indexing_retry');
  const row=await db.prepare('SELECT * FROM indexing_notifications WHERE id=?').bind(id).first<Notification>();if(!row||!supportedRow(row,config))return fail('invalid_indexing_notification');
  // Explicit recovery also covers process death while inflight. The operator must first stop the previous sender.
  if(row.attempts!==expectedAttempt)return fail('stale_indexing_attempt');if(row.attempts>=3)return fail('indexing_attempts_exhausted');
  const result=await db.prepare("UPDATE indexing_notifications SET state='pending',token=NULL WHERE id=? AND attempts=? AND state IN ('inflight','uncertain')").bind(id,expectedAttempt).run();
  return {status:result.meta.changes?'retry-queued':row.state};
}
