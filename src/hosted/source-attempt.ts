import type {SqlDatabase} from '../editorial/contracts.ts';
import {uuid} from './contracts.ts';
import {extractionProfile} from '../maintenance-adapters/profiles.ts';
import {sourceBodyLimit} from '../monitoring/http-registry.ts';
// Trusted admin router calls this read-only projection. No network/model/write ports.
export async function inspectSourceAttempt(db:SqlDatabase,key:string){
 if(!uuid(key))return null;
 const row=await db.prepare(`SELECT j.source_id,j.state,j.attempts,j.created_at,j.result,r.outcome,r.actual_bytes,r.*
 FROM http_check_jobs j LEFT JOIN http_request_reservations r ON r.token=j.finished_token AND r.request_key=j.request_key
 WHERE j.request_key=?`).bind(key).first<Record<string,any>>();
 const profile=extractionProfile(row?.source_id);if(!row||!profile||!['queued','running','retry','succeeded','dead'].includes(row.state))return null;
 let result:any;try{result=JSON.parse(row.result??'null');}catch{result=null;}
 const count=row.actual_download_bytes??row.actual_bytes;
 const complete=row.state==='succeeded'&&row.outcome==='succeeded'&&result?.ok===true&&Number.isSafeInteger(count)&&count>=0;
 const raw=result?.error?.bodyOverflow;
 const overflow=raw&&['declared','stream'].includes(raw.stage)&&raw.complete===false&&Number.isSafeInteger(raw.limitBytes)&&raw.limitBytes>0&&raw.limitBytes<=1048576&&Number.isSafeInteger(raw.observedBytes)&&raw.observedBytes>raw.limitBytes?{stage:raw.stage,limitBytes:raw.limitBytes,observedBytes:raw.observedBytes,complete:false}:null;
 const code=typeof result?.error?.code==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(result.error.code)?result.error.code:null;
 return {inspectionOnly:true,requestKey:key,sourceId:profile.sourceId,url:profile.url,state:row.state,chargedAttempts:row.attempts,createdAt:row.created_at,download:{complete,bytes:complete?count:null,currentLimitBytes:sourceBodyLimit(profile.sourceId),overflow},failureCode:code,inspectionRetriedSource:false};
}
