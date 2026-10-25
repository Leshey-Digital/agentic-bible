import type {SqlDatabase} from '../editorial/contracts.ts';
import type {Ports} from './contracts.ts';
import {uuid} from './contracts.ts';
import {adminTrust,hostedOrigin,verifySignedAdmin} from './identity.ts';
import {hostedTarget,sourceCitations} from './targets.ts';
import {acquireMaintenanceSource,verifyAcquiredSource} from '../maintenance-adapters/acquisition.ts';
import {extractionProfile,SourceAdapterError} from '../maintenance-adapters/profiles.ts';
import {createSourcedDraftPreparer} from '../maintenance-adapters/sourced-draft.ts';
import {createCloudflareProseAdapter,cloudflareProseModel,type WorkersAiBinding} from '../maintenance-adapters/cloudflare-prose.ts';
import {createCloudflareLlama32InputTokenUpperBound} from '../maintenance-adapters/cloudflare-llama32-input-bound.ts';
import {currencyInput,currencyProvider,currencyTime,type CurrencyControl} from '../wiki-bridge/maintenance-currency.ts';
import {policyInput} from '../wiki-bridge/maintenance-provider.ts';
import type {WebFetch} from '../monitoring/http-core.ts';

export class CloudflareDraftError extends Error {readonly code:string;readonly status:number;constructor(code:string,status:number){super(code);this.code=code;this.status=status;}}
export type CloudflareDraftInput={articleId:string;sourceId:string;requestKey:string;citationId:string};
export type CloudflareDraftOptions={enabled?:boolean;trust?:unknown;db?:SqlDatabase;ai?:WorkersAiBinding;currency?:CurrencyControl;policy?:unknown;reviewSource?:Ports['reviewSource'];sourceSend?:WebFetch};
function fail(code:string,status=503):never{throw new CloudflareDraftError(code,status);}
// No construction performs I/O. Only this explicit signed request may acquire a
// registered source and generate an unapproved draft. There is no inbox writer.
export function createCloudflareDraftAction(options:CloudflareDraftOptions={}){
 const trust=adminTrust(options.trust);let currency:ReturnType<typeof currencyInput>,policy:ReturnType<typeof policyInput>|undefined;
 try{currency=currencyInput(options.currency);policy=policyInput(options.policy);if(!currency||currency.monthLimit>20_000_000)throw Error();currencyProvider(currency,'cloudflare-workers-ai','cloudflare-reported-token-usage-v1',cloudflareProseModel);}catch{currency=undefined;policy=undefined;}
 const complete=!!trust&&!!currency&&!!policy&&typeof options.db?.prepare==='function'&&typeof options.ai?.run==='function'&&typeof options.reviewSource==='function';
 const state=!complete?'unconfigured' as const:options.enabled===true?'configured' as const:'disabled' as const;
 async function acquire(request:Request,input:unknown){
  if(state!=='configured')fail('cloudflare_draft_'+state);
  if(request.method!=='POST')fail('explicit_post_required',405);
  if(new URL(request.url).origin!==hostedOrigin||request.headers.get('origin')!==hostedOrigin||request.headers.get('x-agentic-bible-request')!=='admin'||request.headers.get('sec-fetch-site')==='cross-site')fail('same_origin_required',403);
  const admin=await verifySignedAdmin(request,trust!);if(!admin)fail('verified_admin_required',403);
  const fresh=()=>{if(admin.expiresAt<=Date.now()||request.signal.aborted)fail('verified_admin_required',403);};
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='articleId,citationId,requestKey,sourceId')fail('invalid_request',400);
  const selected=structuredClone(input) as CloudflareDraftInput;
  const target=hostedTarget(selected.articleId),profile=extractionProfile(selected.sourceId);
  if(!target||!profile||!uuid(selected.requestKey)||typeof selected.citationId!=='string')fail('invalid_request',400);
  try{
   const source=structuredClone(await options.reviewSource!(target.articleId));fresh();
   if(source.articleId!==target.articleId||source.contentPath!==target.contentPath||!sourceCitations(source.markdown).includes(selected.citationId))fail('draft_source_mismatch',409);
   const front=/^---\n([^]*?)\n---\n/.exec(source.markdown)?.[1]??'';
   const declaration=front.split('\n  - id: ').slice(1).find(block=>block.split('\n')[0]===selected.citationId),urls=declaration?.match(/^    url: (\S+)$/gm)??[];
   if(urls.length!==1||urls[0].slice(9)!==profile.url)fail('draft_source_mismatch',409);
   // Only errors from source acquisition can claim that no AI was invoked.
   // Keep model/persistence errors outside this boundary and conservative.
   let packet;
   try{packet=await acquireMaintenanceSource({sourceId:profile.sourceId,requestKey:selected.requestKey},{enabled:true,db:options.db!,send:(url,init)=>{fresh();return options.sourceSend?options.sourceSend(url,init):fetch(url,{...init,method:'GET',credentials:'omit',cache:'no-store'});}});}
   catch(error){
    if(error instanceof SourceAdapterError){
     if(['body_too_large','adapter_raw_limit'].includes(error.code))fail('cloudflare_source_too_large',422);
     if(['adapter_evidence_limit','adapter_excerpt_limit'].includes(error.code))fail('cloudflare_source_evidence_limit',422);
     if(error.code==='adapter_existing_attempt_no_refetch')fail('cloudflare_source_attempt_recorded',409);
    }
    throw error;
   }fresh();
   return {target,selected,source,packet,fresh};
  }catch(error){if(error instanceof CloudflareDraftError)throw error;return fail('cloudflare_source_unavailable');}
 }
 return Object.freeze({state,
  async qualifySource(request:Request,input:unknown){
   // Source-only qualification is deliberately restricted to the distinct
   // registered OpenAI document. No model adapter or inbox writer is reachable.
   if(!input||typeof input!=='object'||(input as CloudflareDraftInput).sourceId!=='s-90f2bf11e4fb71c8f42ae128')fail('invalid_request',400);
   const {source,selected,packet,fresh}=await acquire(request,input);
   const verified=await verifyAcquiredSource(packet,{db:options.db!});fresh();
   return {kind:'source-only-qualification' as const,requestKey:selected.requestKey,articleId:source.articleId,citationId:selected.citationId,baseCommit:source.baseCommit,baseMarkdownSha256:source.baseMarkdownSha256,
    source:{...verified.source,raw:{...verified.source.raw,bytes:Array.from(verified.source.raw.bytes)}},receipt:verified.receipt,
    aiInvoked:false as const,approved:false as const,published:false as const};
  },
  async prepare(request:Request,input:unknown,retain?:(checkpoint:{prompt:string;maxOutputTokens:number})=>Promise<void>){
   try{
   if(state!=='configured')fail('cloudflare_draft_'+state);
   currencyTime(currency!,Date.now());
   const {target,selected,source,packet,fresh}=await acquire(request,input);
   const adapter=createCloudflareProseAdapter({enabled:true,db:options.db,policy,currency:{enabled:true,policy:currency},inputTokenUpperBound:createCloudflareLlama32InputTokenUpperBound({rawPrompt:true}),ai:{run:(model,value)=>{fresh();return options.ai!.run(model,value);}}});
   const preparer=createSourcedDraftPreparer({beforeGenerate:async prompt=>{if(retain){fresh();await retain({prompt,maxOutputTokens:policy!.maxOutputTokens});fresh();}},verifySource:async value=>{const result=await verifyAcquiredSource(value,{db:options.db!});fresh();return result;},generate:prompt=>{fresh();return adapter.generate(prompt);}});
   const draft=await preparer.prepare({articleId:target.articleId,baseCommit:source.baseCommit,baseMarkdownSha256:source.baseMarkdownSha256,markdown:source.markdown},[{citationId:selected.citationId,packet}]);fresh();return draft;
  }catch(error){if(error instanceof CloudflareDraftError)throw error;return fail('cloudflare_draft_unavailable');}
 }});
}
export type CloudflareDraftAction=ReturnType<typeof createCloudflareDraftAction>;

export type CloudflareDraftResult=Awaited<ReturnType<CloudflareDraftAction['prepare']>>;
