import {canonical,hash} from '../publishing/contracts.ts';
export class MaintenanceError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
export function stop(code:string):never{throw new MaintenanceError(code);}
export const producerLimits=Object.freeze({rows:16,sourceBytes:2048,responseBytes:4096,timeoutMs:2000});
export type Policy={unit:'SIMULATED_MICRO_USD';maxInputTokens:number;maxOutputTokens:number;inputRate:number;outputRate:number;runCost:number;dayCost:number;monthCost:number;dayRequests:number;monthRequests:number;maxSourceAgeMs:number};
// Explicit fake-only demonstration values, not an approved real provider allocation/rate card.
export const demonstrationPolicy:Readonly<Policy>=Object.freeze({unit:'SIMULATED_MICRO_USD',maxInputTokens:8192,maxOutputTokens:2048,inputRate:1,outputRate:1,runCost:10000,dayCost:20000,monthCost:60000,dayRequests:2,monthRequests:6,maxSourceAgeMs:86400000});
export type SourceData={citationId:string;bodyHash:string;untrusted:true;text:string};
export type ProviderRequest={schemaVersion:1;kind:'extractive-source-data';sources:SourceData[];maxOutputTokens:number};
export type Extract={citationId:string;bodyHash:string;start:number;end:number;quote:string};
export type Output={kind:'complete-source-paragraphs';extracts:Extract[]};
export type Provider={kind:'deterministic-extractive-fake';id:'fake-extractive-v1';tokenizer:'synthetic-utf8-bytes';invoke:(request:ProviderRequest,signal:AbortSignal)=>Promise<Response>};
export const tokens=(value:unknown)=>Buffer.byteLength(canonical(value));
export function shape(value:unknown,keys:string[]):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))stop('maintenance_invalid_schema');}
export function policyInput(value:unknown):Readonly<Policy>{
 shape(value,Object.keys(demonstrationPolicy));const p=value as Policy;
 if(p.unit!=='SIMULATED_MICRO_USD')stop('maintenance_live_budget_unconfigured');
 for(const key of Object.keys(p).filter(k=>k!=='unit') as (Exclude<keyof Policy,'unit'>)[])if(!Number.isSafeInteger(p[key])||p[key]<1)stop('maintenance_invalid_policy');
 if(p.maxInputTokens>8192||p.maxOutputTokens>2048||p.inputRate>1000||p.outputRate>1000||p.runCost>100000000||p.dayCost>100000000||p.monthCost>100000000||p.dayCost<p.runCost||p.monthCost<p.dayCost||p.dayRequests>8||p.monthRequests>16||p.monthRequests<p.dayRequests||p.maxSourceAgeMs>86400000)stop('maintenance_invalid_policy');
 return Object.freeze({...p});
}
export function sourceData(citationId:string,bodyHash:string,bytes:Buffer):SourceData{
 if(bytes.length>producerLimits.sourceBytes||hash(bytes)!==bodyHash)stop('maintenance_source_profile');let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return stop('maintenance_source_profile');}
 if(/<\s*[a-z!/?]|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/i.test(text))stop('maintenance_source_profile');
 return {citationId,bodyHash,untrusted:true,text};
}
export function validateReply(value:unknown,request:ProviderRequest,policy:Readonly<Policy>){
 shape(value,['schemaVersion','provider','tokenizer','output','usage']);if(value.schemaVersion!==1||value.provider!=='fake-extractive-v1'||value.tokenizer!=='synthetic-utf8-bytes')stop('maintenance_provider_identity');
 shape(value.output,['kind','extracts']);const output=value.output as Output;
 if(output.kind!=='complete-source-paragraphs'||!Array.isArray(output.extracts)||output.extracts.length!==request.sources.length)stop('maintenance_unsupported_claim');
 const seen=new Set<string>();for(const extract of output.extracts){shape(extract,['citationId','bodyHash','start','end','quote']);const source=request.sources.find(s=>s.citationId===extract.citationId);
  if(!source||seen.has(source.citationId)||extract.bodyHash!==source.bodyHash||!Number.isSafeInteger(extract.start)||!Number.isSafeInteger(extract.end)||typeof extract.quote!=='string'||extract.quote.length<20||extract.quote.length>280||extract.start<0||extract.end<=extract.start||extract.end>source.text.length||source.text.slice(extract.start,extract.end)!==extract.quote||/[\r\n<>\u0000-\u001f\u007f]/.test(extract.quote))stop('maintenance_unsupported_claim');
  const first=source.text.lastIndexOf('\n',extract.start-1)+1,last=source.text.indexOf('\n',extract.end);if(source.text.slice(first,last<0?undefined:last).trim()!==extract.quote)stop('maintenance_incomplete_context');seen.add(source.citationId);
 }
 shape(value.usage,['inputTokens','outputTokens']);const usage=value.usage as {inputTokens:number;outputTokens:number};
 if(usage.inputTokens!==tokens(request)||usage.outputTokens!==tokens(output)||usage.inputTokens>policy.maxInputTokens||usage.outputTokens>policy.maxOutputTokens)stop('maintenance_usage_rejected');
 return {output:structuredClone(output),usage:{...usage},actualCost:usage.inputTokens*policy.inputRate+usage.outputTokens*policy.outputRate};
}
export function deterministicProvider(observe?:(request:ProviderRequest)=>void):Provider{return {kind:'deterministic-extractive-fake',id:'fake-extractive-v1',tokenizer:'synthetic-utf8-bytes',async invoke(request,signal){
 if(signal.aborted)stop('maintenance_provider_timeout');observe?.(structuredClone(request));
 const output:Output={kind:'complete-source-paragraphs',extracts:request.sources.map(source=>{const line=source.text.split('\n').find(s=>s.trim().length>=20)?.trim()??'';const start=source.text.indexOf(line);return {citationId:source.citationId,bodyHash:source.bodyHash,start,end:start+line.length,quote:line};})};
 if(tokens(output)>request.maxOutputTokens)return Response.json({error:'fake_output_limit'},{status:422});
 return Response.json({schemaVersion:1,provider:'fake-extractive-v1',tokenizer:'synthetic-utf8-bytes',output,usage:{inputTokens:tokens(request),outputTokens:tokens(output)}});
 }};}
export async function invokeBounded(provider:Provider,request:ProviderRequest){
 const controller=new AbortController();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([(async()=>{const response=await provider.invoke(structuredClone(request),controller.signal);if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});stop('maintenance_provider_timeout');}if(response.status!==200||response.redirected||response.headers.get('Content-Type')?.split(';')[0]!=='application/json'){void response.body?.cancel().catch(()=>{});stop('maintenance_provider_response');}
  reader=response.body?.getReader();if(!reader)stop('maintenance_provider_response');const chunks:Uint8Array[]=[];let length=0;
  while(true){const {value,done}=await reader.read();if(controller.signal.aborted)stop('maintenance_provider_timeout');if(done)break;length+=value.byteLength;if(length>producerLimits.responseBytes)stop('maintenance_provider_response_limit');chunks.push(value);}
  const bytes=Buffer.concat(chunks);try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return stop('maintenance_provider_response');}
 })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});reject(new MaintenanceError('maintenance_provider_timeout'));},producerLimits.timeoutMs);})]);}
 finally{clearTimeout(timer);void reader?.cancel().catch(()=>{});}
}
