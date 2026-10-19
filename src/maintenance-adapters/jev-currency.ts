import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
import type {JevChargedExecution,JevChargeRequest,JevDecision} from './jev.ts';
import {MaintenanceBudget} from '../wiki-bridge/maintenance-budget.ts';
import {currencyInput,currencyProvider,type CurrencyControl,type Usage} from '../wiki-bridge/maintenance-currency.ts';
import {stop,type Policy} from '../wiki-bridge/maintenance-provider.ts';

// Token bounds must come from a trusted, model-specific tokenizer/policy. The
// provider's post-call usage is checked against the reservation, never inferred.
const maxInput=8192,maxOutput=2048;
export type JevTokenBounds={inputUpperBound:(requestJson:string)=>number;outputUpperBound:(maxResponseBytes:number)=>number};
export type JevCurrencyAuthorityOptions={enabled?:boolean;currency?:CurrencyControl;db?:SqlDatabase;clock?:()=>number;tokenBounds?:JevTokenBounds};

// Server-only injected authority. It makes no provider calls itself; the Jev
// adapter supplies one single-use dispatch closure after this D1 reservation.
export function createJevCurrencyAuthority(options:JevCurrencyAuthorityOptions={}):JevChargedExecution{
 const {enabled,currency:control,db,clock,tokenBounds}=options;
 return Object.freeze({async execute(request:JevChargeRequest,dispatch:()=>Promise<JevDecision>,signal:AbortSignal){
  if(enabled!==true)stop('jev_currency_disabled');if(!db)stop('jev_currency_storage_unconfigured');if(!tokenBounds||typeof tokenBounds.inputUpperBound!=='function'||typeof tokenBounds.outputUpperBound!=='function')stop('jev_currency_token_bounds_unconfigured');
  const currency=currencyInput(control);if(!currency)stop('jev_currency_policy_unconfigured');
  currencyProvider(currency,'typesafe','typesafe-reported-token-usage-v1',request.model);
  const requestBytes=new TextEncoder().encode(request.requestJson).byteLength;
  if(requestBytes<1||requestBytes>16384)stop('jev_currency_request_limit');
  const inputReservation=tokenBounds.inputUpperBound(request.requestJson),outputReservation=tokenBounds.outputUpperBound(2048);
  if(!Number.isSafeInteger(inputReservation)||inputReservation<1||inputReservation>maxInput||!Number.isSafeInteger(outputReservation)||outputReservation<1||outputReservation>maxOutput)stop('jev_currency_token_bounds');
  if(!/^[a-f0-9]{64}$/.test(request.requestSha256)||hash(request.requestJson)!==request.requestSha256)stop('jev_currency_request_identity');
  if(signal.aborted)stop('jev_currency_cancelled');
  const now=(clock??Date.now)();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('maintenance_clock');
  const event='jev-'+request.requestSha256.slice(0,48),fingerprint=hash(canonical({provider:request.provider,model:request.model,requestSha256:request.requestSha256,currency}));
  const reservedCost=inputReservation+outputReservation,ledgerPolicy:Readonly<Policy>=Object.freeze({unit:'SIMULATED_MICRO_USD',maxInputTokens:inputReservation,maxOutputTokens:outputReservation,
   inputRate:1,outputRate:1,runCost:reservedCost,dayCost:reservedCost*8,monthCost:reservedCost*16,dayRequests:8,monthRequests:16,maxSourceAgeMs:86400000});
  const budget=new MaintenanceBudget(db,{enabled:true,policy:currency}),row=await budget.reserve(event,fingerprint,ledgerPolicy,inputReservation,now);
  let dispatched=false;
  try{
   const eligible=await budget.dispatchEligibility(row);eligible((clock??Date.now)());
   if(signal.aborted)stop('jev_currency_cancelled');dispatched=true;
   const decision=await dispatch();if(signal.aborted)stop('jev_currency_cancelled');
   const usage:Usage={inputTokens:decision.usage.inputTokens,outputTokens:decision.usage.outputTokens};
   const settledAt=(clock??Date.now)(),receipt={schemaVersion:1,provider:'typesafe',model:request.model,requestSha256:request.requestSha256,
    inputReservationBytes:requestBytes,usage,decisionHash:hash(canonical(decision))};
   await budget.ready(row,decision,{kind:'jev-structured-decision-receipt',...receipt},usage.inputTokens+usage.outputTokens,{usage,now:settledAt});
   const ready=await budget.job(event);if(!ready)stop('maintenance_accounting_unconfirmed');
   await budget.complete(ready,receipt);
  }catch(error){
   if(!dispatched){try{await budget.rejected(row,false);}catch{/* Existing reservation remains the spending authority. */}}
   else {try{await budget.rejected(row,true);}catch{/* Keep the maximum reservation on an uncertain outcome. */}}
   throw error;
  }
 }});
}
