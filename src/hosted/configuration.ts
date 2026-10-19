import {hostedTarget} from './targets.ts';
import {repository,type Ports,type RuntimeEnv} from './contracts.ts';
import {adminTrust,verifySignedAdmin} from './identity.ts';
import {historyBindingConfigured} from '../maintenance-history/review.ts';
import {lookupApproval} from './approvals.ts';
import {createEncryptedIntegrationAdapters} from '../integration-settings/vault.ts';
import {intakeConfigured,type IntakePolicy} from './contributions.ts';
import {createHmacClientKey} from './privacy.ts';
export function credentialTransport(token:unknown,send:typeof fetch=fetch):Ports['sendGitHub']|undefined{
  if(typeof token!=='string'||token.length<16||token.length>512||/\s|[\u0000-\u001f\u007f]/.test(token))return undefined;
  return request=>{
    const url=new URL(request.url),prefix='/repos/'+repository;
    if(url.origin!=='https://api.github.com'||url.username||url.password||url.hash||!url.pathname.startsWith(prefix+'/')||request.redirect!=='manual'||(request.credentials!==undefined&&request.credentials!=='omit')||[...request.headers.keys()].some(name=>!['accept','content-type','user-agent','x-github-api-version'].includes(name)))throw Error('restricted GitHub transport');
    const path=url.pathname.slice(prefix.length),get=request.method==='GET'&&(/^\/git\/ref\/heads\/(main|content-corrections\/[a-f0-9-]{36})$/.test(path)||/^\/git\/(commits|trees)\/[a-f0-9]{40}$/.test(path)||(/^\/contents\/src\/content\/articles\/([a-z0-9-]+)\.md$/.test(path)&&!!hostedTarget(/^\/contents\/src\/content\/articles\/([a-z0-9-]+)\.md$/.exec(path)![1]))||path==='/pulls'),post=request.method==='POST'&&['/git/trees','/git/commits','/git/refs','/pulls'].includes(path);
    if(!get&&!post)throw Error('restricted GitHub transport');
    const headers=new Headers(request.headers);headers.set('Authorization','Bearer '+token);return send(new Request(request,{headers,redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer'}));
  };
}
function policy(raw:unknown):IntakePolicy|undefined{
  if(typeof raw!=='string'||raw.length>2048)return;
  try{const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='moderationReady,policyRevision,privacyPath,termsPath'||v.moderationReady!==true||typeof v.termsPath!=='string'||typeof v.privacyPath!=='string'||typeof v.policyRevision!=='string')return;return v as IntakePolicy;}catch{return;}
}
function keyBytes(raw:unknown):Uint8Array|undefined{
  if(typeof raw!=='string'||raw.length!==44||!/^[A-Za-z0-9+/]{43}=$/.test(raw))return;
  try{const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));return bytes.length===32&&btoa(String.fromCharCode(...bytes))===raw?bytes:undefined;}catch{return;}
}
function keyMaterial(bytes:Uint8Array):ArrayBuffer{const copy=new ArrayBuffer(bytes.byteLength);new Uint8Array(copy).set(bytes);return copy;}
export async function configuredPorts(env:RuntimeEnv):Promise<Ports>{
  const trust=adminTrust(env.HOSTED_ADMIN_TRUST),send=credentialTransport(env.GITHUB_CONTENT_TOKEN);if(!trust||!env.EDITORIAL_DB)return {};
  const review=historyBindingConfigured()?{maintenanceReview:true as const}:{};
  const ports:Ports={...review,verifyAdmin:request=>verifySignedAdmin(request,trust)};
  if(send)Object.assign(ports,{approvedNote:(id:string,admin:import('./contracts.ts').VerifiedAdmin)=>lookupApproval(env.EDITORIAL_DB!,id,admin),sendGitHub:send,hostedApprovals:true as const});
  const intakePolicy=policy(env.HOSTED_INTAKE_POLICY),rateBytes=keyBytes(env.HOSTED_INTAKE_RATE_KEY);
  if(intakePolicy&&rateBytes){const rateKey=await crypto.subtle.importKey('raw',keyMaterial(rateBytes),{name:'HMAC',hash:'SHA-256'},false,['sign']);const candidate={trust:env.HOSTED_ADMIN_TRUST,policy:intakePolicy,clientKey:createHmacClientKey(rateKey)};if(intakeConfigured(candidate))ports.contributions=candidate;}
  const vaultBytes=keyBytes(env.INTEGRATION_VAULT_KEY),keyId=env.INTEGRATION_VAULT_KEY_ID;
  if(vaultBytes&&typeof keyId==='string'&&/^[a-zA-Z0-9._-]{1,64}$/.test(keyId)){
    try{const key=await crypto.subtle.importKey('raw',keyMaterial(vaultBytes),'AES-GCM',false,['encrypt','decrypt']);ports.integrationSettings=createEncryptedIntegrationAdapters({db:env.EDITORIAL_DB,key,keyId,trust:env.HOSTED_ADMIN_TRUST,send:request=>fetch(request),connectionEvidence:'unverified'});}catch{/* Invalid optional vault configuration leaves settings closed. */}
  }
  return ports;
}
