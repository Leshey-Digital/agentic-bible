import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
import {HttpObservationStore,type HttpLease} from '../monitoring/http-store.ts';
import {createWorkersHttpPass} from '../monitoring/http-workers.ts';
import {HttpError,type HttpResult,type WebFetch} from '../monitoring/http-core.ts';
import {officialSource} from '../monitoring/http-registry.ts';
import {sourceData} from '../wiki-bridge/maintenance-provider.ts';
import {validateEvidence,type Evidence} from '../wiki-bridge/contracts.ts';
import {CollectionFiles,collectionLimits,stop,uuid} from './files.ts';
export {CollectionError,CollectionFiles,collectionLimits} from './files.ts';
type Selection={sourceId:string;citationId:string;requestKey:string};
type Row={request_key:string;source_id:string;citation_id:string;fingerprint:string;owner:string;state:'capturing'|'prepared'|'ready'|'stopped';created_at:number;body_hash:string|null;body_bytes:number|null;journal:string|null;journal_hash:string|null};
type Context={enabled?:boolean;transport?:{kind:'controlled-source-fixture';send:WebFetch};db:SqlDatabase;collectionName:string;clock?:()=>number;checkpoint?:(phase:'charged'|'body-written'|'prepared'|'http-complete'|'ready')=>void|Promise<void>};
function input(value:unknown):Selection{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='citationId,requestKey,sourceId')stop('collection_invalid_selection');
 const v=value as Selection;if(!officialSource(v.sourceId)||typeof v.citationId!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(v.citationId)||!uuid(v.requestKey))stop('collection_invalid_selection');return {...v};
}
// Local trusted-code coordinator only. No route, schedule, credentials or default fetch.
export async function collectMaintenanceSource(value:unknown,context:Context){
 if(context.enabled!==true||context.transport?.kind!=='controlled-source-fixture'||typeof context.transport.send!=='function')stop('collection_disabled');
 const selection=input(value),clock=context.clock??Date.now,now=clock();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('collection_invalid_clock');
 const files=new CollectionFiles(context.collectionName),fingerprint=hash(canonical({selection,root:files.root,profile:'original-plain-utf8-2048-v1'})),owner=crypto.randomUUID(),store=new HttpObservationStore(context.db);
 const get=async()=>context.db.prepare('SELECT * FROM maintenance_source_collections WHERE request_key=?').bind(selection.requestKey).first<Row>();
 let row:Row|null,inserted:number;
 try{const result=await context.db.prepare(`INSERT INTO maintenance_source_collections(request_key,source_id,citation_id,fingerprint,owner,state,created_at)
  SELECT ?,?,?,?,?,'capturing',? WHERE (SELECT COUNT(*) FROM maintenance_source_collections)<16
  AND NOT EXISTS(SELECT 1 FROM maintenance_source_collections WHERE created_at>?) ON CONFLICT DO NOTHING`).bind(selection.requestKey,selection.sourceId,selection.citationId,fingerprint,owner,now,now).run();inserted=result.meta.changes;row=await get();}catch{return stop('collection_accounting_unavailable');}
 if(!row)stop('collection_capacity_or_clock');if(row.fingerprint!==fingerprint||row.source_id!==selection.sourceId||row.citation_id!==selection.citationId)stop('collection_key_conflict');
 const evidence=(record:Row):Evidence=>({citationId:selection.citationId,sourceId:selection.sourceId,url:officialSource(selection.sourceId)!.url,receiptKey:selection.requestKey,bodyHash:record.body_hash!,file:files.file(selection.requestKey)});
 async function resume(record:Row){
  if(!record.journal||!record.journal_hash||!record.body_hash||!Number.isSafeInteger(record.body_bytes)||record.body_bytes!<1||record.body_bytes!>collectionLimits.bodyBytes)stop('collection_journal_corrupt');
  let journal:{lease:HttpLease;result:Extract<HttpResult,{ok:true}>};try{journal=JSON.parse(record.journal);}catch{return stop('collection_journal_corrupt');}
  if(hash(canonical(journal))!==record.journal_hash||!journal.lease||!journal.result||journal.lease.key!==selection.requestKey||journal.lease.sourceId!==selection.sourceId||!uuid(journal.lease.token)||!Number.isSafeInteger(journal.lease.version)||journal.lease.version<0||!Number.isSafeInteger(journal.lease.attempt)||journal.lease.attempt<1||journal.lease.attempt>3||journal.result.ok!==true||journal.result.state?.sourceId!==selection.sourceId||journal.result.state?.mode!=='http'||journal.result.state?.hash!==record.body_hash||journal.result.observation?.hash!==record.body_hash||journal.result.observation?.bytes!==record.body_bytes||!['baseline','changed','unchanged'].includes(journal.result.observation?.kind)||!Number.isSafeInteger(journal.result.state?.checkedAt)||journal.result.state.checkedAt<0||journal.result.state.checkedAt>clock())stop('collection_journal_corrupt');
  sourceData(selection.citationId,record.body_hash,files.read(selection.requestKey,record.body_hash,record.body_bytes!));
  const entry=evidence(record);let verified;
  try{verified=await validateEvidence({evidence:[entry]},context.db,files.bodies);}catch(error){
   if(record.state==='ready'||!(error instanceof Error)||!('code' in error)||error.code!=='uncharged_observation')throw error;
   const active=await context.db.prepare(`SELECT j.source_id,j.state,j.attempts,j.lease_token,j.lease_until,r.token,r.outcome,r.attempt,r.day,b.day AS budget_day,b.used,
    (SELECT COUNT(*) FROM http_request_reservations charged WHERE charged.day=r.day) AS day_count
    FROM http_check_jobs j JOIN http_request_reservations r ON r.token=j.lease_token AND r.request_key=j.request_key JOIN http_request_budget b ON b.id=1 WHERE j.request_key=?`).bind(selection.requestKey).first<{source_id:string;state:string;attempts:number;lease_token:string;lease_until:number;token:string;outcome:string;attempt:number;day:number;budget_day:number;used:number;day_count:number}>();
   const source=await store.source(selection.sourceId);
   const charged=active&&active.source_id===selection.sourceId&&active.state==='running'&&active.lease_token===journal.lease.token&&active.token===journal.lease.token&&active.outcome==='reserved'&&active.attempt===journal.lease.attempt&&active.attempts===journal.lease.attempt&&active.lease_until>clock()&&active.budget_day>=active.day&&active.day_count>=1&&active.day_count<=20&&active.used>=0&&active.used<=20&&(active.budget_day!==active.day||active.used>=active.day_count)&&source?.version===journal.lease.version&&canonical(source.lastGood)===canonical(journal.lease.lastGood);
   if(!charged||!await store.finish(journal.lease,journal.result,clock())){
    // Another completed replay may have won. Verify actual authority rather than fabricate success.
    try{verified=await validateEvidence({evidence:[entry]},context.db,files.bodies);}catch{return stop('collection_http_completion_unconfirmed');}
   }else{await context.checkpoint?.('http-complete');verified=await validateEvidence({evidence:[entry]},context.db,files.bodies);}
  }
  if(record.state!=='ready'){
   const changed=await context.db.prepare(`UPDATE maintenance_source_collections SET state='ready' WHERE request_key=? AND fingerprint=? AND owner=? AND state='prepared' AND journal_hash=?`).bind(selection.requestKey,fingerprint,record.owner,record.journal_hash).run();
   if(changed.meta.changes!==1){const current=await get();if(current?.state!=='ready'||current.fingerprint!==fingerprint||current.owner!==record.owner||current.journal_hash!==record.journal_hash)stop('collection_completion_unconfirmed');}
  }
  await context.checkpoint?.('ready');return {mode:'local-synthetic-only' as const,evidence:entry,sourceDirectory:files.bodies,bytes:record.body_bytes!,observedAt:verified!.bindings[0].observedAt};
 }
 if(row.state==='prepared'||row.state==='ready')return resume(row);
 if(inserted!==1||row.owner!==owner)stop(row.state==='stopped'?'collection_stopped_no_retry':'collection_capture_unconfirmed_no_retry');
 files.begin(selection.requestKey);
 const stopped=async()=>{await context.db.prepare(`UPDATE maintenance_source_collections SET state='stopped' WHERE request_key=? AND owner=? AND state='capturing'`).bind(selection.requestKey,owner).run();};
 await store.enqueue(selection.sourceId,selection.requestKey,clock());const lease=await store.claim(selection.requestKey,clock());if(!lease){await stopped();return stop('collection_http_not_admitted');}
 await context.checkpoint?.('charged');
 const chunks:Uint8Array[]=[];let length=0,complete=false;
 const send:WebFetch=async(url,options)=>{
  const response=await context.transport!.send(url,options),discard=()=>{void response.body?.cancel().catch(()=>{});};
  if(options.signal.aborted){discard();throw new HttpError('http_aborted',true);}
  if(response.redirected||(response.url&&response.url!==url)){discard();throw new HttpError('redirect_blocked');}
  if(response.status!==200)return response;
  if(!/^text\/plain(?:;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(response.headers.get('Content-Type')??'')){discard();throw new HttpError('collection_plain_text_required');}
  const declared=response.headers.get('Content-Length');if(declared!==null&&Number(declared)>collectionLimits.bodyBytes){discard();throw new HttpError('collection_body_limit');}
  const reader=response.body?.getReader();if(!reader){discard();throw new HttpError('empty_body');}
  const tapped=new ReadableStream<Uint8Array>({async pull(controller){try{const part=await reader.read();if(part.done){complete=true;controller.close();return;}if(!(part.value instanceof Uint8Array)||length+part.value.byteLength>collectionLimits.bodyBytes){void reader.cancel().catch(()=>{});throw new HttpError('collection_body_limit');}length+=part.value.byteLength;chunks.push(part.value.slice());controller.enqueue(part.value);}catch(error){controller.error(error);}},cancel(){return reader.cancel();}});
  return new Response(tapped,{status:response.status,headers:response.headers});
 };
 let result=await createWorkersHttpPass(send,clock).check(lease.sourceId,lease.lastGood);
 if(result.ok&&result.observation.kind!=='not-modified'){
  const bytes=Buffer.concat(chunks);try{if(!complete||bytes.length!==result.observation.bytes||hash(bytes)!==result.state.hash)stop('collection_capture_mismatch');sourceData(selection.citationId,result.state.hash,bytes);}catch{result={ok:false,state:lease.lastGood,error:{code:'collection_source_profile',retryable:false}};}
  if(result.ok){
   files.put(selection.requestKey,bytes);await context.checkpoint?.('body-written');const journal=canonical({lease,result});if(Buffer.byteLength(journal)>4096)stop('collection_journal_limit');
   const changed=await context.db.prepare(`UPDATE maintenance_source_collections SET state='prepared',body_hash=?,body_bytes=?,journal=?,journal_hash=? WHERE request_key=? AND fingerprint=? AND owner=? AND state='capturing'`).bind(result.state.hash,bytes.length,journal,hash(journal),selection.requestKey,fingerprint,owner).run();if(changed.meta.changes!==1)stop('collection_prepare_unconfirmed');
   await context.checkpoint?.('prepared');row=await get();if(!row||row.state!=='prepared')stop('collection_prepare_unconfirmed');return resume(row);
  }
 }
 // Failure/304 may remain valid monitoring outcomes, but never supplies new original-body evidence.
 if(!await store.finish(lease,result,clock()))stop('collection_http_completion_unconfirmed');await stopped();return stop(result.ok?'collection_304_requires_original_200':'collection_source_rejected');
}
