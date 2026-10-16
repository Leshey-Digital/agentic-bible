import {createHttpPass,HttpError} from './http-core.ts';
import {httpLimits,publicAddress,type PublicAddress} from './http-policy.ts';
import {nodeFetch,resolveAddresses,type ControlledFetch} from './http-node.ts';
export type {HttpLastGood,HttpResult} from './http-core.ts';
export function createHttpSourcePass(dependencies:{fetch?:ControlledFetch;resolve?:(host:string)=>Promise<PublicAddress[]>;clock?:()=>number}={}) {
  const resolve=dependencies.resolve??resolveAddresses;const fetch=dependencies.fetch??nodeFetch;
  return createHttpPass({clock:dependencies.clock,fetch:async(url,options)=>{
    const addresses=await resolve(new URL(url).hostname);
    if(options.signal.aborted)throw new HttpError('http_aborted',true);
    if(!Array.isArray(addresses)||!addresses.length||addresses.length>httpLimits.dnsAnswers||Array.from(addresses).some(address=>!publicAddress(address)))throw new HttpError('dns_not_public');
    return fetch(url,{...options,address:{...addresses[0]}});
  }});
}
