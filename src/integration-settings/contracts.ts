import {uuid} from '../hosted/contracts.ts';
import {adminTrust,hostedOrigin,verifySignedAdmin} from '../hosted/identity.ts';

export const integrationLimits=Object.freeze({bodyBytes:8192,bodyMs:1000,secretBytes:512,events:64,tests:8,testMs:1000});
export type IntegrationId='github-content'|'typesafe-jev';
export type ConnectionEvidence='controlled'|'provider'|'unverified';
export type ConnectionResult='connected'|'rejected'|'unavailable'|'timeout';
type Operation='configure'|'rotate'|'test';
type AuditEvent={operation:Operation;revision:number;eventId:string;at:number;result:'configured'|'rotated'|'reserved'|ConnectionResult};
// Private metadata only. No secret, secret hash, suffix, provider response or assertion belongs here.
export type IntegrationRecord={ownerRef:string;revision:number;requestKeys:string[];testsUsed:number;lastTest:ConnectionResult|'pending'|'never';pendingTest:{revision:number;requestKey:string}|null;audit:AuditEvent[]};
export type IntegrationTransaction={
  read():Promise<IntegrationRecord|null>;
  replaceSecret(secret:string):Promise<void>;
  write(record:IntegrationRecord):Promise<void>;
};
export type IntegrationStorage={
  // Trusted adapter requirement: serialize per integration and atomically commit/roll back
  // secret replacement + metadata + audit together. Never log arguments or errors.
  // No persistent vault implementation is supplied by this contract.
  transaction<T>(integration:IntegrationId,work:(tx:IntegrationTransaction)=>Promise<T>):Promise<T>;
};
export type IntegrationConnectionTest=(input:{integration:IntegrationId;revision:number;signal:AbortSignal})=>Promise<unknown>;
// Test adapter resolves the exact credential revision through trusted storage. It must
// honor abort, use a fixed scoped endpoint, cap transport work, and never retry/log secrets.
export type IntegrationAdapters={connectionEvidence?:ConnectionEvidence;trust:unknown;storage:IntegrationStorage;testConnection:IntegrationConnectionTest};
type Command={integration:IntegrationId;operation:Operation;revision:number;requestKey:string;secret?:string};
const errors={invalid_request:400,body_too_large:413,body_timeout:408,unsupported_media_type:415,verified_admin_required:403,same_origin_required:403,not_configured:409,owner_required:403,stale_revision:409,request_replayed:409,capacity_reached:503,test_in_progress:409,contract_unavailable:503,connection_test_unsupported:409} as const;
type ErrorCode=keyof typeof errors;
class ContractError extends Error{readonly code:ErrorCode;constructor(code:ErrorCode){super(code);this.code=code;}}
function fail(code:ErrorCode):never{throw new ContractError(code);}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const result=(v:unknown):v is ConnectionResult=>['connected','rejected','unavailable','timeout'].includes(v as string);
function record(value:IntegrationRecord|null):IntegrationRecord|null{
  if(value===null)return null;
  if(!object(value)||Object.keys(value).sort().join(',')!=='audit,lastTest,ownerRef,pendingTest,requestKeys,revision,testsUsed'||!/^signed-admin:[a-f0-9]{64}$/.test(value.ownerRef)||!Number.isSafeInteger(value.revision)||value.revision<1||value.revision>integrationLimits.events||!Array.isArray(value.requestKeys)||value.requestKeys.length>integrationLimits.events||value.requestKeys.some(k=>!uuid(k))||new Set(value.requestKeys).size!==value.requestKeys.length||!Number.isSafeInteger(value.testsUsed)||value.testsUsed<0||value.testsUsed>integrationLimits.tests||(!result(value.lastTest)&&!['pending','never'].includes(value.lastTest))||!Array.isArray(value.audit)||value.audit.length>integrationLimits.events)fail('contract_unavailable');
  if(value.pendingTest!==null&&(!object(value.pendingTest)||Object.keys(value.pendingTest).sort().join(',')!=='requestKey,revision'||!uuid(value.pendingTest.requestKey)||value.pendingTest.revision!==value.revision||!value.requestKeys.includes(value.pendingTest.requestKey)))fail('contract_unavailable');
  if((value.lastTest==='pending')!==(value.pendingTest!==null))fail('contract_unavailable');
  for(const event of value.audit){
    if(!object(event)||Object.keys(event).sort().join(',')!=='at,eventId,operation,result,revision'||!['configure','rotate','test'].includes(event.operation)||!uuid(event.eventId)||!Number.isSafeInteger(event.revision)||event.revision<1||event.revision>value.revision||!Number.isSafeInteger(event.at)||event.at<0||(!result(event.result)&&!['configured','rotated','reserved'].includes(event.result)))fail('contract_unavailable');
  }
  return structuredClone(value);
}
function projection(value:IntegrationRecord|null,integration:IntegrationId,connectionEvidence:ConnectionEvidence){
  return {integration,connectionEvidence,testSupported:integration==='github-content',generationSupported:false,configured:value!==null,maskedSecret:value?'********':null,revision:value?.revision??0,connection:value?.lastTest??'never',audit:(value?.audit??[]).map(e=>({operation:e.operation,revision:e.revision,eventId:e.eventId,at:e.at,result:e.result}))};
}
function owned(value:IntegrationRecord|null,ownerRef:string){if(value&&value.ownerRef!==ownerRef)fail('owner_required');return value;}
function guard(value:IntegrationRecord|null,command:Command,ownerRef:string){
  owned(value,ownerRef);
  if(value?.requestKeys.includes(command.requestKey))fail('request_replayed');
  if((value?.revision??0)!==command.revision)fail('stale_revision');
  if((value?.requestKeys.length??0)>=integrationLimits.events||(value?.audit.length??0)>=integrationLimits.events)fail('capacity_reached');
}
async function command(request:Request,integration:IntegrationId):Promise<Command>{
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')fail('unsupported_media_type');
  const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>integrationLimits.bodyBytes))fail('body_too_large');
  if(!request.body)fail('invalid_request');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{reject(new ContractError('body_timeout'));void reader.cancel().catch(()=>{});},integrationLimits.bodyMs);});
  try{while(true){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;size+=part.value.byteLength;if(size>integrationLimits.bodyBytes){void reader.cancel().catch(()=>{});fail('body_too_large');}chunks.push(part.value);}}finally{clearTimeout(timer);reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('invalid_request');}
  if(!object(value)||value.integration!==integration||!['configure','rotate','test'].includes(value.operation as string)||!Number.isSafeInteger(value.revision)||(value.revision as number)<0||!uuid(value.requestKey))fail('invalid_request');
  const keys=value.operation==='test'?'integration,operation,requestKey,revision':'integration,operation,requestKey,revision,secret';if(Object.keys(value).sort().join(',')!==keys)fail('invalid_request');
  if(value.operation!=='test'&&(typeof value.secret!=='string'||new TextEncoder().encode(value.secret).byteLength<16||new TextEncoder().encode(value.secret).byteLength>integrationLimits.secretBytes||/[\s\u0000-\u001f\u007f]/.test(value.secret)))fail('invalid_request');
  return value as Command;
}
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'same-origin','Vary':'cf-access-jwt-assertion'}});}

