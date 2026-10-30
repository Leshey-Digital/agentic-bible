import {sourceBodyLimit} from '../monitoring/http-registry.ts';
import {assertSourceCaptureSchema,readSourceCapture,retainSourceCapture,captureReference,type CaptureReference} from './source-capture.ts';
import {createHostedCanonicalPublisher,type HostedCanonicalOptions} from './canonical.ts';
import {createHostedCompleteCandidateAction,type CompleteCandidateOptions} from './complete-candidate.ts';
import {admitSourceBackedPublication} from './authority.ts';
import {currencyInput,currencyPin} from '../wiki-bridge/maintenance-currency.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {articleInput,sourceBackedArticleInput,canonical,commandInput,digestId,hash,type Article,type Publish} from '../publishing/contracts.ts';
import type {PublicationStore} from '../publishing/store.ts';
import {maintenanceTarget} from '../maintenance-quality/target.ts';
import {assessQuality} from '../maintenance-quality/admission.ts';
import {qualityIdentity,snapshotQuality,type QualityControl} from '../maintenance-quality/contracts.ts';
import {executeQualityPublication} from '../maintenance-quality/publisher.ts';
import {acquireMaintenanceSource,verifyAcquiredSourceReference} from '../maintenance-adapters/acquisition.ts';
import {createAcquiredQualitySourcePort} from '../maintenance-adapters/quality-source.ts';
import {extractionProfile} from '../maintenance-adapters/profiles.ts';
import type {WebFetch} from '../monitoring/http-core.ts';
import {MaintenanceBudget} from '../wiki-bridge/maintenance-budget.ts';
import {extractedSourceData,invokeBounded,policyInput,tokens,validateReply,type Provider,type ProviderRequest} from '../wiki-bridge/maintenance-provider.ts';
import {PipelineLedger,type Row} from '../maintenance-pipeline/ledger.ts';

export class HostedMaintenanceError extends Error {readonly code:string;constructor(code:string){super(code);this.code=code;}}
function stop(code:string):never{throw new HostedMaintenanceError(code);}
export const hostedMaintenanceLimits=Object.freeze({sources:2,journalBytes:49152,maximumDelayMs:3600000});
export type HostedMaintenanceSelection={article:Article;baseRevision:string|null;sources:{citationId:string;sourceId:string}[]};
export type HostedMaintenanceEvent={scheduledTime:number;cron:string};
export type HostedMaintenanceOptions={
 enabled?:boolean;db?:SqlDatabase;selection?:HostedMaintenanceSelection;cron?:string;policy?:unknown;
 source?:{kind:'controlled-maintenance-source-port-v1'|'bounded-official-http-source-v2';send:WebFetch};provider?:Provider;quality?:QualityControl;
 // Existing publisher lifecycle contract. No canonical Git/release authority is
 // created by this port, and no filesystem publisher is imported at runtime.
 publisher?:Pick<PublicationStore,'execute'>;completeCandidate?:Omit<CompleteCandidateOptions,'article'|'db'|'clock'>;canonical?:Omit<HostedCanonicalOptions,'db'|'clock'>;clock?:()=>number;
 checkpoint?:(phase:'source-ready'|'proposal-ready'|'quality-ready'|'publication-ready')=>void|Promise<void>;
};
type Journal={sources?:CaptureReference[]};
const time=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=253402300799999;
const uuid=(seed:string)=>{const x=hash(seed);return x.slice(0,8)+'-'+x.slice(8,12)+'-'+x.slice(12,16)+'-'+x.slice(16,20)+'-'+x.slice(20,32);};
function selected(value:HostedMaintenanceSelection,native=false){
 const article=native?sourceBackedArticleInput(value.article):articleInput(value.article);maintenanceTarget(article.id);
 if(article.reviewedCorrections||value.baseRevision!==null&&!digestId(value.baseRevision)||!Array.isArray(value.sources)||value.sources.length<1||value.sources.length>hostedMaintenanceLimits.sources||value.sources.length!==article.sources.length)stop('hosted_maintenance_selection');
 const sources=value.sources.map(s=>{const profile=extractionProfile(s.sourceId),citation=article.sources.find(c=>c.id===s.citationId);if(!profile||!citation||citation.url!==profile.url)stop('hosted_maintenance_selection');return {citationId:s.citationId,sourceId:s.sourceId};});
 if(new Set(sources.map(s=>s.citationId)).size!==sources.length||new Set(sources.map(s=>s.sourceId)).size!==sources.length)stop('hosted_maintenance_selection');
 return {article,baseRevision:value.baseRevision,sources};
}
function candidate(selection:HostedMaintenanceSelection,eventId:string,extracts:{citationId:string;quote:string}[],observedAt:number[]):Publish{
 // Complete extractive controlled candidate, never a correction-note approval.
 const article:Article={...selection.article,verified:new Date(Math.min(...observedAt)).toISOString().slice(0,10),concerns:[...new Set([...selection.article.concerns,'editorial-review' as const])],blocks:[
  {type:'heading',id:'controlled-source-excerpts',text:'Controlled source excerpts'},
  ...extracts.map(e=>({type:'paragraph' as const,content:[{type:'text' as const,text:e.quote},{type:'citation' as const,sourceId:e.citationId}]})),
 ]};
 const command=commandInput({schemaVersion:1,kind:'publish',eventId,baseRevision:selection.baseRevision,article});if(command.kind!=='publish')stop('hosted_maintenance_selection');return command;
}

