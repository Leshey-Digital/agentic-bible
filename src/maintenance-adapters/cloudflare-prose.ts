import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
import {MaintenanceBudget} from '../wiki-bridge/maintenance-budget.ts';
import {currencyInput,currencyCost,currencyPin,currencyProvider,type CurrencyControl,type Usage} from '../wiki-bridge/maintenance-currency.ts';
import {policyInput,stop} from '../wiki-bridge/maintenance-provider.ts';

export const cloudflareProseModel='@cf/meta/llama-3.2-1b-instruct';
export const cloudflareProseLimits=Object.freeze({promptBytes:8192,responseBytes:4096,timeoutMs:2000});
export type WorkersAiBinding={run:(model:string,input:{prompt:string;max_tokens:number;raw:true})=>Promise<unknown>};
export function cloudflareProseIdentity(prompt:string,maxTokens:number){
 const request={model:cloudflareProseModel,prompt,max_tokens:maxTokens,raw:true as const},requestHash=hash(canonical(request));
 return {request,requestHash,eventId:'cfa-'+requestHash.slice(0,48)};
}
export type ProseInputBound=(prompt:string)=>number;
export type CloudflareProseOptions={enabled?:boolean;ai?:WorkersAiBinding;db?:SqlDatabase;currency?:CurrencyControl;policy?:unknown;
 inputTokenUpperBound?:ProseInputBound;clock?:()=>number;timeoutMs?:number;signal?:AbortSignal};
export type ProseDraft={kind:'unverified-prose-draft';model:string;text:string;usage:Usage;costUpperBoundMicroUsd:number;costSettledMicroUsd:number;eventId:string};

// The pinned Workerd Workers AI output type models this generation result as
// usage.prompt_tokens, usage.completion_tokens and usage.total_tokens. Do not
// accept aliases or caller-supplied mappings: uncertainty must retain the hold.
export function readCloudflareProseUsage(value:unknown):Usage{
 if(!value||typeof value!=='object'||Array.isArray(value))stop('cloudflare_prose_usage');
 const usage=(value as Record<string,unknown>).usage;
 if(!usage||typeof usage!=='object'||Array.isArray(usage))stop('cloudflare_prose_usage');
 const counts=usage as Record<string,unknown>,keys=Object.keys(counts).sort();
 if(keys.join(',')!=='completion_tokens,prompt_tokens,total_tokens')stop('cloudflare_prose_usage');
 const inputTokens=counts.prompt_tokens,outputTokens=counts.completion_tokens,totalTokens=counts.total_tokens;
 if(!Number.isSafeInteger(inputTokens)||!Number.isSafeInteger(outputTokens)||!Number.isSafeInteger(totalTokens)||
    (inputTokens as number)<0||(outputTokens as number)<0||(totalTokens as number)!==(inputTokens as number)+(outputTokens as number))stop('cloudflare_prose_usage');
 return {inputTokens:inputTokens as number,outputTokens:outputTokens as number};
}

// Opt-in, server-side adapter. Cloudflare documents the usage object; the
// pinned model's generated binding type supplies its nested token fields.
// No Worker route or Wrangler binding imports this module by default.
export function createCloudflareProseAdapter(options:CloudflareProseOptions={}){
 const {enabled,ai,db,currency:control,policy:policyControl,inputTokenUpperBound,clock}=options,timeout=options.timeoutMs??cloudflareProseLimits.timeoutMs;
 return Object.freeze({connectionStatus:'unverified' as const,capability:'draft-prose-only' as const,
  async generate(prompt:string):Promise<ProseDraft>{
   if(options.signal?.aborted)stop('cloudflare_prose_cancelled');if(enabled!==true)stop('cloudflare_prose_disabled');if(!ai||typeof ai.run!=='function')stop('cloudflare_prose_binding_unconfigured');if(!db)stop('cloudflare_prose_storage_unconfigured');
   if(typeof inputTokenUpperBound!=='function')stop('cloudflare_prose_input_bound_unconfigured');
   if(!Number.isSafeInteger(timeout)||timeout<1||timeout>cloudflareProseLimits.timeoutMs)stop('cloudflare_prose_deadline');
   const bytes=new TextEncoder().encode(prompt??'').byteLength;if(typeof prompt!=='string'||bytes<1||bytes>cloudflareProseLimits.promptBytes)stop('cloudflare_prose_prompt_limit');
   const policy=policyInput(policyControl),currency=currencyInput(control);if(!currency)stop('cloudflare_prose_currency_unconfigured');
   const price=currencyProvider(currency,'cloudflare-workers-ai','cloudflare-reported-token-usage-v1',cloudflareProseModel);if(!price)stop('cloudflare_prose_currency_unconfigured');
   const inputReservation=inputTokenUpperBound(prompt);if(!Number.isSafeInteger(inputReservation)||inputReservation<1||inputReservation>policy.maxInputTokens)stop('cloudflare_prose_prompt_reservation_limit');
   if(policy.maxOutputTokens>2048)stop('cloudflare_prose_output_reservation_limit');
   const now=(clock??Date.now)();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('maintenance_clock');
   // Raw mode is part of both dispatched bytes and identity; the trusted bound
   // excludes undocumented chat-template framing only in this mode.
   const {request,requestHash,eventId:event}=cloudflareProseIdentity(prompt,policy.maxOutputTokens);
   const fingerprint=hash(canonical({requestHash,policy,currency:currencyPin(currency),priceId:price.id}));
   const reservationPolicy=Object.freeze({...policy,maxInputTokens:inputReservation});
   const budget=new MaintenanceBudget(db,{enabled:true,policy:currency}),row=await budget.reserve(event,fingerprint,reservationPolicy,inputReservation,now,price.id);
   let dispatched=false;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    const eligible=await budget.dispatchEligibility(row);eligible((clock??Date.now)());if(controller.signal.aborted||options.signal?.aborted)stop('cloudflare_prose_cancelled');dispatched=true;
    const raw=await Promise.race([ai.run(request.model,{prompt:request.prompt,max_tokens:request.max_tokens,raw:request.raw}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('cloudflare_prose_timeout'));},timeout);})]);
    if(controller.signal.aborted||options.signal?.aborted)stop('cloudflare_prose_timeout');
    if(!raw||typeof raw!=='object'||Array.isArray(raw))stop('cloudflare_prose_response');const value=raw as Record<string,unknown>;
    if(typeof value.response!=='string'||value.response.trim().length<1||new TextEncoder().encode(value.response).byteLength>cloudflareProseLimits.responseBytes)stop('cloudflare_prose_response');
    const usage=readCloudflareProseUsage(value);if(usage.inputTokens<1||usage.inputTokens>policy.maxInputTokens||usage.outputTokens<0||usage.outputTokens>policy.maxOutputTokens)stop('cloudflare_prose_usage');
    const settledAt=(clock??Date.now)(),cost=currencyCost(currency,usage,price.id),receipt={schemaVersion:1,provider:'cloudflare-workers-ai',model:cloudflareProseModel,priceId:price.id,requestHash,usage,costUpperBoundMicroUsd:row.currency_reserved,costSettledMicroUsd:cost,draftHash:hash(value.response)};
    const draft:ProseDraft={kind:'unverified-prose-draft',model:cloudflareProseModel,text:value.response,usage,costUpperBoundMicroUsd:row.currency_reserved!,costSettledMicroUsd:cost,eventId:event};
    // The compact response column has a 4096-byte serialized limit. Keep
    // full prose in the separately bounded packet (49152 bytes); even worst-
    // case JSON escaping of 4096 raw bytes fits without enlarging ledger caps.
    await budget.ready(row,{draftHash:receipt.draftHash,usage,provider:'cloudflare-workers-ai',model:cloudflareProseModel},{kind:'cloudflare-prose-draft',...receipt,schemaVersion:2,response:value.response},usage.inputTokens+usage.outputTokens,{usage,now:settledAt});
    const ready=await budget.job(event);if(!ready)stop('maintenance_accounting_unconfirmed');await budget.complete(ready,receipt);return draft;
   }catch(error){if(dispatched){try{await budget.rejected(row,true);}catch{/* Reservation remains the accounting authority. */}}else{try{await budget.rejected(row,false);}catch{/* Reservation remains the accounting authority. */}}throw error;
   }finally{clearTimeout(timer);controller.abort();}
  },
 });
}


