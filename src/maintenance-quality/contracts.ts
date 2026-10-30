import {sourceBodyLimit} from '../monitoring/http-registry.ts';
import {canonicalQualityContext,type CanonicalQualityContext} from './context.ts';
import {articleInput,sourceBackedArticleInput,canonical,hash,type Article} from '../publishing/contracts.ts';
export class QualityError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
export function stop(code:string):never{throw new QualityError(code);}
export const qualityLimits=Object.freeze({rows:64,sourceBytes:32768,totalSourceBytes:131072,requestBytes:196608,responseBytes:16384,timeoutMs:2000});
export type QualitySource={citationId:string;sourceId:string;url:string;bodyHash:string;bytes:Buffer;acquisition?:{requestKey:string};extraction?:{profileId:string;rawHash:string;extractedHash:string;text:string;spans:{startByte:number;endByte:number;text:string}[]};lineage?:{originIds:string[];provenance:'unknown'}};
export type Claim={id:string;block:number;text:string;citationIds:string[]};
export type QualityRequest={schemaVersion:1|2;canonicalBase?:ReturnType<typeof canonicalQualityContext>;kind:'complete-candidate-quality';candidateHash:string;manifestHash:string;sourceHash:string;bindingHash:string;article:Article;claims:Claim[];sources:{citationId:string;sourceId:string;url:string;bodyHash:string;untrusted:true;text:string;extraction?:QualitySource['extraction'];lineage?:QualitySource['lineage']}[]};
export type Lineage={citationId:string;bodyHash:string;originIds:string[];provenance:'original'|'syndicated'|'derived'|'unknown'};
export type QualityReport={schemaVersion:1;bindingHash:string;claims:{id:string;support:'supported'|'unsupported'|'unknown';citationIds:string[]}[];lineage:Lineage[];checks:{completeClaimCoverage:'pass'|'fail'|'unknown';substantive:'pass'|'fail'|'unknown';citationsAuthentic:'pass'|'fail'|'unknown';safe:'pass'|'fail'|'unknown';nonSpam:'pass'|'fail'|'unknown';distinctCanonicalUpdate:'pass'|'fail'|'unknown'}};
// Trusted runner wiring only. An LLM response or a caller-supplied identity is not this authority.
export type QualityVerifier={kind:'trusted-semantic-quality-adapter-v1';id:string;revision:string;environment:'controlled-test'|'production';acceptedRequestSchemas?:readonly (1|2)[];withDispatchGuard?:(guard:()=>Promise<void>)=>QualityVerifier;verify:(request:QualityRequest,signal:AbortSignal)=>Promise<Response>};
export type QualityControl={profile:'quality-gated-v1';verifier?:QualityVerifier;minimumIndependentOrigins:number;previousCandidateHash?:string|null;canonicalContext?:CanonicalQualityContext};
export type QualityReceipt={schemaVersion:1;profile:'quality-gated-v1';eventId:string;candidateHash:string;manifestHash:string;sourceHash:string;bindingHash:string;verifierId:string;verifierRevision:string;environment:'controlled-test'|'production';decision:'allow'|'deny';reasons:string[];reportHash:string;independentOrigins:number;factualVerification:'trusted-adapter-assessment';livePublished:false};
export function exact(value:unknown,keys:string[]):asserts value is Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))stop('quality_schema');}
export const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const identity=(v:unknown):v is string=>typeof v==='string'&&/^[a-z0-9][a-z0-9._:-]{2,95}$/.test(v);
export function qualityIdentity(control:QualityControl){
 if(!control||control.profile!=='quality-gated-v1'||!Number.isSafeInteger(control.minimumIndependentOrigins)||control.minimumIndependentOrigins<1||control.minimumIndependentOrigins>8)stop('quality_policy');
 const v=control.verifier;if(!v||v.kind!=='trusted-semantic-quality-adapter-v1'||!identity(v.id)||!identity(v.revision)||!['controlled-test','production'].includes(v.environment)||typeof v.verify!=='function')stop('quality_verifier_unconfigured');
 if(control.previousCandidateHash!==undefined&&control.previousCandidateHash!==null&&!digest(control.previousCandidateHash))stop('quality_policy');
 if(v.acceptedRequestSchemas&&(!Array.isArray(v.acceptedRequestSchemas)||!v.acceptedRequestSchemas.length||v.acceptedRequestSchemas.length>2||new Set(v.acceptedRequestSchemas).size!==v.acceptedRequestSchemas.length||v.acceptedRequestSchemas.some(n=>n!==1&&n!==2)))stop('quality_request_format_unconfigured');
 const base=control.canonicalContext?canonicalQualityContext(control.canonicalContext):undefined;
 return { ...(base?{canonicalBase:{profile:base.profile,commit:base.commit,markdownSha256:base.markdownSha256,bodyHash:base.bodyHash}}:{}),...(v.acceptedRequestSchemas?{acceptedRequestSchemas:[...v.acceptedRequestSchemas]}:{}),...(control.previousCandidateHash!==undefined?{previousCandidateHash:control.previousCandidateHash}:{}),profile:control.profile,minimumIndependentOrigins:control.minimumIndependentOrigins,verifierId:v.id,verifierRevision:v.revision,environment:v.environment};
}
export function qualityRequest(value:unknown,input:QualitySource[],context?:CanonicalQualityContext):QualityRequest{
 // A syntactically valid new article identity may enter the bounded local
 // publication ledger only after this complete candidate receives a trusted
 // allow decision. Canonical maintenance targets remain independently pinned
 // to readingArticleIds by maintenance-quality/target.ts.
 // Structural quality requests create no publication authority. Native commands
 // still need the separate D1 source/generation-bound opaque admission.
 const article=(value as {provenance?:unknown})?.provenance==='charged-acquired-sources-v1'?sourceBackedArticleInput(value):articleInput(value);
 const claims:Claim[]=article.blocks.flatMap((block,index)=>block.type==='paragraph'?[{id:'paragraph-'+index,block:index,text:block.content.map(p=>p.type==='text'?p.text:p.type==='article'?p.label:'').join(' '),citationIds:[...new Set(block.content.flatMap(p=>p.type==='citation'?[p.sourceId]:[]))]}]:[]);
 if(!claims.length||input.length!==article.sources.length)stop('quality_manifest');
 const base=context?canonicalQualityContext(context):undefined,extended=!!base||input.some(s=>s.bytes?.length>qualityLimits.sourceBytes);let bytes=0;
 const sources=input.map(s=>{const citation=article.sources.find(c=>c.id===s.citationId),large=s.bytes?.length>qualityLimits.sourceBytes;if(!citation||citation.url!==s.url||!identity(s.sourceId)||!digest(s.bodyHash)||!Buffer.isBuffer(s.bytes)||!s.bytes.length||s.bytes.length>(large&&s.extraction&&s.acquisition?sourceBodyLimit(s.sourceId):qualityLimits.sourceBytes)||hash(s.bytes)!==s.bodyHash)stop('quality_source_binding');bytes+=extended&&s.extraction?Buffer.byteLength(s.extraction.text):s.bytes.length;let text:string;try{text=extended&&s.extraction?s.extraction.text:new TextDecoder('utf-8',{fatal:true}).decode(s.bytes);}catch{return stop('quality_source_binding');}return {citationId:s.citationId,sourceId:s.sourceId,url:s.url,bodyHash:s.bodyHash,untrusted:true as const,text,...(s.extraction?{extraction:structuredClone(s.extraction),lineage:structuredClone(s.lineage)}:{})};});
 if(bytes>qualityLimits.totalSourceBytes||new Set(sources.map(s=>s.citationId)).size!==sources.length||new Set(sources.map(s=>s.sourceId)).size!==sources.length)stop('quality_source_binding');
 const candidateHash=hash(canonical(article)),manifestHash=hash(canonical(base?{claims,canonicalBase:base}:claims)),sourceHash=hash(canonical(sources));const request:QualityRequest={schemaVersion:extended?2:1,...(base?{canonicalBase:base}:{}),kind:'complete-candidate-quality',candidateHash,manifestHash,sourceHash,bindingHash:hash(canonical({candidateHash,manifestHash,sourceHash})),article,claims,sources};
 if(Buffer.byteLength(canonical(request))>qualityLimits.requestBytes)stop('quality_request_limit');return request;
}
export function reportInput(value:unknown,request:QualityRequest):QualityReport{
 exact(value,['schemaVersion','bindingHash','claims','lineage','checks']);if(value.schemaVersion!==1||value.bindingHash!==request.bindingHash||!Array.isArray(value.claims)||value.claims.length!==request.claims.length||!Array.isArray(value.lineage)||value.lineage.length!==request.sources.length)stop('quality_report_binding');
 const seen=new Set<string>();for(const claim of value.claims){exact(claim,['id','support','citationIds']);const unit=request.claims.find(c=>c.id===claim.id);if(!unit||seen.has(claim.id)||!['supported','unsupported','unknown'].includes(claim.support)||!Array.isArray(claim.citationIds)||!claim.citationIds.length||new Set(claim.citationIds).size!==claim.citationIds.length||claim.citationIds.some((id:string)=>!unit.citationIds.includes(id)))stop('quality_claim_binding');seen.add(claim.id);}
 seen.clear();for(const source of value.lineage){exact(source,['citationId','bodyHash','originIds','provenance']);const input=request.sources.find(s=>s.citationId===source.citationId);if(!input||seen.has(source.citationId)||source.bodyHash!==input.bodyHash||!['original','syndicated','derived','unknown'].includes(source.provenance)||!Array.isArray(source.originIds)||source.originIds.length>8||source.originIds.some((id:unknown)=>!identity(id))||new Set(source.originIds).size!==source.originIds.length||source.provenance!=='unknown'&&!source.originIds.length)stop('quality_lineage_binding');seen.add(source.citationId);}
 exact(value.checks,['completeClaimCoverage','substantive','citationsAuthentic','safe','nonSpam','distinctCanonicalUpdate']);if(Object.values(value.checks).some(v=>!['pass','fail','unknown'].includes(v as string)))stop('quality_checks');return structuredClone(value) as QualityReport;
}
export function decision(report:QualityReport,request:QualityRequest,control:QualityControl){
 const reasons:string[]=[];if(control.previousCandidateHash===request.candidateHash)reasons.push('duplicate-canonical-revision');for(const [check,result]of Object.entries(report.checks))if(result!=='pass')reasons.push('check:'+check+':'+result);
 for(const claim of report.claims)if(claim.support!=='supported')reasons.push('claim:'+claim.id+':'+claim.support);
 for(const source of report.lineage)if(source.provenance==='unknown'||!source.originIds.length)reasons.push('lineage:'+source.citationId+':unknown');
 // Count disjoint original lineages, not URLs/domains. Derived reports that share
 // even one original lineage form one connected component (transitively).
 const components:Set<string>[]=[];for(const source of report.lineage){let merged=new Set(source.originIds);for(let i=components.length-1;i>=0;i--)if([...components[i]].some(id=>merged.has(id))){for(const id of components[i])merged.add(id);components.splice(i,1);}if(merged.size)components.push(merged);}
 const independentOrigins=components.length;if(independentOrigins<control.minimumIndependentOrigins)reasons.push('insufficient-independent-origins');
 for(const claim of report.claims){const roots=new Set(claim.citationIds.flatMap(id=>report.lineage.find(s=>s.citationId===id)?.originIds??[]));if(!roots.size)reasons.push('claim:'+claim.id+':lineage-unknown');}
 // Mechanical floor only. The trusted semantic adapter still owns completeness,
 // substance, provenance, safety and duplicate-variant judgments.
 if(request.claims.every(c=>c.text.trim().split(/\s+/).length<12))reasons.push('headline-only-filler');
 return {decision:reasons.length?'deny' as const:'allow' as const,reasons:reasons.sort(),independentOrigins};
}

export function snapshotQuality(control:QualityControl):QualityControl{qualityIdentity(control);const v=control.verifier!;return {...(control.canonicalContext?{canonicalContext:structuredClone(control.canonicalContext)}:{}),...(control.previousCandidateHash!==undefined?{previousCandidateHash:control.previousCandidateHash}:{}),profile:'quality-gated-v1',minimumIndependentOrigins:control.minimumIndependentOrigins,verifier:{kind:'trusted-semantic-quality-adapter-v1',id:v.id,revision:v.revision,environment:v.environment,...(v.acceptedRequestSchemas?{acceptedRequestSchemas:[...v.acceptedRequestSchemas]}:{}),...(v.withDispatchGuard?{withDispatchGuard:v.withDispatchGuard.bind(v)}:{}),verify:v.verify.bind(v)}};}
