import type {SqlDatabase} from '../editorial/contracts.ts';
import {HttpObservationStore} from '../monitoring/http-store.ts';
import {createWorkersHttpPass} from '../monitoring/http-workers.ts';
import {HttpError,type HttpResult,type WebFetch} from '../monitoring/http-core.ts';
import {sourceBodyLimit} from '../monitoring/http-registry.ts';
import {canonical,exact,extractionProfile,reject,SourceAdapterError} from './profiles.ts';
import {extractMaintenanceSource,validateExtractedSource,type ExtractedSource} from './extraction.ts';

type Selection={sourceId:string;requestKey:string};
export type AcquisitionReceipt={requestKey:string;observedAt:number;reservationToken:string;day:number;attempt:number};
export type AcquiredSource={source:ExtractedSource;receipt:AcquisitionReceipt};
type Context={enabled?:boolean;db:SqlDatabase;send?:WebFetch;clock?:()=>number};
export type SourceVerificationContext={db:SqlDatabase;clock?:()=>number;historicalReplay?:boolean};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function selection(value:unknown):Selection{
  exact(value,['sourceId','requestKey']);const profile=extractionProfile(value.sourceId);
  if(!profile)reject('adapter_profile_not_registered');if(!uuid(value.requestKey))reject('adapter_invalid_key');
  return {sourceId:profile.sourceId,requestKey:value.requestKey};
}
function timestamp(clock:()=>number){const now=clock();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)reject('adapter_invalid_clock');return now;}
type ReceiptRow={source_id:string;state:string;attempts:number;result:string;finished_token:string;token:string;outcome:string;attempt:number;day:number;actual_bytes:number|null;actual_download_bytes?:number|null;budget_day:number;used:number;day_count:number};
async function receiptFor(source:ExtractedSource,key:string,db:SqlDatabase,now:number,historicalReplay=false):Promise<AcquisitionReceipt>{
  let row:ReceiptRow|null;
  try{row=await db.prepare(`SELECT j.source_id,j.state,j.attempts,j.result,j.finished_token,r.token,r.outcome,r.attempt,r.day,r.*,b.day AS budget_day,b.used,
    (SELECT COUNT(*) FROM http_request_reservations charged WHERE charged.day=r.day) AS day_count
    FROM http_check_jobs j JOIN http_request_reservations r ON r.token=j.finished_token AND r.request_key=j.request_key JOIN http_request_budget b ON b.id=1 WHERE j.request_key=?`).bind(key).first<ReceiptRow>();}
  catch{return reject('adapter_accounting_unavailable');}
  if(!row||row.source_id!==source.sourceId||row.state!=='succeeded'||row.outcome!=='succeeded'||!uuid(row.token)||row.finished_token!==row.token||row.attempt!==row.attempts||!Number.isSafeInteger(row.attempt)||row.attempt<1||row.attempt>3||!Number.isSafeInteger(row.day)||row.day<0||!Number.isSafeInteger(row.budget_day)||row.budget_day<row.day||!Number.isSafeInteger(row.used)||row.used<0||row.used>20||!Number.isSafeInteger(row.day_count)||row.day_count<1||row.day_count>20||(row.budget_day===row.day&&row.used<row.day_count))reject('adapter_uncharged_body');
  let result:Extract<HttpResult,{ok:true}>&{status:string};
  try{result=JSON.parse(row.result);}catch{return reject('adapter_invalid_http_receipt');}
  if(result?.status!=='succeeded'||result.ok!==true||result.state?.mode!=='http'||result.state.sourceId!==source.sourceId||result.state.hash!==source.raw.hash||result.observation?.hash!==source.raw.hash||!['baseline','changed','unchanged'].includes(result.observation.kind)||result.observation.bytes!==source.raw.bytes.byteLength||(row.actual_download_bytes??row.actual_bytes)!==source.raw.bytes.byteLength)reject('adapter_http_receipt_mismatch');
  const observedAt=result.state.checkedAt;
  if(!Number.isSafeInteger(observedAt)||observedAt<0||observedAt>253402300799999)reject('adapter_stale_observation');
  if(!historicalReplay&&(observedAt>now||now-observedAt>86400000))reject('adapter_stale_observation');
  return {requestKey:key,observedAt,reservationToken:row.token,day:row.day,attempt:row.attempt};
}

