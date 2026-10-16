import {httpLimits,officialSource,publicAddress,type PublicAddress} from './http-policy.ts';
import {nodeFetch,resolveAddresses,type ControlledFetch} from './http-node.ts';
import type {Observation} from './contracts.ts';

export type HttpLastGood={mode:'http';sourceId:string;hash:string;etag:string|null;lastModified:string|null;checkedAt:number};
export type HttpResult={ok:true;state:HttpLastGood;observation:Observation}|{ok:false;state:HttpLastGood|null;error:{code:string;retryable:boolean}};
class HttpError extends Error {code:string;retryable:boolean;constructor(code:string,retryable=false){super(code);this.code=code;this.retryable=retryable;}}
type Dependencies={fetch?:ControlledFetch;resolve?:(hostname:string)=>Promise<PublicAddress[]>;clock?:()=>number};
function validator(value:unknown,kind:'etag'|'date'):string|null {
  if(value===null)return null;
  if(typeof value!=='string'||value.length>200||value!==value.trim()||/[\x00-\x1f\x7f]/.test(value))throw new HttpError('invalid_validator');
  if(kind==='etag'?!/^(W\/)?"[\x21\x23-\x7e]*"$/.test(value):!Number.isFinite(Date.parse(value))||new Date(value).toUTCString()!==value)throw new HttpError('invalid_validator');
  return value;
}
function previousState(id:string,value:unknown):HttpLastGood|null {
  if(value===undefined||value===null)return null;
  if(typeof value!=='object'||Array.isArray(value))throw new HttpError('invalid_last_good_state');
  const row=value as HttpLastGood;
  if(Object.keys(row).sort().join(',')!=='checkedAt,etag,hash,lastModified,mode,sourceId'||row.mode!=='http'||row.sourceId!==id||typeof row.hash!=='string'||row.hash.length!==64||!/^[a-f0-9]{64}$/.test(row.hash)||!Number.isSafeInteger(row.checkedAt)||row.checkedAt<0)throw new HttpError('invalid_last_good_state');
  return {mode:'http',sourceId:id,hash:row.hash,etag:validator(row.etag,'etag'),lastModified:validator(row.lastModified,'date'),checkedAt:row.checkedAt};
}
function cancel(response:Response){void response.body?.cancel().catch(()=>{});}

