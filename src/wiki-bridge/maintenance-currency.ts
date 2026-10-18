import {canonical,hash} from '../publishing/contracts.ts';
import {shape,stop} from './maintenance-provider.ts';
export type CurrencyPolicy={schemaVersion:1;unit:'MICRO_USD';account:string;runLimit:number;dayLimit:number;monthLimit:number;dayBaseline:number;monthBaseline:number;price:{id:string;provider:string;model:string;tokenizer:string;basis:'input-output-tokens';inputPerMillion:number;outputPerMillion:number;requestFee:number;validFrom:number;validUntil:number}};
export type CurrencyControl={enabled?:boolean;policy?:unknown};
export type Usage={inputTokens:number;outputTokens:number};
const clock=(n:unknown):n is number=>Number.isSafeInteger(n)&&(n as number)>=0&&(n as number)<=253402300799999;
// Currency is exact integer micro-USD; neither a default allocation nor a live rate card.
export function currencyInput(value:CurrencyControl|undefined):Readonly<CurrencyPolicy>|undefined{
 if(value===undefined)return undefined;
 if(value?.enabled!==true)stop('maintenance_currency_disabled');shape(value,['enabled','policy']);
 const p=value.policy as CurrencyPolicy;shape(p,['schemaVersion','unit','account','runLimit','dayLimit','monthLimit','dayBaseline','monthBaseline','price']);
 shape(p.price,['id','provider','model','tokenizer','basis','inputPerMillion','outputPerMillion','requestFee','validFrom','validUntil']);
 if(p.schemaVersion!==1||p.unit!=='MICRO_USD'||typeof p.account!=='string'||!/^[-a-z0-9]{3,64}$/.test(p.account))stop('maintenance_currency_policy');
 for(const s of [p.price.id,p.price.provider,p.price.model,p.price.tokenizer])if(typeof s!=='string'||!/^[-a-z0-9.]{3,80}$/.test(s))stop('maintenance_currency_price');
 for(const n of [p.runLimit,p.dayLimit,p.monthLimit,p.dayBaseline,p.monthBaseline,p.price.inputPerMillion,p.price.outputPerMillion,p.price.requestFee])if(!Number.isSafeInteger(n)||n<0||n>100000000)stop('maintenance_currency_policy');
 if(p.runLimit<1||p.dayLimit<p.runLimit||p.monthLimit<p.dayLimit||p.dayBaseline>p.dayLimit||p.monthBaseline>p.monthLimit||p.price.inputPerMillion<1||p.price.outputPerMillion<1||p.price.basis!=='input-output-tokens'||!clock(p.price.validFrom)||!clock(p.price.validUntil)||p.price.validUntil<=p.price.validFrom||p.price.validUntil-p.price.validFrom>32*86400000)stop('maintenance_currency_policy');
 return Object.freeze({...p,price:Object.freeze({...p.price})});
}
export function currencyCost(p:Readonly<CurrencyPolicy>,usage:Usage){
 shape(usage,['inputTokens','outputTokens']);if(!Number.isSafeInteger(usage.inputTokens)||usage.inputTokens<1||usage.inputTokens>8192||!Number.isSafeInteger(usage.outputTokens)||usage.outputTokens<0||usage.outputTokens>2048)stop('maintenance_currency_usage');
 // Round each separately billed dimension upward. BigInt prevents intermediate overflow.
 const ceil=(n:bigint)=>(n+999999n)/1000000n;
 const cost=BigInt(p.price.requestFee)+ceil(BigInt(usage.inputTokens)*BigInt(p.price.inputPerMillion))+ceil(BigInt(usage.outputTokens)*BigInt(p.price.outputPerMillion));
 if(cost>100000000n)stop('maintenance_currency_cost_limit');return Number(cost);
}
export function currencyTime(p:Readonly<CurrencyPolicy>,now:number){if(!clock(now)||now<p.price.validFrom||now>=p.price.validUntil)stop('maintenance_currency_price_expired');}
export function currencyProvider(p:Readonly<CurrencyPolicy>|undefined,provider:string,tokenizer:string){if(p&&(p.price.provider!==provider||p.price.model!==provider||p.price.tokenizer!==tokenizer))stop('maintenance_currency_provider');}
export function currencyPin(p:Readonly<CurrencyPolicy>){const json=canonical(p);return {json,hash:hash(json)};}
