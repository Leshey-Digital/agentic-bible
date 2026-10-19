import {readFileSync,statSync} from 'node:fs';
import {PublicationStore} from '../src/publishing/store.ts';
import {PublicationError,canonical,commandInput,hash,publicationLimits} from '../src/publishing/contracts.ts';
import {publicationServer} from '../src/publishing/preview.ts';
import {readingArticleIds} from '../src/lib/article-ids.ts';
import {executeQualityPublication} from '../src/maintenance-quality/publisher.ts';
import {localObservations} from '../src/wiki-bridge/local-d1.ts';

const [action='status',...args]=process.argv.slice(2);
const option=(key,fallback)=>{const index=args.indexOf(key);return index<0?fallback:args[index+1];};
const demoQuality=()=>({
  profile:'quality-gated-v1',minimumIndependentOrigins:1,
  verifier:{kind:'trusted-semantic-quality-adapter-v1',id:'local-synthetic-demo',revision:'controlled-v1',environment:'controlled-test',async verify(request){
    // This deterministic answer exercises the durable quality path using
    // explicitly synthetic evidence. It is not a factual or source check.
    return Response.json({schemaVersion:1,bindingHash:request.bindingHash,
      claims:request.claims.map(claim=>({id:claim.id,support:'supported',citationIds:claim.citationIds})),
      lineage:request.sources.map((source,index)=>({citationId:source.citationId,bodyHash:source.bodyHash,originIds:['synthetic-demo-origin-'+index],provenance:'original'})),
      checks:{completeClaimCoverage:'pass',substantive:'pass',citationsAuthentic:'pass',safe:'pass',nonSpam:'pass',distinctCanonicalUpdate:'pass'}});
  }}
});
async function demoLedger(name){
  const local=await localObservations(name,true,()=>{throw new Error('demo_source_fetch_forbidden');});
  try{
    const exists=await local.db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='maintenance_quality_admissions'").first();
    if(!exists){
      const schema=readFileSync(new URL('../migrations/0020_quality_admission.sql',import.meta.url),'utf8');
      for(const statement of schema.replace(/--[^\n]*/g,'').split(/;(?=\s*(?:CREATE|$))/).filter(value=>value.trim()))await local.db.prepare(statement).run();
    }
    return local;
  }catch(error){await local.runtime.dispose();throw error;}
}
try{
  if(action==='apply'){
    const path=option('--file',undefined);if(!path||statSync(path).size>publicationLimits.inputBytes)throw new PublicationError('bounded_input_file_required');
    let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{throw new PublicationError('invalid_json');}
    const command=commandInput(value);const store=new PublicationStore(option('--state','article-publication'));
    if(command.kind==='publish'&&!readingArticleIds.includes(command.article.id)){
      const prior=store.current()?.manifest.state.receipts.find(receipt=>receipt.eventId===command.eventId);
      // The publisher's immutable event ledger is the sole exception for an
      // uncompiled ID: exact replay is a no-op; changed input conflicts there.
      if(!prior)throw new PublicationError('new_identity_requires_quality_context');
      if(prior.fingerprint!==hash(canonical(command)))throw new PublicationError('event_reference_conflict');
    }
    console.log(JSON.stringify(await store.execute(value)));
  }else if(action==='demo'){
    const store=new PublicationStore(option('--state','article-publication'));
    const qualityState=option('--quality-state','wiki-observations-article-publication-demo');
    const ledger=await demoLedger(qualityState);
    try{
    const fixture=JSON.parse(readFileSync('fixtures/local-publication/article-v1.json','utf8'));
    const sources=fixture.article.sources.map((source,index)=>{const bytes=Buffer.from(`Synthetic demo evidence ${index}: ${source.context}`);return {citationId:source.id,sourceId:'demo-source-'+index,url:source.url,bytes,bodyHash:hash(bytes)};});
    const context={db:ledger.db,quality:demoQuality(),sources,publisher:store};
    const first=await executeQualityPublication(fixture,context);
    const article=structuredClone(fixture.article);article.title='Agent loop & tools — revised fixture';article.blocks[1].content[0].text='Cedarharbor is the distinctive token in this revised synthetic fixture. This supplied example demonstrates a cited local article publication, without fetching or generating source material.';
    const second=await executeQualityPublication({...fixture,eventId:'local-demo-revision-two',baseRevision:first.publication.revisionId,article},context);
    console.log(JSON.stringify({mode:'controlled-test-demo',syntheticEvidence:true,factualVerification:'not-established',liveProviderUsed:false,qualityEnvironment:second.quality.environment,first:first.publication,second:second.publication}));
    }finally{await ledger.runtime.dispose();}
  }else if(action==='status'){
    const store=new PublicationStore(option('--state','article-publication'));
    const current=store.current();console.log(JSON.stringify(current?{...current.reference,sequence:current.manifest.state.sequence,articles:current.manifest.state.articles}:null));
  }else if(action==='preview'){
    const store=new PublicationStore(option('--state','article-publication'));
    const server=publicationServer(store);server.listen(8790,'127.0.0.1',()=>console.log('Read-only local publication preview: http://127.0.0.1:8790/local-publications/'));
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
  }else throw new PublicationError('unsupported_command');
}catch(error){console.error(error instanceof PublicationError?error.code:'publication_outcome_unconfirmed_retry_same_event');process.exitCode=1;}