/** A bounded, Workers-importable scheduled composition of the existing source,
 * proposal budget, quality and publication lifecycle. Construction is inert.
 * Native complete generation uses an explicit server-only binding and currency
 * configuration; no source/AI/GitHub or deployment fallback exists, and caller request bodies are never accepted. */
export function createHostedMaintenanceAction(options:HostedMaintenanceOptions={}){
 let configuration:{selection:HostedMaintenanceSelection;policy:ReturnType<typeof policyInput>;quality:QualityControl;cron:string;complete?:CompleteCandidateOptions;completeAction?:ReturnType<typeof createHostedCompleteCandidateAction>;canonical?:Omit<HostedCanonicalOptions,'transport'|'checkpoint'|'clock'|'db'>;canonicalAction?:ReturnType<typeof createHostedCanonicalPublisher>}|undefined;
 try{
  const native=options.completeCandidate!==undefined;
  if(!options.db||typeof options.db.prepare!=='function'||typeof options.db.batch!=='function'||!options.selection||typeof options.cron!=='string'||options.cron.length>80||!/^[-* /,0-9]+$/.test(options.cron)||options.source?.kind!==(native?'bounded-official-http-source-v2':'controlled-maintenance-source-port-v1')||typeof options.source.send!=='function'||(!options.publisher&&!native)||!options.quality)throw Error();
  if(!native&&(options.provider?.kind!=='deterministic-extractive-fake'||options.provider.id!=='fake-extractive-v1'||options.provider.tokenizer!=='synthetic-utf8-bytes'||typeof options.provider.invoke!=='function'))throw Error();
  const quality=snapshotQuality({...options.quality,...(options.canonical?{canonicalContext:{commit:options.canonical.expectedBaseCommit!,markdownSha256:options.canonical.expectedMarkdownHash!,markdown:options.canonical.baselineMarkdown!}}:{})});if(!native&&quality.verifier!.environment!=='controlled-test'||quality.previousCandidateHash!==undefined)throw Error();
  const selection=selected(structuredClone(options.selection),native),policy=policyInput(options.policy);
  if((native&&options.canonical||selection.sources.some(s=>sourceBodyLimit(s.sourceId)>32768))&&!quality.verifier?.acceptedRequestSchemas?.includes(2))throw Error();
  const complete=native?{...options.completeCandidate,enabled:true,baseRevision:selection.baseRevision,...(options.canonical?{canonicalBase:{commit:options.canonical.expectedBaseCommit!,markdownSha256:options.canonical.expectedMarkdownHash!,markdown:options.canonical.baselineMarkdown!}}:{}),article:selection.article as import('../publishing/contracts.ts').SourceBackedArticle,db:options.db,clock:options.clock,policy,ai:options.completeCandidate?.ai?{run:options.completeCandidate.ai.run.bind(options.completeCandidate.ai)}:undefined,currency:options.completeCandidate?.currency?structuredClone(options.completeCandidate.currency):undefined}:undefined;
  const canonicalAction=options.canonical?createHostedCanonicalPublisher({...options.canonical,db:options.db,clock:options.clock}):undefined;
  if(canonicalAction&&quality.verifier?.environment==='production'){if(!quality.verifier.withDispatchGuard)throw Error();quality.verifier=quality.verifier.withDispatchGuard(()=>canonicalAction.preflight(selection.article.id).then(()=>{}));}
  const completeAction=complete?createHostedCompleteCandidateAction({...complete,...(canonicalAction?{beforeDispatch:()=>canonicalAction.preflight(selection.article.id).then(()=>{})}:{})}):undefined;if(completeAction&&completeAction.state!=='configured')throw Error();
  if(options.publisher&&typeof options.publisher.execute!=='function'||canonicalAction&&(!native||canonicalAction.state!=='configured')||!options.publisher&&!canonicalAction)throw Error();
  configuration={selection,policy,quality,cron:options.cron,...(complete?{complete,completeAction}:{}),...(canonicalAction?{canonicalAction,canonical:{expectedBaseCommit:options.canonical!.expectedBaseCommit,expectedMarkdownHash:options.canonical!.expectedMarkdownHash,qualifiedCodeHash:options.canonical!.qualifiedCodeHash}}:{})};
 }catch{/* Missing/invalid trust or controlled capabilities always closes activation. */}
 const state=!configuration?'unconfigured' as const:options.enabled===true?'configured' as const:'disabled' as const;
 // Snapshot function ports as well as data before asynchronous work. No mutable
 // request/global option can switch a source, verifier or publisher mid-flight.
 const db=options.db,send=options.source?.send.bind(options.source),provider=options.provider?{...options.provider,invoke:options.provider.invoke.bind(options.provider)}:undefined,publisher=options.publisher?{execute:options.publisher.execute.bind(options.publisher)}:undefined,clock=options.clock??Date.now,checkpoint=options.checkpoint;
 return Object.freeze({state,async scheduled(event:HostedMaintenanceEvent){
  if(state!=='configured'||!configuration||!db||!send)stop('hosted_maintenance_'+state);
  const config=configuration,now=()=>{const at=clock();if(!time(at))stop('hosted_maintenance_clock');return at;};
  if(!event||Object.keys(event).sort().join(',')!=='cron,scheduledTime'||event.cron!==config.cron||!time(event.scheduledTime))stop('hosted_maintenance_event');
  await assertSourceCaptureSchema(db);
  const kind=config.complete?'source-backed-scheduled-maintenance-v2':'hosted-controlled-scheduled-maintenance-v2',scheduledTime=event.scheduledTime,input=canonical({kind,scheduledTime,cron:config.cron,selection:config.selection}),eventId='hosted-maintenance-'+hash(canonical({scheduledTime,cron:config.cron,articleId:config.selection.article.id})).slice(0,48),quality={...config.quality,previousCandidateHash:config.selection.baseRevision};
  const fingerprint=hash(canonical({input,policy:config.policy,quality:qualityIdentity(quality),provider:config.complete?{kind:'native-complete-candidate-v1',currency:currencyPin(currencyInput(config.complete.currency)!)}:provider!.id,...(config.canonical?{canonical:config.canonical}:{})})),ledger=new PipelineLedger(db,true),prior=await ledger.get(eventId);
  if(prior){ledger.validate(prior,fingerprint,input);const denial=await ledger.denial(eventId);if(denial){if(denial.fingerprint!==fingerprint)stop('hosted_maintenance_receipt');return JSON.parse(denial.receipt);}}
  if(!prior&&(scheduledTime>now()||now()-scheduledTime>hostedMaintenanceLimits.maximumDelayMs))stop('hosted_maintenance_schedule_stale');
  if(!prior&&config.canonicalAction)await config.canonicalAction.preflight(config.selection.article.id);
  const claimed=await ledger.claim(eventId,fingerprint,input,{kind},now()),owner=claimed.owner;let row:Row=claimed.row;
  try{
   let journal:Journal=ledger.validate(row,fingerprint,input).journal;
   const denied=await ledger.denial(eventId);if(denied){if(denied.fingerprint!==fingerprint)stop('hosted_maintenance_receipt');return JSON.parse(denied.receipt);}
   if(row.phase==='complete'){
    if(!row.receipt||hash(row.receipt)!==row.receipt_hash)stop('hosted_maintenance_receipt');if(!config.complete)return JSON.parse(row.receipt);
   }
   if(!['admitted','collected','generated','complete'].includes(row.phase))stop('hosted_maintenance_journal');
   if(row.phase==='admitted'){
    const sources:CaptureReference[]=[];
    for(const source of config.selection.sources){
     if(config.canonicalAction)await config.canonicalAction.preflight(config.selection.article.id);
     const requestKey=uuid(eventId+'\n'+source.sourceId),existing=await readSourceCapture(db,eventId,{...source,requestKey},false,now),packet=existing??await acquireMaintenanceSource({sourceId:source.sourceId,requestKey},{enabled:true,db,send,clock:now});
     sources.push(await retainSourceCapture(db,eventId,source.citationId,packet,now));
    }
    journal={sources};if(Buffer.byteLength(canonical(journal))>hostedMaintenanceLimits.journalBytes)stop('hosted_maintenance_journal_limit');
    row=await ledger.advance(row,owner,'collected',journal,now());await checkpoint?.('source-ready');
   }
   if(!Array.isArray(journal.sources)||journal.sources.length!==config.selection.sources.length)stop('hosted_maintenance_journal');
   const historical=['generated','complete'].includes(row.phase),references=[];for(const saved of journal.sources){const packet=await readSourceCapture(db,eventId,saved,historical,now);if(!packet||canonical(captureReference(saved.citationId,packet))!==canonical(saved))stop('hosted_maintenance_journal');references.push({citationId:saved.citationId,requestKey:saved.requestKey,source:packet.source});}
   const verify=createAcquiredQualitySourcePort({db,clock:now,historicalReplay:historical});
   const sources=[],observedAt:number[]=[];for(let i=0;i<references.length;i++){
    const reference=references[i],selection=config.selection.sources[i];if(reference.citationId!==selection.citationId||reference.source.sourceId!==selection.sourceId||reference.requestKey!==uuid(eventId+'\n'+selection.sourceId))stop('hosted_maintenance_journal');
    const charged=await verifyAcquiredSourceReference({source:reference.source,requestKey:reference.requestKey},{db,clock:now,historicalReplay:historical});observedAt.push(charged.receipt.observedAt);
    const verified=await verify(reference);sources.push({...verified,bytes:Buffer.from(verified.bytes),...(verified.bytes.byteLength>32768?{acquisition:{requestKey:reference.requestKey}}:{})});
   }
   let command:Publish,budget:MaintenanceBudget|undefined,proposal:Awaited<ReturnType<MaintenanceBudget['job']>>,nativeProposal:Awaited<ReturnType<NonNullable<typeof config.completeAction>['prepare']>>|undefined;
   if(config.completeAction){
    if(!['generated','complete'].includes(row.phase)&&config.canonicalAction)await config.canonicalAction.preflight(config.selection.article.id);
    nativeProposal=await (['generated','complete'].includes(row.phase)?config.completeAction.read:config.completeAction.prepare)({eventId,sources:references});
    command={schemaVersion:1,kind:'publish',eventId,baseRevision:config.selection.baseRevision,article:nativeProposal.article};
   }else{
    const request:ProviderRequest={schemaVersion:1,kind:'extractive-source-data',sourceProfile:'bounded-extracted-html-v2',sources:sources.map(s=>extractedSourceData(s.citationId,s.bodyHash,s.extraction.profileId,s.extraction.extractedHash,s.extraction.text)),maxOutputTokens:config.policy.maxOutputTokens};
    budget=new MaintenanceBudget(db,undefined,'quality-gated-v1');const proposalFingerprint=hash(canonical({fingerprint,request}));proposal=await budget.job(eventId);
    if(proposal&&proposal.fingerprint!==proposalFingerprint)stop('hosted_maintenance_proposal_conflict');
    if(!proposal){
     if(row.phase!=='collected')stop('hosted_maintenance_proposal_missing');
     proposal=await budget.reserve(eventId,proposalFingerprint,config.policy,tokens(request),now());
     let response:unknown,checked:ReturnType<typeof validateReply>;
     try{response=await invokeBounded(provider!,request);checked=validateReply(response,request,config.policy);}catch(error){await budget.rejected(proposal,true);throw error;}
     command=candidate(config.selection,eventId,checked.output.extracts,observedAt);
     await budget.ready(proposal,response,command,checked.actualCost);proposal=(await budget.job(eventId))!;await checkpoint?.('proposal-ready');
    }
    if(!['ready','complete'].includes(proposal.state))stop('hosted_maintenance_proposal_unconfirmed_no_retry');
    if(!proposal.packet||!proposal.response||hash(proposal.packet)!==proposal.packet_hash)stop('hosted_maintenance_proposal_corrupt');
    const checked=validateReply(JSON.parse(proposal.response),request,config.policy);command=candidate(config.selection,eventId,checked.output.extracts,observedAt);
    if(canonical(command)!==proposal.packet||proposal.actual_cost!==checked.actualCost||proposal.input_tokens!==tokens(request)||proposal.output_tokens!==config.policy.maxOutputTokens)stop('hosted_maintenance_proposal_corrupt');
   }
   if(row.phase!=='complete'&&config.canonicalAction)await config.canonicalAction.preflight(config.selection.article.id);
   const admission=await assessQuality(eventId,command.article,sources,{db,quality,clock:now});
   if(admission.decision==='deny'){
    if(row.phase!=='collected')stop('hosted_maintenance_journal');
    return await ledger.deny(row,owner,admission,{schemaVersion:1,state:'quality-denied',eventId,quality:admission,livePublished:false,completedAt:now()},now());
   }
   if(row.phase==='collected'){row=await ledger.advance(row,owner,'generated',journal,now());await checkpoint?.('quality-ready');}
   const sourceBacked=nativeProposal?await admitSourceBackedPublication({proposal:nativeProposal,baseRevision:config.selection.baseRevision,references},{db,completeCandidate:config.complete!,quality:config.quality,clock:now}):undefined;
   if(row.phase==='complete')return JSON.parse(row.receipt!);
   const publication=publisher?await executeQualityPublication(command,{db,quality,sources,publisher,...(sourceBacked?{sourceBacked}:{})}):undefined;
   const canonicalReceipt=config.canonicalAction?await config.canonicalAction.publish(command,sourceBacked!):undefined;
   if(budget&&proposal!){if(proposal.state==='ready')await budget.complete(proposal,publication);else if(proposal.receipt!==canonical(publication))stop('hosted_maintenance_receipt');}
   await checkpoint?.('publication-ready');
   const receipt={schemaVersion:1,state:canonicalReceipt?'source-backed-canonical-complete':config.complete?'source-backed-publication-complete':'controlled-publication-complete',eventId,...(publication?{publication}:{}),...(canonicalReceipt?{canonical:canonicalReceipt}:{}),...(nativeProposal?{generation:nativeProposal.generation}:{}),canonicalGitChanged:!!canonicalReceipt,deploymentChanged:false,humanDispositionCreated:false,livePublished:false,completedAt:now()};
   row=await ledger.advance(row,owner,'complete',journal,now(),receipt);return JSON.parse(row.receipt!);
  }finally{await ledger.release(eventId,owner);}
 }});
}
export type HostedMaintenanceAction=ReturnType<typeof createHostedMaintenanceAction>;
