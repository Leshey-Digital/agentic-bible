import {canonical,hash} from '../publishing/contracts.ts';
import {exact,digest,identity,stop,type QualityReceipt} from './contracts.ts';
// Format/integrity admission for retained Git records; this never substitutes for
// the trusted semantic assessment and durable D1 authority before publication.
export function qualityReceiptInput(value:unknown,eventId:string,candidateHash?:string):QualityReceipt{
 exact(value,['schemaVersion','profile','eventId','candidateHash','manifestHash','sourceHash','bindingHash','verifierId','verifierRevision','environment','decision','reasons','reportHash','independentOrigins','factualVerification','livePublished']);
 if(value.schemaVersion!==1||value.profile!=='quality-gated-v1'||value.eventId!==eventId||!digest(value.candidateHash)||!digest(value.manifestHash)||!digest(value.sourceHash)||!digest(value.bindingHash)||value.bindingHash!==hash(canonical({candidateHash:value.candidateHash,manifestHash:value.manifestHash,sourceHash:value.sourceHash}))||!identity(value.verifierId)||!identity(value.verifierRevision)||!['controlled-test','production'].includes(value.environment)||value.decision!=='allow'||!Array.isArray(value.reasons)||value.reasons.length||!digest(value.reportHash)||!Number.isSafeInteger(value.independentOrigins)||value.independentOrigins<1||value.independentOrigins>8||value.factualVerification!=='trusted-adapter-assessment'||value.livePublished!==false||candidateHash!==undefined&&value.candidateHash!==candidateHash)stop('quality_receipt_schema');return structuredClone(value) as QualityReceipt;
}