// One explicit local pass. Requests (including failed DNS/HTTP attempts) are charged before awaiting.
// There is deliberately no route, schedule, persistence or publication call here.
export function createHttpSourcePass(dependencies:Dependencies={}) {
  const fetch=dependencies.fetch??nodeFetch;const resolve=dependencies.resolve??resolveAddresses;const clock=dependencies.clock??Date.now;
  const timestamp=()=>{const value=clock();if(!Number.isSafeInteger(value)||value<0)throw new HttpError('invalid_clock');return value;};
  let used=0;
  async function check(id:unknown,previous?:unknown,signal?:AbortSignal):Promise<HttpResult>{
    let lastGood:HttpLastGood|null=null;
    const source=officialSource(id);
    try{if(!source)throw new HttpError('source_not_allowlisted');lastGood=previousState(source.id,previous);}catch(error){return {ok:false,state:null,error:{code:error instanceof HttpError?error.code:'invalid_input',retryable:false}};}
    if(signal?.aborted)return {ok:false,state:lastGood,error:{code:'http_aborted',retryable:true}};
    if(used>=httpLimits.requests)return {ok:false,state:lastGood,error:{code:'http_pass_budget',retryable:false}};
    used++;
    const controller=new AbortController();let timedOut=false;
    const aborted=()=>new HttpError(timedOut?'http_timeout':'http_aborted',true);
    const assertActive=()=>{if(controller.signal.aborted)throw aborted();};
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    let rejectAbort!:(error:HttpError)=>void;const interrupted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
    controller.signal.addEventListener('abort',()=>rejectAbort(aborted()),{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},httpLimits.timeoutMs);
    try{
      return await Promise.race([(async():Promise<HttpResult>=>{
        const addresses=await resolve(new URL(source.url).hostname);assertActive();
        if(!Array.isArray(addresses)||!addresses.length||addresses.length>httpLimits.dnsAnswers||Array.from(addresses).some(address=>!publicAddress(address)))throw new HttpError('dns_not_public');
        const headers=new Headers({Accept:'text/html, text/plain, application/json','Accept-Encoding':'identity','User-Agent':'AgenticBible-SourceMonitor/0.1'});
        if(lastGood?.etag)headers.set('If-None-Match',lastGood.etag);else if(lastGood?.lastModified)headers.set('If-Modified-Since',lastGood.lastModified);
        const response=await fetch(source.url,{headers,redirect:'manual',signal:controller.signal,address:{...addresses[0]}});
        try{
          assertActive();
          if(response.redirected||(response.url&&response.url!==source.url))throw new HttpError('redirect_blocked');
          if(response.status===304){
            if(!lastGood||(!lastGood.etag&&!lastGood.lastModified))throw new HttpError('unexpected_not_modified');
            const state={...lastGood,checkedAt:timestamp(),etag:validator(response.headers.get('ETag')??lastGood.etag,'etag'),lastModified:validator(response.headers.get('Last-Modified')??lastGood.lastModified,'date')};
            return {ok:true,state,observation:{kind:'not-modified',hash:state.hash,etag:state.etag,lastModified:state.lastModified,bytes:0}};
          }
          if(response.status>=300&&response.status<400)throw new HttpError('redirect_blocked');
          if(response.status!==200)throw new HttpError('http_'+response.status,[408,429].includes(response.status)||response.status>=500);
          const type=response.headers.get('Content-Type')??'';const media=type.split(';')[0].trim().toLowerCase();
          const parameters=type.split(';').slice(1).map(value=>value.trim());
          if(!['text/html','text/plain','application/json'].includes(media)||parameters.length>1||parameters.some(value=>!/^charset\s*=\s*(?:utf-8|"utf-8")$/i.test(value)))throw new HttpError('unsupported_content_type');
          if(!['identity',''].includes((response.headers.get('Content-Encoding')??'').toLowerCase()))throw new HttpError('unsupported_content_encoding');
          const declared=response.headers.get('Content-Length');let expected:number|null=null;
          if(declared!==null){if(!/^\d+$/.test(declared)||!Number.isSafeInteger(Number(declared)))throw new HttpError('invalid_content_length');expected=Number(declared);if(expected>httpLimits.bodyBytes)throw new HttpError('body_too_large');}
          const etag=validator(response.headers.get('ETag'),'etag');const lastModified=validator(response.headers.get('Last-Modified'),'date');
          const reader=response.body?.getReader();if(!reader)throw new HttpError('empty_body');
          const stop=()=>{void reader.cancel().catch(()=>{});};controller.signal.addEventListener('abort',stop,{once:true});
          const chunks:Uint8Array[]=[];let length=0;
          try{while(true){assertActive();const {value,done}=await reader.read();assertActive();if(done)break;length+=value.byteLength;if(length>httpLimits.bodyBytes)throw new HttpError('body_too_large');chunks.push(value);}}
          finally{controller.signal.removeEventListener('abort',stop);void reader.cancel().catch(()=>{});}
          if(!length)throw new HttpError('empty_body');if(expected!==null&&length!==expected)throw new HttpError('content_length_mismatch');
          const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
          try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(media==='application/json')JSON.parse(text);}catch{throw new HttpError('malformed_body');}
          const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');assertActive();
          const state:HttpLastGood={mode:'http',sourceId:source.id,hash,etag,lastModified,checkedAt:timestamp()};
          return {ok:true,state,observation:{kind:!lastGood?'baseline':hash===lastGood.hash?'unchanged':'changed',hash,etag,lastModified,bytes:length}};
        }finally{cancel(response);}
      })(),interrupted]);
    }catch(error){return {ok:false,state:lastGood,error:{code:error instanceof HttpError?error.code:controller.signal.aborted?aborted().code:'http_network_failed',retryable:error instanceof HttpError?error.retryable:true}};}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  return Object.freeze({check,requestsUsed:()=>used});
}