// New receipt boundary: re-extract actual raw bytes and verify actual HTTP D1 authority.
// Does not issue legacy Evidence1, infer original lineage or call a semantic verifier.
export async function verifyAcquiredSource(value:unknown,context:SourceVerificationContext):Promise<AcquiredSource>{
  exact(value,['source','receipt']);exact(value.receipt,['requestKey','observedAt','reservationToken','day','attempt']);
  if(!uuid(value.receipt.requestKey))reject('adapter_invalid_key');
  if(!uuid(value.receipt.reservationToken)||!Number.isSafeInteger(value.receipt.observedAt)||!Number.isSafeInteger(value.receipt.day)||!Number.isSafeInteger(value.receipt.attempt))reject('adapter_invalid_shape');
  const source=await validateExtractedSource(value.source);
  const receipt=await receiptFor(source,value.receipt.requestKey,context.db,timestamp(context.clock??Date.now),context.historicalReplay===true);
  if(canonical(receipt)!==canonical(value.receipt))reject('adapter_receipt_binding_mismatch');
  return {source,receipt};
}

// Reconstruct receipt metadata from trusted D1 rather than a candidate reference.
// Useful when an owned raw file and its exact extraction identity are retained.
export async function verifyAcquiredSourceReference(value:unknown,context:SourceVerificationContext):Promise<AcquiredSource>{
  exact(value,['source','requestKey']);if(!uuid(value.requestKey))reject('adapter_invalid_key');
  const source=await validateExtractedSource(value.source);
  return {source,receipt:await receiptFor(source,value.requestKey,context.db,timestamp(context.clock??Date.now),context.historicalReplay===true)};
}

// Trusted-code callable only. No app import, route, schedule or provider dispatch.
// Each selection gets one attempt. Unknown/lost bodies are never silently refetched.
export async function acquireMaintenanceSource(value:unknown,context:Context):Promise<AcquiredSource>{
  if(context.enabled!==true)reject('adapter_disabled');
  const input=selection(value),clock=context.clock??Date.now,store=new HttpObservationStore(context.db);
  const job=await store.enqueue(input.sourceId,input.requestKey,timestamp(clock));
  if(job.state!=='queued'||job.attempts!==0)reject('adapter_existing_attempt_no_refetch');
  const lease=await store.claim(input.requestKey,timestamp(clock));if(!lease)reject('adapter_http_not_admitted');
  const chunks:Uint8Array[]=[];let length=0,complete=false,contentType='';
  const send:WebFetch=async(url,options)=>{
    const response=context.send?await context.send(url,options):await fetch(url,{...options,method:'GET',credentials:'omit',cache:'no-store'});
    const cancel=()=>{void response.body?.cancel().catch(()=>{});};
    if(options.signal.aborted){cancel();throw new HttpError('http_aborted',true);}
    if(response.redirected||(response.url&&response.url!==url)){cancel();throw new HttpError('redirect_blocked');}
    if(response.status!==200)return response;
    contentType=response.headers.get('Content-Type')??'';
    const reader=response.body?.getReader();if(!reader)return response;
    const body=new ReadableStream<Uint8Array>({async pull(controller){
      try{const part=await reader.read();if(part.done){complete=true;controller.close();return;}
        if(!(part.value instanceof Uint8Array)){void reader.cancel().catch(()=>{});throw new HttpError('malformed_body');}
        if(length+part.value.byteLength>sourceBodyLimit(input.sourceId)){void reader.cancel().catch(()=>{});throw new HttpError('body_too_large',false,{stage:'stream',limitBytes:sourceBodyLimit(input.sourceId),observedBytes:length+part.value.byteLength,complete:false});}
        length+=part.value.byteLength;chunks.push(Uint8Array.from(part.value));controller.enqueue(part.value);
      }catch(error){controller.error(error);}
    },cancel(){return reader.cancel();}});
    return new Response(body,{status:response.status,headers:response.headers});
  };
  let result=await createWorkersHttpPass(send,clock).check(lease.sourceId,lease.lastGood),source:ExtractedSource|undefined;
  if(result.ok&&result.observation.kind!=='not-modified'){
    try{
      if(!complete||length!==result.observation.bytes)reject('adapter_capture_mismatch');
      const raw=new Uint8Array(length);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength;}
      source=await extractMaintenanceSource(lease.sourceId,raw,contentType);
      if(source.raw.hash!==result.state.hash)reject('adapter_capture_mismatch');
    }catch(error){result={ok:false,state:lease.lastGood,error:{code:error instanceof SourceAdapterError?error.code:'adapter_extraction_failed',retryable:false}};}
  }
  if(!await store.finish(lease,result,timestamp(clock)))reject('adapter_http_completion_unconfirmed');
  if(!result.ok)reject(result.error.code);
  if(!source)reject('adapter_original_200_required');
  return {source,receipt:await receiptFor(source,input.requestKey,context.db,timestamp(clock))};
}
