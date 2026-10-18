import {assessQuality,readQualityAdmission,requireQualityAllow} from '../maintenance-quality/admission.ts';
import {qualityIdentity,type QualityControl} from '../maintenance-quality/contracts.ts';
import {currencyInput,currencyProvider,type CurrencyControl,type Usage} from './maintenance-currency.ts';
import {readMaintenanceBase,type CanonicalBasePort} from '../maintenance-base/read.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash,type Article} from '../publishing/contracts.ts';
import {bridgeInput,validateEvidence,type Apply} from './contracts.ts';
import {projectFiles} from './files.ts';
import {WikiBridge,type BridgePhase} from './store.ts';
import {MaintenanceBudget,type ProposalRow} from './maintenance-budget.ts';
import {MaintenanceError,stop,policyInput,sourceData,tokens,validateReply,invokeBounded,type Provider,type ProviderRequest} from './maintenance-provider.ts';
type Context={quality?:QualityControl;currency?:CurrencyControl;canonicalBase?:CanonicalBasePort;enabled?:boolean;policy?:unknown;provider?:Provider;db:SqlDatabase;bridge:WikiBridge;sourceDirectory:string;clock?:()=>number;checkpoint?:(phase:'reserved'|'proposal-ready')=>void|Promise<void>;bridgeCheckpoint?:(phase:BridgePhase)=>void|Promise<void>};
// Trusted code port only. No shipped route, schedule, secret or real provider config imports this producer.
export async function runMaintenance(value:unknown,context:Context){
 if(context.enabled!==true||!context.provider||context.provider.kind!=='deterministic-extractive-fake'||context.provider.id!=='fake-extractive-v1'||context.provider.tokenizer!=='synthetic-utf8-bytes')stop('maintenance_provider_disabled');
 if(context.quality)qualityIdentity(context.quality);
 const currency=currencyInput(context.currency);currencyProvider(currency,'fake-extractive-v1','synthetic-utf8-bytes');
 const policy=policyInput(context.policy),command=bridgeInput(value);if(command.kind!=='apply'||command.revision.article.reviewedCorrections)stop('maintenance_not_community_approval');
 const now=(context.clock??Date.now)();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('maintenance_clock');
 const project=projectFiles(context.bridge.repo);if(hash(project.files['src/content/articles/tool-use.md'])!==command.originalMarkdownHash)stop('maintenance_original_changed');
 const evidence=await validateEvidence(command,context.db,context.sourceDirectory);
 if(evidence.bindings.some(b=>b.observedAt>now||now-b.observedAt>policy.maxSourceAgeMs))stop('maintenance_stale_evidence');
 const basePort=context.canonicalBase?{...context.canonicalBase}:undefined,base=basePort?readMaintenanceBase(basePort,context.bridge.repo):undefined;
 const request:ProviderRequest={schemaVersion:1,kind:'extractive-source-data',sources:command.evidence.map(e=>sourceData(e.citationId,e.bodyHash,evidence.files[e.bodyHash])),maxOutputTokens:policy.maxOutputTokens,...(base?{canonicalBase:{untrusted:true as const,sourceCommit:base.metadata.sourceCommit,receiptHash:base.metadata.receipt.receiptHash,articleRevision:base.metadata.receipt.articleRevision,markdownSha256:base.metadata.receipt.markdownSha256,markdown:base.markdown}}:{})};
 const inputTokens=tokens(request);if(inputTokens>policy.maxInputTokens)stop('maintenance_input_tokens');
 const fingerprint=hash(canonical({command,sourceTreeHash:project.hash,evidenceHash:evidence.evidenceHash,bridge:context.bridge.root,policy,...(context.quality?{quality:qualityIdentity(context.quality)}:{}),...(currency?{currency}:{}),provider:context.provider.id,...(base?{canonicalBase:base.metadata}:{})})),budget=new MaintenanceBudget(context.db,currency?{enabled:true,policy:currency}:undefined);
 let row=await budget.job(command.eventId),generatedNow=false;
 if(row&&row.fingerprint!==fingerprint)stop('maintenance_event_conflict');if(row)budget.verifyCurrency(row);
 const freshBase=()=>{if(basePort)readMaintenanceBase(basePort,context.bridge.repo,true);};
 if(row?.state!=='complete')freshBase();
 if(!row){
  const active=context.bridge.current(),publisher=context.bridge.publisher.current(),status=context.bridge.status();
  if(canonical(active?.reference??null)!==canonical(command.expectedSite)||canonical(publisher?.reference??null)!==canonical(command.expectedPublisher)||(publisher?.manifest.state.articles['tool-use']??null)!==command.revision.baseRevision)stop('maintenance_stale_base');
  if(active&&active.manifest.state.sourceTreeHash!==project.hash||status.pending.length||status.active&&status.active.sequence>=7||status.storage.accountedBytes+96*1024*1024>status.storage.limitBytes)stop('maintenance_bridge_unavailable');
  row=await budget.reserve(command.eventId,fingerprint,policy,inputTokens,now);await context.checkpoint?.('reserved');
  let response:unknown,packet:Apply,actualCost:number,usage:Usage;
  try{const eligible=currency?await budget.dispatchEligibility(row):undefined;freshBase();eligible?.((context.clock??Date.now)());response=await invokeBounded(context.provider,request);const checked=validateReply(response,request,policy);actualCost=checked.actualCost;usage=checked.usage;packet=generated(command,checked.output.extracts.map(e=>({citationId:e.citationId,quote:e.quote})),evidence.bindings.map(b=>b.observedAt));}
  catch(error){await budget.rejected(row,!(error instanceof MaintenanceError)||error.code==='maintenance_provider_timeout');throw error instanceof MaintenanceError?error:new MaintenanceError('maintenance_provider_failed');}
  try{await budget.ready(row,response,packet,actualCost,{usage,now:(context.clock??Date.now)()});}catch(error){if(currency){try{await budget.rejected(row,true);}catch{/* Existing reservation remains held. */}}throw error;}generatedNow=true;row=(await budget.job(command.eventId))!;await context.checkpoint?.('proposal-ready');
 }
 if(row.state==='calling'||row.state==='uncertain')stop('maintenance_provider_unconfirmed_no_retry');if(row.state==='failed')stop('maintenance_provider_rejected_no_retry');
 const saved=verified(row,command,request,policy,evidence.bindings.map(b=>b.observedAt));budget.verifyCurrency(row,JSON.parse(row.response!).usage,true);
 if(row.state==='complete'&&!context.bridge.current()?.manifest.state.events.some(e=>e.eventId===command.eventId&&e.fingerprint===hash(canonical(saved))))stop('maintenance_receipt_unavailable');
 if(row.state!=='complete')freshBase();
 if(context.quality){const admission=await assessQuality(command.eventId,saved.revision.article,command.evidence.map(e=>({...e,bytes:evidence.files[e.bodyHash]})),{db:context.db,quality:context.quality,clock:context.clock});requireQualityAllow(admission);}
 const result=await context.bridge.execute(saved,context.db,context.sourceDirectory,{checkpoint:context.bridgeCheckpoint});
 if(row.state==='complete'){if(row.receipt!==canonical(result))stop('maintenance_receipt_corrupt');return {mode:'local-synthetic-only' as const,provider:'deterministic-extractive-fake' as const,livePublished:false,generated:false,receipt:result};}
 await budget.complete(row,result);return {mode:'local-synthetic-only' as const,provider:'deterministic-extractive-fake' as const,livePublished:false,generated:generatedNow,receipt:result};
}
function generated(command:Apply,extracts:{citationId:string;quote:string}[],dates:number[]):Apply{
 const article:Article={...structuredClone(command.revision.article),title:'Tool use',description:'Deterministic fake-provider excerpts of untrusted original synthetic source data; not factual or official-source approval.',verified:new Date(Math.min(...dates)).toISOString().slice(0,10),related:['ai-agent','model-context-protocol'],sources:command.revision.article.sources.map(s=>({...s,title:'Supplied synthetic source: '+s.id,publisher:'Supplied synthetic fixture',context:'Exact local source bytes bound to charged receipts. Not an authenticated official retrieval, factual approval or license grant.'})),concerns:['editorial-review'],blocks:[{type:'heading',id:'deterministic-source-excerpts',text:'Deterministic fake-provider source excerpts'},...extracts.map(e=>({type:'paragraph' as const,content:[{type:'text' as const,text:'Exact untrusted synthetic source excerpt: “'+e.quote+'”'},{type:'citation' as const,sourceId:e.citationId}]}))]};
 return bridgeInput({...command,revision:{...command.revision,article}}) as Apply;
}
function verified(row:ProposalRow,command:Apply,request:ProviderRequest,policy:ReturnType<typeof policyInput>,dates:number[]):Apply{
 try{if(!row.response||!row.packet||!row.packet_hash||hash(row.packet)!==row.packet_hash)stop('maintenance_proposal_corrupt');const checked=validateReply(JSON.parse(row.response),request,policy),packet=generated(command,checked.output.extracts.map(e=>({citationId:e.citationId,quote:e.quote})),dates);
  if(canonical(packet)!==row.packet||checked.actualCost!==row.actual_cost||tokens(request)!==row.input_tokens||policy.maxOutputTokens!==row.output_tokens||checked.actualCost>row.reserved_cost)stop('maintenance_proposal_corrupt');return packet;
 }catch{return stop('maintenance_proposal_corrupt');}
}

