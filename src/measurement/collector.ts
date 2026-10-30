import {measurementPage,checkedSignal,measurementRevision,type Measurement} from './aggregate.ts';
export {measurementRevision} from './aggregate.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
export const measurementLimits=Object.freeze({bytes:4096,batch:8,hourEvents:1000,monthEvents:100000,readMs:2000,quotaMs:2000});
export type MeasurementPolicy={schemaVersion:1;enabled:true;policyRevision:typeof measurementRevision;origin:'https://agenticbible.si';hourEvents:number;monthEvents:number};
export type MeasurementQuota={reserve(input:{at:number;events:number;policy:MeasurementPolicy}):Promise<boolean>};
export type AnalyticsEngineBinding={writeDataPoint(point:{blobs:string[];doubles:number[];indexes:string[]}):unknown};
export type MeasurementTransport={submit(row:Measurement,count:number):void};
const keys=(x:object)=>Object.keys(x).sort().join(',');
export function measurementPolicy(raw:unknown):MeasurementPolicy|undefined{
 try{const v=typeof raw==='string'&&raw.length<=512?JSON.parse(raw):null;
  if(!v||keys(v)!=='enabled,hourEvents,monthEvents,origin,policyRevision,schemaVersion'||v.schemaVersion!==1||v.enabled!==true||v.policyRevision!==measurementRevision||v.origin!=='https://agenticbible.si'||!Number.isSafeInteger(v.hourEvents)||v.hourEvents<1||v.hourEvents>measurementLimits.hourEvents||!Number.isSafeInteger(v.monthEvents)||v.monthEvents<v.hourEvents||v.monthEvents>measurementLimits.monthEvents)return;
  return Object.freeze({...v});
 }catch{return;}
}
export function analyticsEngineTransport(binding:AnalyticsEngineBinding):MeasurementTransport{
 return {submit(row,count){
  if(!row||keys(row)!=='day,page,schemaVersion,signal'||row.schemaVersion!==1||!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||!measurementPage(row.page)||!checkedSignal(row.signal,row.page)||!Number.isSafeInteger(count)||count<1||count>8)throw Error('measurement_projection_required');
  const s=row.signal,detail='results'in s?s.results:'outcome'in s?s.outcome:'component'in s?s.component:'',article='article'in s?s.article:'',expanded='expanded'in s&&s.expanded?'1':'0';
  const result=binding.writeDataPoint({blobs:['1',row.day,row.page,s.event,detail,article,expanded],doubles:[count],indexes:[row.page]});
  if(result&&(typeof result==='object'||typeof result==='function')&&typeof (result as PromiseLike<unknown>).then==='function'){void Promise.resolve(result).catch(()=>{});throw Error('measurement_submission_unconfirmed');}
 }};
}
export function d1MeasurementQuota(db:SqlDatabase):MeasurementQuota{
 return {async reserve({at,events,policy}){
  if(!measurementPolicy(JSON.stringify(policy))||!Number.isSafeInteger(at)||at<0||at>253402300799999||!Number.isSafeInteger(events)||events<1||events>Math.min(8,policy.hourEvents,policy.monthEvents))return false;
  const hour=Math.floor(at/3600000),date=new Date(at),month=date.getUTCFullYear()*12+date.getUTCMonth();
  const r=await db.prepare(`INSERT INTO public_measurement_quota(singleton,policy_revision,hour,hour_events,month,month_events,high_water) VALUES(1,?,?,?,?,?,?)
ON CONFLICT(singleton) DO UPDATE SET hour=excluded.hour,hour_events=CASE WHEN public_measurement_quota.hour=excluded.hour THEN public_measurement_quota.hour_events+excluded.hour_events ELSE excluded.hour_events END,month=excluded.month,month_events=CASE WHEN public_measurement_quota.month=excluded.month THEN public_measurement_quota.month_events+excluded.month_events ELSE excluded.month_events END,high_water=excluded.high_water
WHERE public_measurement_quota.policy_revision=excluded.policy_revision AND excluded.high_water>=public_measurement_quota.high_water AND excluded.hour>=public_measurement_quota.hour AND excluded.month>=public_measurement_quota.month
AND CASE WHEN public_measurement_quota.hour=excluded.hour THEN public_measurement_quota.hour_events+excluded.hour_events ELSE excluded.hour_events END<=?
AND CASE WHEN public_measurement_quota.month=excluded.month THEN public_measurement_quota.month_events+excluded.month_events ELSE excluded.month_events END<=?`).bind(policy.policyRevision,hour,events,month,events,at,policy.hourEvents,policy.monthEvents).run();
  return r?.meta?.changes===1;
 }};
}
const response=(status:number,state:string)=>Response.json({schemaVersion:1,state},{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",...(status===405?{'Allow':'POST'}:{})}});
async function body(request:Request){
 if(!request.body)throw Error('invalid');const reader=request.body.getReader();let bytes=0;const parts:Uint8Array[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
 try{const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(Error('invalid'));},measurementLimits.readMs);});
  while(true){const r=await Promise.race([reader.read(),timeout]);if(r.done)break;bytes+=r.value.byteLength;if(bytes>measurementLimits.bytes||parts.length>=4096)throw Error('invalid');parts.push(r.value);}
  const all=new Uint8Array(bytes);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
 }finally{if(timer)clearTimeout(timer);void reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{/* Pending read/cancel remains bounded by the discarded request. */}}
}
/** Client consent is a declaration, not authenticated identity or evidence of human intent. */
export function createMeasurementCollector(options:{policy?:MeasurementPolicy;quota?:MeasurementQuota;transport?:MeasurementTransport;now?:()=>number}={}){
 const policy=measurementPolicy(JSON.stringify(options.policy));
 return async(request:Request):Promise<Response>=>{
  const p=policy,url=new URL(request.url);
  if(!p||!options.quota||!options.transport)return response(503,'disabled');
  if(url.pathname!=='/api/measurement'||url.search||url.hash||url.origin!==p.origin||request.headers.get('origin')!==p.origin||request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return response(403,'not_permitted');
  if(request.method!=='POST')return response(405,'method_not_allowed');
  const length=request.headers.get('content-length');if(request.headers.get('content-type')?.toLowerCase()!=='application/json'||request.headers.has('content-encoding')||length!==null&&(!/^\d+$/.test(length)||Number(length)>measurementLimits.bytes))return response(400,'invalid_batch');
  let rows:Measurement[],at:number;
  try{const v=await body(request);at=(options.now??Date.now)();if(!Number.isSafeInteger(at)||at<0||at>253402300799999||!v||typeof v!=='object'||keys(v)!=='consent,events,policyRevision,schemaVersion'||v.schemaVersion!==1||v.policyRevision!==p.policyRevision||v.consent!=='granted'||!Array.isArray(v.events)||v.events.length<1||v.events.length>8)throw Error('invalid');
   rows=v.events.map((e:unknown)=>{if(!e||typeof e!=='object'||Array.isArray(e)||keys(e)!=='page,signal')throw Error('invalid');const value=e as {page:unknown;signal:unknown};if(typeof value.page!=='string'||!measurementPage(value.page))throw Error('invalid');const signal=checkedSignal(value.signal,value.page);if(!signal)throw Error('invalid');return {schemaVersion:1,day:new Date(at).toISOString().slice(0,10),page:value.page,signal};});
  }catch{return response(400,'invalid_batch');}
  // Reserve every admitted event before any side effect. Never release on error.
  let quotaTimer:ReturnType<typeof setTimeout>|undefined;
  try{const expired=new Promise<never>((_,reject)=>{quotaTimer=setTimeout(()=>reject(Error('unknown quota')),measurementLimits.quotaMs);});if(await Promise.race([options.quota.reserve({at,events:rows.length,policy:p}),expired])!==true)return response(429,'quota_unavailable');}catch{return response(503,'quota_unconfirmed');}finally{if(quotaTimer)clearTimeout(quotaTimer);}
  const fresh=()=>{const current=(options.now??Date.now)();return Number.isSafeInteger(current)&&current>=at&&Math.floor(current/3600000)===Math.floor(at/3600000);};
  const grouped=new Map<string,{row:Measurement;count:number}>();for(const row of rows){const key=JSON.stringify(row),item=grouped.get(key);if(item)++item.count;else grouped.set(key,{row,count:1});}
  try{for(const {row,count}of grouped.values()){if(!fresh())throw Error('stale_reservation');const result:unknown=options.transport.submit(row,count);if(result&&(typeof result==='object'||typeof result==='function')&&typeof (result as PromiseLike<unknown>).then==='function'){void Promise.resolve(result).catch(()=>{});throw Error('unknown');}}}catch{return response(503,'submission_unconfirmed');}
  return response(202,'submitted_unconfirmed');
 };
}
export type MeasurementEnv={PUBLIC_MEASUREMENT_POLICY?:string;PUBLIC_MEASUREMENT?:AnalyticsEngineBinding;PUBLIC_MEASUREMENT_DB?:SqlDatabase};
export function configuredMeasurement(env:MeasurementEnv){const policy=measurementPolicy(env.PUBLIC_MEASUREMENT_POLICY);return createMeasurementCollector(policy&&env.PUBLIC_MEASUREMENT&&env.PUBLIC_MEASUREMENT_DB?{policy,quota:d1MeasurementQuota(env.PUBLIC_MEASUREMENT_DB),transport:analyticsEngineTransport(env.PUBLIC_MEASUREMENT)}:{});}
/** Usable outside the private staging router; does not need editorial DB or secrets. */
export function measurementRuntime(assets:{fetch(request:Request):Promise<Response>}){return {fetch(request:Request,env:MeasurementEnv={}){return new URL(request.url).pathname==='/api/measurement'?configuredMeasurement(env)(request):assets.fetch(request);}};}
