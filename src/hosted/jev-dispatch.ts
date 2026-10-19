import type {SqlDatabase} from '../editorial/contracts.ts';
import {createJevCurrencyAuthority,type JevTokenBounds} from '../maintenance-adapters/jev-currency.ts';
import {createJevDecisionAdapter,type JevModel,JevError,type JevTransport} from '../maintenance-adapters/jev.ts';
import {currencyInput,currencyProvider,currencyTime,type CurrencyControl} from '../wiki-bridge/maintenance-currency.ts';

export type JevDispatchState='unconfigured'|'disabled'|'configured';
export type JevDispatchPort={state:JevDispatchState;evaluate(content:string,ownerRef:string,signal?:AbortSignal):Promise<unknown>};
export type JevDispatchOptions={enabled?:boolean;credential?:(ownerRef:string)=>Promise<string|null>;model?:JevModel;db?:SqlDatabase;
  currency?:CurrencyControl;tokenBounds?:JevTokenBounds;transport?:JevTransport};

// Server-only composition seam. The credential callback and charged authority
// stay inside the closure; neither is exposed to an HTTP response or browser.
export function createJevDispatchPort(options:JevDispatchOptions={}):JevDispatchPort{
  let complete=typeof options.credential==='function'&&!!options.model&&typeof options.db?.prepare==='function'&&!!options.currency?.policy&&options.currency.enabled===true&&typeof options.tokenBounds?.inputUpperBound==='function'&&typeof options.tokenBounds?.outputUpperBound==='function'&&typeof options.transport==='function';
  if(complete){try{const currency=currencyInput(options.currency);if(!currency)complete=false;else{currencyTime(currency,Date.now());currencyProvider(currency,'typesafe','typesafe-reported-token-usage-v1',options.model);}}catch{complete=false;}}
  const state:JevDispatchState=!complete?'unconfigured':options.enabled===true?'configured':'disabled';
  return Object.freeze({state,async evaluate(content:string,ownerRef:string,signal?:AbortSignal){
    if(state!=='configured')throw new JevError(state==='disabled'?'jev_disabled':'jev_orchestration_unconfigured');
    let apiKey:string|null;
    if(typeof ownerRef!=='string'||!/^signed-admin:[a-f0-9]{64}$/.test(ownerRef))throw new JevError('jev_owner_unavailable');
    try{apiKey=await options.credential!(ownerRef);}catch{throw new JevError('jev_secret_unavailable');}
    if(typeof apiKey!=='string')throw new JevError('jev_secret_missing_or_invalid');
    const chargedExecution=createJevCurrencyAuthority({enabled:true,currency:options.currency,db:options.db,tokenBounds:options.tokenBounds});
    const adapter=createJevDecisionAdapter({enabled:true,apiKey,model:options.model,transport:options.transport,chargedExecution});
    return adapter.evaluate(content,signal);
  }});
}