// Read-only authorization for a downstream writer; never generates or resumes publication.
export async function completedMaintenance(value:unknown,context:Pick<Context,'db'|'bridge'|'sourceDirectory'|'policy'|'clock'|'canonicalBase'|'currency'|'quality'>){
 if(context.quality)qualityIdentity(context.quality);
 const currency=currencyInput(context.currency);currencyProvider(currency,'fake-extractive-v1','synthetic-utf8-bytes');
 const policy=policyInput(context.policy),command=bridgeInput(value);if(command.kind!=='apply'||command.revision.article.reviewedCorrections)stop('maintenance_not_community_approval');
 const now=(context.clock??Date.now)();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('maintenance_clock');
 const project=projectFiles(context.bridge.repo);if(hash(project.files['src/content/articles/tool-use.md'])!==command.originalMarkdownHash)stop('maintenance_original_changed');
 const evidence=await validateEvidence(command,context.db,context.sourceDirectory);if(evidence.bindings.some(b=>b.observedAt>now||now-b.observedAt>policy.maxSourceAgeMs))stop('maintenance_stale_evidence');
 const basePort=context.canonicalBase?{...context.canonicalBase}:undefined,base=basePort?readMaintenanceBase(basePort,context.bridge.repo):undefined;
 const request:ProviderRequest={schemaVersion:1,kind:'extractive-source-data',sources:command.evidence.map(e=>sourceData(e.citationId,e.bodyHash,evidence.files[e.bodyHash])),maxOutputTokens:policy.maxOutputTokens,...(base?{canonicalBase:{untrusted:true as const,sourceCommit:base.metadata.sourceCommit,receiptHash:base.metadata.receipt.receiptHash,articleRevision:base.metadata.receipt.articleRevision,markdownSha256:base.metadata.receipt.markdownSha256,markdown:base.markdown}}:{})};
 const fingerprint=hash(canonical({command,sourceTreeHash:project.hash,evidenceHash:evidence.evidenceHash,bridge:context.bridge.root,policy,...(context.quality?{quality:qualityIdentity(context.quality)}:{}),...(currency?{currency}:{}),provider:'fake-extractive-v1',...(base?{canonicalBase:base.metadata}:{})}));
 const budget=new MaintenanceBudget(context.db,currency?{enabled:true,policy:currency}:undefined),row=await budget.job(command.eventId);if(!row||row.state!=='complete'||row.fingerprint!==fingerprint||!row.receipt)stop('maintenance_completed_authority_required');
 if(row.reserved_cost!==tokens(request)*policy.inputRate+policy.maxOutputTokens*policy.outputRate)stop('maintenance_proposal_corrupt');
 const saved=verified(row,command,request,policy,evidence.bindings.map(b=>b.observedAt));budget.verifyCurrency(row,JSON.parse(row.response!).usage,true);const current=context.bridge.current(),event=current?.manifest.state.events.find(e=>e.eventId===command.eventId&&e.fingerprint===hash(canonical(saved)));
 if(!current||!event)stop('maintenance_receipt_unavailable');
 const receipt={...event,outcome:'site-activated' as const,site:event.sequence===current.manifest.state.sequence?current.reference:current.manifest.state.ancestors[event.sequence-1],parent:event.sequence===1?null:current.manifest.state.ancestors[event.sequence-2]};
 if(canonical(receipt)!==row.receipt)stop('maintenance_receipt_corrupt');
 const site=context.bridge.load(receipt.site),publisher=context.bridge.publisher.load(receipt.publisher),articleRevision=hash(canonical(saved.revision.article));
 if(site.state.sourceTreeHash!==project.hash||site.state.articleRevision!==articleRevision||canonical(site.state.publisher)!==canonical(receipt.publisher)||publisher.state.articles['tool-use']!==articleRevision||canonical(context.bridge.publisher.revision(articleRevision))!==canonical(saved.revision.article)||!publisher.state.receipts.some(r=>r.eventId===command.eventId&&r.fingerprint===hash(canonical(saved.revision))))stop('maintenance_receipt_corrupt');
 const quality=context.quality?await readQualityAdmission(command.eventId,saved.revision.article,command.evidence.map(e=>({...e,bytes:evidence.files[e.bodyHash]})),{db:context.db,quality:context.quality}):undefined;if(quality)requireQualityAllow(quality);
 return {...(quality?{quality}:{}),...(base?{canonicalBase:base.metadata}:{}),command:saved,fingerprint,packetHash:row.packet_hash!,providerResponseHash:hash(row.response!),sourceTreeHash:project.hash,evidenceHash:evidence.evidenceHash,bindings:evidence.bindings,receipt,articleRevision,generation:{unit:policy.unit,inputTokens:row.input_tokens,reservedOutputTokens:row.output_tokens,actualOutputTokens:JSON.parse(row.response!).usage.outputTokens,reservedCost:row.reserved_cost,actualCost:row.actual_cost}};
}

