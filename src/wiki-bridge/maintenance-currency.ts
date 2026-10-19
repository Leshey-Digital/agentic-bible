import {canonical,hash} from '../publishing/contracts.ts';
import {shape,stop} from './maintenance-provider.ts';
export type CurrencyPrice={id:string;provider:string;model:string;tokenizer:string;basis:'input-output-tokens';inputPerMillion:number;outputPerMillion:number;requestFee:number};
export type CurrencyPolicyV1={schemaVersion:1;unit:'MICRO_USD';account:string;runLimit:number;dayLimit:number;monthLimit:number;dayBaseline:number;monthBaseline:number;price:CurrencyPrice&{validFrom:number;validUntil:number}};
export type CurrencyPolicyV2={schemaVersion:2;unit:'MICRO_USD';account:string;runLimit:number;dayLimit:number;monthLimit:number;dayBaseline:number;monthBaseline:number;validFrom:number;validUntil:number;prices:readonly CurrencyPrice[]};
export type CurrencyPolicy=CurrencyPolicyV1|CurrencyPolicyV2;
export type CurrencyControl={enabled?:boolean;policy?:unknown};
export type Usage={inputTokens:number;outputTokens:number};
const clock=(n:unknown):n is number=>Number.isSafeInteger(n)&&(n as number)>=0&&(n as number)<=253402300799999;
const baseKeys=['schemaVersion','unit','account','runLimit','dayLimit','monthLimit','dayBaseline','monthBaseline'];
const priceKeys=['id','provider','model','tokenizer','basis','inputPerMillion','outputPerMillion','requestFee'];
function monthlyWindow(from:unknown,until:unknown){
 if(!clock(from)||!clock(until))return false;const a=new Date(from),b=new Date(until);
 return a.getUTCDate()===1&&a.getUTCHours()===0&&a.getUTCMinutes()===0&&a.getUTCSeconds()===0&&a.getUTCMilliseconds()===0&&
  until===Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,1)&&b.getTime()===until&&until>from&&until-from<=32*86400000;
}
function card(value:unknown){
 shape(value,priceKeys);const p=value as CurrencyPrice;
 for(const s of [p.id,p.provider,p.tokenizer])if(typeof s!=='string'||!/^[-a-z0-9.]{3,80}$/.test(s))stop('maintenance_currency_price');
 if(typeof p.model!=='string'||!/^[-a-z0-9.@/]{3,120}$/.test(p.model))stop('maintenance_currency_price');
 for(const n of [p.inputPerMillion,p.outputPerMillion,p.requestFee])if(!Number.isSafeInteger(n)||n<0||n>100000000)stop('maintenance_currency_policy');
 if(p.inputPerMillion<1||p.basis!=='input-output-tokens')stop('maintenance_currency_policy');
 return Object.freeze({...p});
}
// Currency is exact integer micro-USD; neither a default allocation nor a live rate card.
export function currencyInput(value:CurrencyControl|undefined):Readonly<CurrencyPolicy>|undefined{
 if(value===undefined)return undefined;
 if(value?.enabled!==true)stop('maintenance_currency_disabled');shape(value,['enabled','policy']);
 const raw=value.policy as CurrencyPolicy;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))stop('maintenance_currency_policy');
 if(raw.schemaVersion===1){
  shape(raw,[...baseKeys,'price']);shape(raw.price,[...priceKeys,'validFrom','validUntil']);
  const p=raw as CurrencyPolicyV1,price=card(Object.fromEntries(priceKeys.map(key=>[key,(p.price as unknown as Record<string,unknown>)[key]])));
  if(!clock(p.price.validFrom)||!clock(p.price.validUntil)||p.price.validUntil<=p.price.validFrom||p.price.validUntil-p.price.validFrom>32*86400000)stop('maintenance_currency_policy');
  const base=basePolicy(p);return Object.freeze({...base,price:Object.freeze({...price,validFrom:p.price.validFrom,validUntil:p.price.validUntil})});
 }
 if(raw.schemaVersion===2){
  shape(raw,[...baseKeys,'validFrom','validUntil','prices']);const p=raw as CurrencyPolicyV2;
  if(!monthlyWindow(p.validFrom,p.validUntil)||!Array.isArray(p.prices)||p.prices.length<1||p.prices.length>8)stop('maintenance_currency_policy');
  const prices=p.prices.map(card);const ids=new Set<string>(),identities=new Set<string>();
  for(const price of prices){const identity=`${price.provider}\n${price.model}\n${price.tokenizer}`;if(ids.has(price.id)||identities.has(identity))stop('maintenance_currency_price');ids.add(price.id);identities.add(identity);}
  return Object.freeze({...basePolicy(p),validFrom:p.validFrom,validUntil:p.validUntil,prices:Object.freeze(prices)});
 }
 return stop('maintenance_currency_policy');
}
function basePolicy(p:CurrencyPolicyV1):Omit<CurrencyPolicyV1,'price'>;
function basePolicy(p:CurrencyPolicyV2):Omit<CurrencyPolicyV2,'prices'|'validFrom'|'validUntil'>;
function basePolicy(p:CurrencyPolicy):Omit<CurrencyPolicyV1,'price'>|Omit<CurrencyPolicyV2,'prices'|'validFrom'|'validUntil'>;
function basePolicy(p:CurrencyPolicy){
 if(p.unit!=='MICRO_USD'||typeof p.account!=='string'||!/^[-a-z0-9]{3,64}$/.test(p.account))stop('maintenance_currency_policy');
 for(const n of [p.runLimit,p.dayLimit,p.monthLimit,p.dayBaseline,p.monthBaseline])if(!Number.isSafeInteger(n)||n<0||n>100000000)stop('maintenance_currency_policy');
 if(p.runLimit<1||p.dayLimit<p.runLimit||p.monthLimit<p.dayLimit||p.dayBaseline>p.dayLimit||p.monthBaseline>p.monthLimit)stop('maintenance_currency_policy');
 return {schemaVersion:p.schemaVersion,unit:p.unit,account:p.account,runLimit:p.runLimit,dayLimit:p.dayLimit,monthLimit:p.monthLimit,dayBaseline:p.dayBaseline,monthBaseline:p.monthBaseline};
}
export function currencyPrices(p:Readonly<CurrencyPolicy>):readonly (CurrencyPrice&{validFrom:number;validUntil:number})[]{
 return p.schemaVersion===1?[p.price]:p.prices.map(price=>({...price,validFrom:p.validFrom,validUntil:p.validUntil}));
}
export function currencyPrice(p:Readonly<CurrencyPolicy>|undefined,id:string):CurrencyPrice&{validFrom:number;validUntil:number}{
 if(!p)stop('maintenance_currency_price');const found=currencyPrices(p).find(price=>price.id===id);if(!found)stop('maintenance_currency_price');return found;
}
export function currencyCost(p:Readonly<CurrencyPolicy>,usage:Usage,priceId?:string){
 const prices=currencyPrices(p),price=priceId?currencyPrice(p,priceId):prices.length===1?prices[0]:undefined;if(!price)stop('maintenance_currency_price');
 shape(usage,['inputTokens','outputTokens']);if(!Number.isSafeInteger(usage.inputTokens)||usage.inputTokens<1||usage.inputTokens>8192||!Number.isSafeInteger(usage.outputTokens)||usage.outputTokens<0||usage.outputTokens>2048)stop('maintenance_currency_usage');
 // Round each separately billed dimension upward. BigInt prevents intermediate overflow.
 const ceil=(n:bigint)=>(n+999999n)/1000000n;
 const cost=BigInt(price.requestFee)+ceil(BigInt(usage.inputTokens)*BigInt(price.inputPerMillion))+ceil(BigInt(usage.outputTokens)*BigInt(price.outputPerMillion));
 if(cost>100000000n)stop('maintenance_currency_cost_limit');return Number(cost);
}
export function currencyWindow(p:Readonly<CurrencyPolicy>){return p.schemaVersion===1?{validFrom:p.price.validFrom,validUntil:p.price.validUntil}:{validFrom:p.validFrom,validUntil:p.validUntil};}
export function currencyTime(p:Readonly<CurrencyPolicy>,now:number){const {validFrom,validUntil}=currencyWindow(p);if(!clock(now)||now<validFrom||now>=validUntil)stop('maintenance_currency_price_expired');}
export function currencyProvider(p:Readonly<CurrencyPolicy>|undefined,provider:string,tokenizer:string,model=provider):CurrencyPrice&{validFrom:number;validUntil:number}|undefined{
 if(!p)return undefined;const found=currencyPrices(p).find(price=>price.provider===provider&&price.model===model&&price.tokenizer===tokenizer);if(!found)stop('maintenance_currency_provider');return found;
}
export function currencyPin(p:Readonly<CurrencyPolicy>){const json=canonical(p);return {json,hash:hash(json)};}