// Callable contract only: no Worker route, binding, network transport or environment setup.
// Trust is validated once from a server-only configuration string, never request fields.
export function createIntegrationSettingsContract(adapters:IntegrationAdapters,integration:IntegrationId='github-content'):(request:Request)=>Promise<Response>{
  const trust=adminTrust(adapters.trust);
  const evidence:ConnectionEvidence=['controlled','provider'].includes(adapters.connectionEvidence??'')?adapters.connectionEvidence!:'unverified';
  const project=(value:IntegrationRecord|null)=>projection(value,integration,evidence);
  return async request=>{
    try{
      if(!trust||!['github-content','typesafe-jev'].includes(integration))fail('contract_unavailable');
      if(new URL(request.url).origin!==hostedOrigin||request.headers.get('x-agentic-bible-request')!=='admin'||request.headers.get('sec-fetch-site')==='cross-site'||(request.method!=='GET'&&request.headers.get('origin')!==hostedOrigin))fail('same_origin_required');
      const admin=await verifySignedAdmin(request,trust);if(!admin)fail('verified_admin_required');
      const fresh=()=>{if(admin.expiresAt<=Date.now())fail('verified_admin_required');};
      if(request.method==='GET')return json(await adapters.storage.transaction(integration,async tx=>{const current=record(await tx.read());fresh();return project(owned(current,admin.subject));}));
      if(request.method!=='POST')fail('invalid_request');
      const input=await command(request,integration);
      // No documented non-billable Jev connection endpoint. Never issue a paid
      // evaluation merely to label configuration as connected.
      if(input.operation==='test'&&integration==='typesafe-jev')fail('connection_test_unsupported');
      if(input.operation!=='test'){
        return json(await adapters.storage.transaction(input.integration,async tx=>{
          const current=record(await tx.read());guard(current,input,admin.subject);
          if(input.operation==='configure'&&current)fail('stale_revision');if(input.operation==='rotate'&&!current)fail('not_configured');
          const next:IntegrationRecord={ownerRef:admin.subject,revision:(current?.revision??0)+1,requestKeys:[...(current?.requestKeys??[]),input.requestKey],testsUsed:current?.testsUsed??0,lastTest:'never',pendingTest:null,audit:[...(current?.audit??[]),{operation:input.operation,revision:(current?.revision??0)+1,eventId:crypto.randomUUID(),at:Date.now(),result:input.operation==='configure'?'configured':'rotated'}]};
          fresh();await tx.replaceSecret(input.secret!);await tx.write(next);return project(next);
        }));
      }
      // Reserve the request before invoking any test. Interrupted tests stay pending;
      // no automatic retry/refund. Rotation invalidates older pending completion.
      await adapters.storage.transaction(input.integration,async tx=>{
        const current=record(await tx.read());fresh();guard(current,input,admin.subject);if(!current)fail('not_configured');if(current.pendingTest)fail('test_in_progress');
        // Reserve room for both reservation and completion, even if another write runs.
        if(current.testsUsed>=integrationLimits.tests||current.audit.length+2>integrationLimits.events)fail('capacity_reached');
        current.requestKeys.push(input.requestKey);current.testsUsed++;current.lastTest='pending';current.pendingTest={revision:current.revision,requestKey:input.requestKey};current.audit.push({operation:'test',revision:current.revision,eventId:crypto.randomUUID(),at:Date.now(),result:'reserved'});await tx.write(current);
      });
      const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
      const timeout=new Promise<ConnectionResult>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve('timeout');},integrationLimits.testMs);});
      const connection=async():Promise<ConnectionResult>=>{
        // Keep the final authority check and adapter invocation synchronous. An
        // intervening promise hop could dispatch work after the assertion expires.
        fresh();
        try{
          const value=await adapters.testConnection({integration:input.integration,revision:input.revision,signal:controller.signal});
          return value==='connected'||value==='rejected'?value:'unavailable';
        }catch{return 'unavailable';}
      };
      let outcome:ConnectionResult;
      try{
        outcome=await Promise.race([connection(),timeout]);
      }finally{clearTimeout(timer);controller.abort();}
      return json(await adapters.storage.transaction(input.integration,async tx=>{
        const current=record(await tx.read());fresh();owned(current,admin.subject);
        if(!current||current.revision!==input.revision||current.pendingTest?.requestKey!==input.requestKey)fail('stale_revision');
        if(current.audit.length>=integrationLimits.events)fail('capacity_reached');
        current.lastTest=outcome;current.pendingTest=null;current.audit.push({operation:'test',revision:current.revision,eventId:crypto.randomUUID(),at:Date.now(),result:outcome});await tx.write(current);return project(current);
      }));
    }catch(error){const code=error instanceof ContractError&&Object.hasOwn(errors,error.code)?error.code:'contract_unavailable';return json({error:code},errors[code]);}
  };
}
