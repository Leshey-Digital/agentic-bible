import {canonical,repository,writerLimits,stop} from './contracts.ts';
import type {WriterOutbox} from './outbox.ts';
export type ControlledGitHub={kind:'controlled-github-maintenance-fixture';send:(request:Request)=>Promise<Response>};
export function session(outbox:WriterOutbox,id:string,owner:string,port:Pick<ControlledGitHub,'send'>,clock:()=>number,beforeMutation?:()=>Promise<void>){
 let calls=0;const started=performance.now();
 async function request(path:string,body?:unknown):Promise<any>{
  if(++calls>writerLimits.invocationRequests||performance.now()-started>=writerLimits.invocationMs)stop('writer_invocation_budget');
  const encoded=body===undefined?undefined:canonical(body);if(encoded&&Buffer.byteLength(encoded)>writerLimits.requestBytes)stop('writer_request_limit');
  await outbox.reserve(id,owner,clock());if(body!==undefined)await beforeMutation?.();if(performance.now()-started>=writerLimits.invocationMs)stop('writer_invocation_budget');
  const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([(async()=>{
   const response=await port.send(new Request(body===undefined?'https://api.github.com/repos/'+repository+path:'https://api.github.com/graphql',{method:body===undefined?'GET':'POST',headers:{Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Agentic-Bible-Controlled-Maintenance','X-GitHub-Api-Version':'2026-03-10'},body:encoded,redirect:'manual',credentials:'omit',signal:controller.signal}));
   if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});stop('writer_request_timeout');}
   if(response.redirected||response.status!==200||response.headers.get('Content-Type')?.split(';')[0]!=='application/json'||Number(response.headers.get('Content-Length'))>writerLimits.responseBytes){void response.body?.cancel().catch(()=>{});stop('writer_response_rejected');}
   reader=response.body?.getReader();if(!reader)stop('writer_response_rejected');const chunks:Uint8Array[]=[];let length=0;
   while(true){const part=await reader.read();if(controller.signal.aborted)stop('writer_request_timeout');if(part.done)break;length+=part.value.byteLength;if(length>writerLimits.responseBytes)stop('writer_response_limit');chunks.push(part.value);}
   try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{return stop('writer_response_rejected');}
  })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});reject(new Error('writer_request_unconfirmed'));},Math.min(writerLimits.requestMs,writerLimits.invocationMs-(performance.now()-started)));})]);}
  finally{clearTimeout(timer);void reader?.cancel().catch(()=>{});}
 }
 return {request};
}
