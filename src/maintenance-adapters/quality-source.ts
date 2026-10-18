import {verifyAcquiredSourceReference,type SourceVerificationContext} from './acquisition.ts';
import {validateExtractedSource,type EvidenceSpan} from './extraction.ts';
import {exact,extractionProfile,reject} from './profiles.ts';

export type QualitySourceExtraction={profileId:string;rawHash:string;extractedHash:string;text:string;spans:EvidenceSpan[]};
export type AcquiredQualitySource={citationId:string;sourceId:string;url:string;bodyHash:string;bytes:Uint8Array;
  extraction:QualitySourceExtraction;lineage:{originIds:string[];provenance:'unknown'}};
const citation=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(value);

// Pure validation of the exact extras consumed by the quality gate. No receipt
// authority or semantic/original-provenance decision is created by this helper.
export async function validateQualitySourceExtraction(value:unknown):Promise<AcquiredQualitySource>{
  exact(value,['citationId','sourceId','url','bodyHash','bytes','extraction','lineage']);
  exact(value.extraction,['profileId','rawHash','extractedHash','text','spans']);exact(value.lineage,['originIds','provenance']);
  const profile=extractionProfile(value.sourceId);
  if(!profile||!citation(value.citationId)||value.extraction.rawHash!==value.bodyHash||value.lineage.provenance!=='unknown'||!Array.isArray(value.lineage.originIds)||value.lineage.originIds.length!==0)reject('adapter_quality_source_mismatch');
  const source=await validateExtractedSource({schemaVersion:2,sourceId:value.sourceId,url:value.url,profileId:value.extraction.profileId,
    raw:{bytes:value.bytes,hash:value.bodyHash,contentType:'text/html'},
    evidence:{text:value.extraction.text,hash:value.extraction.extractedHash,spans:value.extraction.spans},lineage:profile.lineage});
  return {citationId:value.citationId,sourceId:source.sourceId,url:source.url,bodyHash:source.raw.hash,bytes:source.raw.bytes,
    extraction:{profileId:source.profileId,rawHash:source.raw.hash,extractedHash:source.evidence.hash,text:source.evidence.text,spans:source.evidence.spans},
    lineage:{originIds:[],provenance:'unknown'}};
}

// Concrete trusted-code consumer: captured original bytes -> charged receipt ->
// validated raw/extracted identity -> quality input. Caller cannot nominate roots.
// The quality gate owns unknown-lineage denial and the separate trusted verifier.
export function createAcquiredQualitySourcePort(context:SourceVerificationContext){
  return async(value:unknown):Promise<AcquiredQualitySource>=>{
    exact(value,['citationId','source','requestKey']);if(!citation(value.citationId))reject('adapter_quality_source_mismatch');
    const packet=await verifyAcquiredSourceReference({source:value.source,requestKey:value.requestKey},context),source=packet.source;
    return validateQualitySourceExtraction({citationId:value.citationId,sourceId:source.sourceId,url:source.url,bodyHash:source.raw.hash,bytes:source.raw.bytes,
      extraction:{profileId:source.profileId,rawHash:source.raw.hash,extractedHash:source.evidence.hash,text:source.evidence.text,spans:source.evidence.spans},
      lineage:{originIds:[],provenance:'unknown'}});
  };
}
