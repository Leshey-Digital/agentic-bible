import { validateCatalog, type SourceCatalog } from './catalog.ts';
import type { Candidate, CandidatePayload } from './contracts.ts';
import { MonitorStore } from './store.ts';

async function evidence(store:MonitorStore,catalog:SourceCatalog,candidate:Candidate) {
  let payload:CandidatePayload;
  try {payload=JSON.parse(candidate.payload);}catch{return 'blocked_malformed' as const;}
  if(!payload||payload.kind!=='source-observation'||payload.scope!=='local-fixture-ledger'||payload.articleId!==candidate.articleId||typeof payload.note!=='string'||payload.note.length<1||payload.note.length>250||/[<>\x00-\x1f]/.test(payload.note)||!Array.isArray(payload.evidence))return 'blocked_malformed' as const;
  if(payload.evidence.length!==1)return 'blocked_evidence' as const;
  const proof=payload.evidence[0];
  if(!proof||proof.eventId!==candidate.eventId||typeof proof.oldHash!=='string'||typeof proof.newHash!=='string'||!/^[a-f0-9]{64}$/.test(proof.oldHash)||!/^[a-f0-9]{64}$/.test(proof.newHash)||proof.oldHash===proof.newHash)return 'blocked_evidence' as const;
  const source=catalog.sources.find(source=>source.id===proof.sourceId&&source.url===proof.sourceUrl&&source.articleIds.includes(candidate.articleId));
  const event=await store.event(proof.eventId);
  if(!source||!event||event.sourceId!==proof.sourceId||event.oldHash!==proof.oldHash||event.newHash!==proof.newHash)return 'blocked_evidence' as const;
  return null;
}

export async function publishQueued(store:MonitorStore,catalog:SourceCatalog,now=Date.now(),ids?:string[]) {
  await validateCatalog(catalog);
  const results=[];
  const selected=ids?await Promise.all(ids.map(id=>store.candidate(id))):await store.candidates(true);
  for(const candidate of selected) {
    if(!candidate||candidate.state!=='queued')continue;
    const blocked=await evidence(store,catalog,candidate);
    if(blocked) {await store.block(candidate,blocked,blocked==='blocked_evidence'?'required_source_evidence_missing':'technical_payload_invalid',now);results.push({id:candidate.id,state:blocked});continue;}
    const published=await store.publish(candidate,now);
    if(!published&&await store.stale(candidate)) {await store.supersede(candidate,now);results.push({id:candidate.id,state:'superseded'});continue;}
    results.push({id:candidate.id,state:published?'published':'queued_conflict'});
  }
  return results;
}