// Verify a known semantic denial without publishing, refunding or redispatching.
export async function deniedMaintenance(value:unknown,context:Pick<Context,'db'|'bridge'|'sourceDirectory'|'policy'|'clock'|'canonicalBase'|'currency'|'quality'>,historicalReplay=false){
 if(!context.quality)stop('quality_verifier_unconfigured');qualityIdentity(context.quality);
 const currency=currencyInput(context.currency);currencyProvider(currency,'fake-extractive-v1','synthetic-utf8-bytes');
 const policy=policyInput(context.policy),command=bridgeInput(value);if(command.kind!=='apply'||command.revision.article.reviewedCorrections)stop('maintenance_not_community_approval');
 const now=(context.clock??Date.now)();if(!Number.isSafeInteger(now)||now<0||now>253402300799999)stop('maintenance_clock');
 const project=projectFiles(context.bridge.repo);if(hash(project.files['src/content/articles/tool-use.md'])!==command.originalMarkdownHash)stop('maintenance_original_changed');
 const evidence=await validateEvidence(command,context.db,context.sourceDirectory);if(!historicalReplay&&evidence.bindings.some(b=>b.observedAt>now||now-b.observedAt>policy.maxSourceAgeMs))stop('maintenance_stale_evidence');
 const basePort=context.canonicalBase?{...context.canonicalBase}:undefined,base=basePort?readMaintenanceBase(basePort,context.bridge.repo):undefined;
 const request:ProviderRequest={schemaVersion:1,kind:'extractive-source-data',sources:command.evidence.map(e=>sourceData(e.citationId,e.bodyHash,evidence.files[e.bodyHash])),maxOutputTokens:policy.maxOutputTokens,...(base?{canonicalBase:{untrusted:true as const,sourceCommit:base.metadata.sourceCommit,receiptHash:base.metadata.receipt.receiptHash,articleRevision:base.metadata.receipt.articleRevision,markdownSha256:base.metadata.receipt.markdownSha256,markdown:base.markdown}}:{})};
 const fingerprint=hash(canonical({command,sourceTreeHash:project.hash,evidenceHash:evidence.evidenceHash,bridge:context.bridge.root,policy,...(context.quality?{quality:qualityIdentity(context.quality)}:{}),...(currency?{currency}:{}),provider:'fake-extractive-v1',...(base?{canonicalBase:base.metadata}:{})}));

 const budget=new MaintenanceBudget(context.db,currency?{enabled:true,policy:currency}:undefined),row=await budget.job(command.eventId);if(!row||row.state!=='ready'||row.fingerprint!==fingerprint||row.receipt)stop('maintenance_quality_denial_authority');
 const saved=verified(row,command,request,policy,evidence.bindings.map(b=>b.observedAt));budget.verifyCurrency(row,JSON.parse(row.response!).usage,true);
 const quality=await readQualityAdmission(command.eventId,saved.revision.article,command.evidence.map(e=>({...e,bytes:evidence.files[e.bodyHash]})),{db:context.db,quality:context.quality});if(quality.decision!=='deny')stop('maintenance_quality_denial_authority');return quality;
}
