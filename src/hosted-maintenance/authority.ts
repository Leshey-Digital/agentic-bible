import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash,sourceBackedArticleInput,digestId,type Publish} from '../publishing/contracts.ts';
import {assessQuality,readQualityAdmission,requireQualityAllow} from '../maintenance-quality/admission.ts';
import {qualityIdentity,snapshotQuality,type QualityControl,type QualitySource} from '../maintenance-quality/contracts.ts';
import {verifyAcquiredSourceReference} from '../maintenance-adapters/acquisition.ts';
import type {Binding} from '../wiki-bridge/contracts.ts';
import {createAcquiredQualitySourcePort} from '../maintenance-adapters/quality-source.ts';
import {createHostedCompleteCandidateAction,type CompleteCandidateOptions,type CompleteCandidateReference} from './complete-candidate.ts';

// An opaque, process-local capability; neither JSON receipts, booleans, caller
// approvals nor source/provenance strings can construct an entry in this map.
declare const authorityBrand:unique symbol;
export type SourceBackedPublicationAuthority={readonly [authorityBrand]:true};
const authorities=new WeakMap<object,{command:string;quality:string;sources:string;db:SqlDatabase;proof:{proposal:Awaited<ReturnType<ReturnType<typeof createHostedCompleteCandidateAction>['read']>>;quality:Awaited<ReturnType<typeof assessQuality>>;bindings:Binding[]};revalidate:()=>Promise<void>}>();
function stop(code:string):never{throw Object.assign(new Error(code),{code});}
function sourceIdentity(sources:QualitySource[]){return hash(canonical(sources.map(s=>({...s,bytes:Buffer.from(s.bytes).toString('base64')}))));}

/** Read-only admission of an already completed native proposal. This cannot
 * generate, renew a currency policy, create human approval, or publish. */
export async function admitSourceBackedPublication(value:{proposal:unknown;baseRevision:string|null;references:CompleteCandidateReference[]},context:{db:SqlDatabase;completeCandidate:CompleteCandidateOptions;quality:QualityControl;clock?:()=>number}):Promise<SourceBackedPublicationAuthority>{
 value=structuredClone(value);context={...context};
 if(value.baseRevision!==null&&!digestId(value.baseRevision))stop('source_backed_base_revision');
 const quality=snapshotQuality(context.quality),proposal=value.proposal as {eventId?:string};
 if(typeof proposal?.eventId!=='string')stop('source_backed_proposal');
 // Always instantiate the concrete verifier; no caller-supplied read callback
 // can turn untrusted model JSON into charged-generation/source authority.
 const action=createHostedCompleteCandidateAction({...context.completeCandidate,enabled:true,db:context.db,clock:context.clock});
 const retained=await action.read({eventId:proposal.eventId,sources:value.references});
 if(retained.base.revision!==value.baseRevision||canonical(retained)!==canonical(value.proposal))stop('source_backed_proposal_binding');
 const verify=createAcquiredQualitySourcePort({db:context.db,clock:context.clock,historicalReplay:true}),sources:QualitySource[]=[],bindings:Binding[]=[];
 for(const reference of value.references){const source=await verify(reference),packet=await verifyAcquiredSourceReference({source:reference.source,requestKey:reference.requestKey},{db:context.db,clock:context.clock,historicalReplay:true});bindings.push({schemaVersion:2,citationId:reference.citationId,sourceId:source.sourceId,url:source.url,receiptKey:reference.requestKey,bodyHash:source.bodyHash,bytes:source.bytes.byteLength,observedAt:packet.receipt.observedAt,reservationToken:packet.receipt.reservationToken,day:packet.receipt.day,attempt:packet.receipt.attempt,profileId:source.extraction.profileId,extractedHash:source.extraction.extractedHash,contentType:'text/html'});sources.push({...source,bytes:Buffer.from(source.bytes),...(source.bytes.byteLength>32768?{acquisition:{requestKey:reference.requestKey}}:{})});}
 const article=sourceBackedArticleInput(retained.article),control={...quality,previousCandidateHash:value.baseRevision},admission=await assessQuality(retained.eventId,article,sources,{db:context.db,quality:control,clock:context.clock});requireQualityAllow(admission);
 const command:Publish={schemaVersion:1,kind:'publish',eventId:retained.eventId,baseRevision:value.baseRevision,article};
 const capability=Object.freeze({}) as SourceBackedPublicationAuthority;
 const proposalPin=canonical(retained),qualityPin=canonical(admission),references=structuredClone(value.references);
 const revalidate=async()=>{
  const current=await action.read({eventId:retained.eventId,sources:references});if(canonical(current)!==proposalPin)stop('source_backed_proposal_binding');
  const currentSources:QualitySource[]=[];for(const reference of references){const source=await verify(reference);currentSources.push({...source,bytes:Buffer.from(source.bytes),...(source.bytes.byteLength>32768?{acquisition:{requestKey:reference.requestKey}}:{})});}
  const currentQuality=await readQualityAdmission(retained.eventId,article,currentSources,{db:context.db,quality:control});requireQualityAllow(currentQuality);if(canonical(currentQuality)!==qualityPin)stop('source_backed_quality_binding');
 };
 authorities.set(capability,{command:canonical(command),quality:canonical(qualityIdentity(control)),sources:sourceIdentity(sources),db:context.db,proof:{proposal:retained,quality:admission,bindings},revalidate});return capability;
}

// Used by the existing publisher before its first effect. The command is exact,
// including native provenance and the expected predecessor; unknown keys fail.
export function sourceBackedCommand(value:unknown,authority:SourceBackedPublicationAuthority|undefined):Publish{
 const saved=authority&&authorities.get(authority);if(!saved||canonical(value)!==saved.command)stop('source_backed_publication_authority_required');
 return JSON.parse(saved.command) as Publish;
}
export function requireSourceBackedContext(value:unknown,authority:SourceBackedPublicationAuthority|undefined,context:{db:SqlDatabase;quality:QualityControl;sources:QualitySource[]}){
 sourceBackedCommand(value,authority);const saved=authorities.get(authority!)!;
 if(saved.db!==context.db||saved.quality!==canonical(qualityIdentity(context.quality))||saved.sources!==sourceIdentity(context.sources))stop('source_backed_publication_context_mismatch');
}

export async function revalidateSourceBackedPublication(value:unknown,authority:SourceBackedPublicationAuthority|undefined){sourceBackedCommand(value,authority);await authorities.get(authority!)!.revalidate();sourceBackedCommand(value,authority);}

export async function readSourceBackedAuthority(value:unknown,authority:SourceBackedPublicationAuthority|undefined,db?:SqlDatabase){if(db&&authorities.get(authority!)?.db!==db)stop('source_backed_publication_context_mismatch');await revalidateSourceBackedPublication(value,authority);return structuredClone(authorities.get(authority!)!.proof);}
