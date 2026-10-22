import {credentialTransport} from './github-transport.ts';
export {credentialTransport} from './github-transport.ts';
import {type Ports,type RuntimeEnv} from './contracts.ts';
import {adminTrust,verifySignedAdmin} from './identity.ts';
import {historyBindingConfigured} from '../maintenance-history/review.ts';
import {lookupApproval} from './approvals.ts';
import {createEncryptedIntegrationAdapters} from '../integration-settings/vault.ts';
import {intakeConfigured,type IntakePolicy} from './contributions.ts';
import {createHmacClientKey} from './privacy.ts';
import {createJevDispatchPort} from './jev-dispatch.ts';
import {jevEndpoint,jevModels,type JevModel} from '../maintenance-adapters/jev.ts';
import {currencyInput,type CurrencyPolicy} from '../wiki-bridge/maintenance-currency.ts';
import type {JevTokenBounds} from '../maintenance-adapters/jev-currency.ts';

function policy(raw:unknown):IntakePolicy|undefined{
  if(typeof raw!=='string'||raw.length>2048)return;
  try{const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='moderationReady,policyRevision,privacyPath,termsPath'||v.moderationReady!==true||typeof v.termsPath!=='string'||typeof v.privacyPath!=='string'||typeof v.policyRevision!=='string')return;return v as IntakePolicy;}catch{return;}
}
function keyBytes(raw:unknown):Uint8Array|undefined{
  if(typeof raw!=='string'||raw.length!==44||!/^[A-Za-z0-9+/]{43}=$/.test(raw))return;
  try{const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));return bytes.length===32&&btoa(String.fromCharCode(...bytes))===raw?bytes:undefined;}catch{return;}
}
function keyMaterial(bytes:Uint8Array):ArrayBuffer{const copy=new ArrayBuffer(bytes.byteLength);new Uint8Array(copy).set(bytes);return copy;}
type JevRuntimePolicy={enabled:boolean;model:JevModel;currency:Readonly<CurrencyPolicy>;inputTokensPerByte:1;outputTokenUpperBound:number};
function jevRuntimePolicy(raw:unknown):JevRuntimePolicy|undefined{
  if(typeof raw!=='string'||raw.length>8192)return;
  try{
    const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return;
    const config=value as Record<string,unknown>;
    if(Object.keys(config).sort().join(',')!=='currency,enabled,inputTokensPerByte,model,outputTokenUpperBound'||typeof config.enabled!=='boolean'||!jevModels.includes(config.model as JevModel)||config.inputTokensPerByte!==1||config.outputTokenUpperBound!==2048)return;
    const currency=currencyInput({enabled:true,policy:config.currency});if(!currency)return;
    return {enabled:config.enabled,model:config.model as JevModel,currency,inputTokensPerByte:1,outputTokenUpperBound:Number(config.outputTokenUpperBound)};
  }catch{return;}
}
function jevTransport(url:string,init:RequestInit):Promise<Response>{
  if(url!==jevEndpoint||init.method!=='POST'||init.redirect!=='error'||init.credentials!=='omit'||init.cache!=='no-store'||init.referrerPolicy!=='no-referrer'||init.signal?.aborted)throw Error('jev_transport_rejected');
  return fetch(url,init);
}
export async function configuredPorts(env:RuntimeEnv,request?:Request):Promise<Ports>{
  const trust=adminTrust(env.HOSTED_ADMIN_TRUST),send=(env.GITHUB_DRAFT_CREDENTIAL_SOURCE===undefined||env.GITHUB_DRAFT_CREDENTIAL_SOURCE==='binding')?credentialTransport(env.GITHUB_CONTENT_TOKEN):undefined;if(!trust||!env.EDITORIAL_DB)return {};
  const review=historyBindingConfigured()?{maintenanceReview:true as const}:{};
  const ports:Ports={...review,verifyAdmin:request=>verifySignedAdmin(request,trust)};
  if(env.HOSTED_PRIVATE_INBOX==='enabled')ports.contributions={trust:env.HOSTED_ADMIN_TRUST};
  if(send)Object.assign(ports,{approvedNote:(id:string,admin:import('./contracts.ts').VerifiedAdmin)=>lookupApproval(env.EDITORIAL_DB!,id,admin),sendGitHub:send,hostedApprovals:true as const});
  const intakePolicy=policy(env.HOSTED_INTAKE_POLICY),rateBytes=keyBytes(env.HOSTED_INTAKE_RATE_KEY);
  if(intakePolicy&&rateBytes){const rateKey=await crypto.subtle.importKey('raw',keyMaterial(rateBytes),{name:'HMAC',hash:'SHA-256'},false,['sign']);const candidate={trust:env.HOSTED_ADMIN_TRUST,policy:intakePolicy,clientKey:createHmacClientKey(rateKey)};if(intakeConfigured(candidate))ports.contributions=candidate;}
  const vaultBytes=keyBytes(env.INTEGRATION_VAULT_KEY),keyId=env.INTEGRATION_VAULT_KEY_ID;
  if(vaultBytes&&typeof keyId==='string'&&/^[a-zA-Z0-9._-]{1,64}$/.test(keyId)){
    try{const key=await crypto.subtle.importKey('raw',keyMaterial(vaultBytes),'AES-GCM',false,['encrypt','decrypt']);ports.integrationSettings=createEncryptedIntegrationAdapters({db:env.EDITORIAL_DB,key,keyId,trust:env.HOSTED_ADMIN_TRUST,send:request=>fetch(request),connectionEvidence:'unverified'});}catch{/* Invalid optional vault configuration leaves settings closed. */}
  }
  // No fallback: vault selection plus a legacy binding is conflicting and closed.
  if(env.GITHUB_DRAFT_CREDENTIAL_SOURCE==='vault'&&env.GITHUB_CONTENT_TOKEN===undefined&&request&&ports.integrationSettings?.gitHubTransport){
    let selected:Promise<NonNullable<Ports['sendGitHub']>>|undefined;
    const adapters=ports.integrationSettings;
    const scoped:NonNullable<Ports['sendGitHub']>=async(outbound,beforeDispatch)=>{
      selected??=(async()=>{const admin=await verifySignedAdmin(request,trust);if(!admin)throw Error('github_vault_unavailable');return adapters.gitHubTransport!(admin);})();
      const transport=await selected;return transport(outbound,beforeDispatch);
    };
    Object.assign(ports,{approvedNote:(id:string,admin:import('./contracts.ts').VerifiedAdmin)=>lookupApproval(env.EDITORIAL_DB!,id,admin),sendGitHub:scoped,hostedApprovals:true as const});
  }
  const jevConfig=jevRuntimePolicy(env.JEV_DISPATCH_POLICY),credential=ports.integrationSettings?.resolveJevCredential;
  if(jevConfig&&credential){
    const tokenBounds:JevTokenBounds={inputUpperBound:requestJson=>new TextEncoder().encode(requestJson).byteLength,outputUpperBound:()=>jevConfig.outputTokenUpperBound};
    ports.jevDispatch=createJevDispatchPort({enabled:jevConfig.enabled,credential,model:jevConfig.model,db:env.EDITORIAL_DB,currency:{enabled:true,policy:jevConfig.currency},tokenBounds,transport:jevTransport});
  }
  return ports;
}
