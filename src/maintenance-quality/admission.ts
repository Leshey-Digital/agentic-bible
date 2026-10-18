import {validateQualitySourceExtraction} from '../maintenance-adapters/quality-source.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
import {qualityIdentity,snapshotQuality,qualityRequest,reportInput,decision,qualityLimits,stop,type QualityControl,type QualityRequest,type QualityReceipt,type QualitySource,type QualityReport} from './contracts.ts';
export {QualityError} from './contracts.ts';

async function boundRequest(article:unknown,sources:QualitySource[]){
 const candidate=structuredClone(article);const copied=sources.map(s=>{if(!Buffer.isBuffer(s.bytes))stop('quality_source_binding');return {...s,bytes:Buffer.from(s.bytes),...(s.extraction?{extraction:structuredClone(s.extraction),lineage:structuredClone(s.lineage)}:{})};});
 for(const s of copied)if(s.extraction){const verified=await validateQualitySourceExtraction({citationId:s.citationId,sourceId:s.sourceId,url:s.url,bodyHash:s.bodyHash,bytes:s.bytes,extraction:s.extraction,lineage:s.lineage});s.extraction=verified.extraction;s.lineage=verified.lineage;}
 return qualityRequest(candidate,copied);
}
type Row={event_id:string;fingerprint:string;binding_hash:string;owner:string;state:'evaluating'|'complete'|'uncertain';identity_json:string;created_at:number;report_json:string|null;receipt_json:string|null;receipt_hash:string|null};
function event(id:string){if(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id))stop('quality_event');}
async function boundedReport(request:QualityRequest,control:QualityControl){
 const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([(async()=>{const response=await control.verifier!.verify(structuredClone(request),controller.signal);if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});stop('quality_verifier_timeout');}if(!(response instanceof Response)||response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0]!=='application/json'){void response.body?.cancel().catch(()=>{});stop('quality_verifier_response');}
  reader=response.body?.getReader();if(!reader)stop('quality_verifier_response');const chunks:Uint8Array[]=[];let length=0;while(true){const part=await reader.read();if(controller.signal.aborted)stop('quality_verifier_timeout');if(part.done)break;length+=part.value.byteLength;if(length>qualityLimits.responseBytes)stop('quality_response_limit');chunks.push(part.value);}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{return stop('quality_verifier_response');}
 })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});reject(Object.assign(new Error('quality_verifier_timeout'),{code:'quality_verifier_timeout'}));},qualityLimits.timeoutMs);})]);}finally{clearTimeout(timer);void reader?.cancel().catch(()=>{});}
}
function receipt(id:string,request:QualityRequest,control:QualityControl,report:QualityReport):QualityReceipt{const authority=qualityIdentity(control);return {schemaVersion:1,profile:'quality-gated-v1',eventId:id,candidateHash:request.candidateHash,manifestHash:request.manifestHash,sourceHash:request.sourceHash,bindingHash:request.bindingHash,verifierId:authority.verifierId,verifierRevision:authority.verifierRevision,environment:authority.environment,...decision(report,request,control),reportHash:hash(canonical(report)),factualVerification:'trusted-adapter-assessment',livePublished:false};}
function saved(row:Row,id:string,fingerprint:string,request:QualityRequest,control:QualityControl){
 if(row.fingerprint!==fingerprint||row.binding_hash!==request.bindingHash||row.identity_json!==canonical(qualityIdentity(control)))stop('quality_event_conflict');
 if(row.state!=='complete')stop('quality_verifier_outcome_unconfirmed_no_retry');
 try{if(!row.report_json||!row.receipt_json||hash(row.receipt_json)!==row.receipt_hash)stop('quality_audit_corrupt');const report=reportInput(JSON.parse(row.report_json),request),result=receipt(id,request,control,report);if(row.report_json!==canonical(report)||row.receipt_json!==canonical(result))stop('quality_audit_corrupt');return result;}catch{return stop('quality_audit_corrupt');}
}
export async function readQualityAdmission(id:string,article:unknown,sources:QualitySource[],context:{db:SqlDatabase;quality:QualityControl}){
 context={...context,quality:snapshotQuality(context.quality)};event(id);const authority=qualityIdentity(context.quality),request=await boundRequest(article,sources),fingerprint=hash(canonical({bindingHash:request.bindingHash,authority}));let row:Row|null;try{row=await context.db.prepare('SELECT * FROM maintenance_quality_admissions WHERE event_id=?').bind(id).first<Row>();}catch{return stop('quality_accounting_unavailable');}if(!row)stop('quality_admission_required');return saved(row,id,fingerprint,request,context.quality);
}
// This function cannot publish. Callers must require an allow receipt before any
// publisher effect; denial is durable and retains the already charged proposal.
export async function assessQuality(id:string,article:unknown,sources:QualitySource[],context:{db:SqlDatabase;quality:QualityControl;clock?:()=>number;checkpoint?:(phase:'quality-dispatched'|'quality-complete')=>void|Promise<void>}):Promise<QualityReceipt>{
 context={...context,quality:snapshotQuality(context.quality)};event(id);const authority=qualityIdentity(context.quality),request=await boundRequest(article,sources),fingerprint=hash(canonical({bindingHash:request.bindingHash,authority})),identity=canonical(authority),owner=crypto.randomUUID(),now=(context.clock??Date.now)();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('quality_clock');
 const get=()=>context.db.prepare('SELECT * FROM maintenance_quality_admissions WHERE event_id=?').bind(id).first<Row>();let row:Row|null,changed:number;
 try{const result=await context.db.prepare(`INSERT INTO maintenance_quality_admissions(event_id,fingerprint,binding_hash,owner,state,identity_json,created_at) SELECT ?,?,?,?,'evaluating',?,? WHERE (SELECT COUNT(*) FROM maintenance_quality_admissions)<? AND NOT EXISTS(SELECT 1 FROM maintenance_quality_admissions WHERE created_at>?) ON CONFLICT DO NOTHING`).bind(id,fingerprint,request.bindingHash,owner,identity,now,qualityLimits.rows,now).run();changed=result.meta.changes;row=await get();}catch{return stop('quality_accounting_unavailable');}
 if(!row)stop('quality_capacity_or_clock');if(row.fingerprint!==fingerprint||row.binding_hash!==request.bindingHash||row.identity_json!==identity)stop('quality_event_conflict');if(row.created_at>now)stop('quality_clock');if(row.state==='complete')return saved(row,id,fingerprint,request,context.quality);if(changed!==1||row.owner!==owner)stop('quality_verifier_outcome_unconfirmed_no_retry');
 await context.checkpoint?.('quality-dispatched');
 let report:QualityReport;try{report=reportInput(await boundedReport(request,context.quality),request);}catch{try{await context.db.prepare(`UPDATE maintenance_quality_admissions SET state='uncertain' WHERE event_id=? AND owner=? AND fingerprint=? AND state='evaluating'`).bind(id,owner,fingerprint).run();}catch{/* The durable evaluating row still prevents redispatch. */}return stop('quality_verifier_outcome_unconfirmed_no_retry');}
 const result=receipt(id,request,context.quality,report),raw=canonical(result),reportRaw=canonical(report);
 try{const committed=await context.db.prepare(`UPDATE maintenance_quality_admissions SET state='complete',report_json=?,receipt_json=?,receipt_hash=? WHERE event_id=? AND fingerprint=? AND owner=? AND state='evaluating'`).bind(reportRaw,raw,hash(raw),id,fingerprint,owner).run();if(committed.meta.changes!==1)stop('quality_completion_unconfirmed');}catch{const actual=await get();if(!actual||actual.owner!==owner||actual.receipt_json!==raw||actual.report_json!==reportRaw)stop('quality_completion_unconfirmed');return saved(actual,id,fingerprint,request,context.quality);}
 await context.checkpoint?.('quality-complete');return saved((await get())!,id,fingerprint,request,context.quality);
}
export function requireQualityAllow(receipt:QualityReceipt){if(receipt.decision!=='allow')stop('quality_publication_denied');}