/** Read-only recovery. A retained nonterminal/uncertain attempt is never dispatched again. */
export async function readCloudflareProseDraft(prompt:string,options:CloudflareProseOptions):Promise<ProseDraft|null>{
 const policy=policyInput(options.policy),currency=currencyInput(options.currency);
 if(!options.db||!currency||!options.inputTokenUpperBound)stop('cloudflare_prose_storage_unconfigured');
 const price=currencyProvider(currency,'cloudflare-workers-ai','cloudflare-reported-token-usage-v1',cloudflareProseModel);if(!price)stop('cloudflare_prose_currency_unconfigured');
 const {requestHash,eventId}=cloudflareProseIdentity(prompt,policy.maxOutputTokens),budget=new MaintenanceBudget(options.db,{enabled:true,policy:currency}),row=await budget.job(eventId);
 if(!row)return null;
 const fingerprint=hash(canonical({requestHash,policy,currency:currencyPin(currency),priceId:price.id}));
 if(row.fingerprint!==fingerprint)stop('cloudflare_prose_replay_conflict');
 if(row.state!=='complete'||row.currency_state!=='settled')stop('cloudflare_prose_unconfirmed_no_retry');
 if(!row.packet||!row.response||!row.receipt||hash(row.packet)!==row.packet_hash||row.input_tokens!==options.inputTokenUpperBound(prompt)||row.output_tokens!==policy.maxOutputTokens)stop('cloudflare_prose_replay_corrupt');
 let packet:any,summary:any,receipt:any;try{packet=JSON.parse(row.packet);summary=JSON.parse(row.response);receipt=JSON.parse(row.receipt);}catch{return stop('cloudflare_prose_replay_corrupt');}
 if(typeof packet.response!=='string'||!packet.response.trim()||Buffer.byteLength(packet.response)>cloudflareProseLimits.responseBytes)stop('cloudflare_prose_replay_corrupt');
 const usage=readCloudflareProseUsage({usage:{prompt_tokens:packet.usage?.inputTokens,completion_tokens:packet.usage?.outputTokens,total_tokens:packet.usage?.inputTokens+packet.usage?.outputTokens}});
 await budget.verifyStoredCurrency(row,usage,true);budget.verifyCurrency(row,usage,true);
 const expected={schemaVersion:1,provider:'cloudflare-workers-ai',model:cloudflareProseModel,priceId:price.id,requestHash,usage,costUpperBoundMicroUsd:row.currency_reserved,costSettledMicroUsd:row.currency_actual,draftHash:hash(packet.response)};
 if(canonical(receipt)!==canonical(expected)||canonical(packet)!==canonical({kind:'cloudflare-prose-draft',...expected,schemaVersion:2,response:packet.response})||canonical(summary)!==canonical({draftHash:expected.draftHash,usage,provider:'cloudflare-workers-ai',model:cloudflareProseModel}))stop('cloudflare_prose_replay_corrupt');
 return {kind:'unverified-prose-draft',model:cloudflareProseModel,text:packet.response,usage,costUpperBoundMicroUsd:row.currency_reserved!,costSettledMicroUsd:row.currency_actual!,eventId};
}
