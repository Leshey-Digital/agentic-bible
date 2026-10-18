import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync,realpathSync,unlinkSync,mkdirSync,readdirSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {close} from 'pagefind';
import {generalizedFixture} from './generalized-helpers.mjs';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {runMaintenance} from '../../src/wiki-bridge/maintenance.ts';
import {demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
import {collectMaintenanceSource} from '../../src/maintenance-sources/collector.ts';
import {writeMaintenanceRevision} from '../../src/maintenance-github/writer.ts';
import {readCanonicalMaintenance} from '../../src/maintenance-history/canonical.ts';
import {readingArticleIds} from '../../src/lib/article-ids.ts';
import {maintenanceTarget} from '../../src/maintenance-quality/target.ts';
import {buildCanonicalHistorySite} from '../maintenance-restore/build-site.mjs';
import {prepareCandidate,verifyCandidate} from '../../src/release/artifact.ts';
import {hash} from '../../src/publishing/contracts.ts';
import {clean,git} from '../wiki-bridge/helpers.mjs';
after(async()=>close());

test('twenty actual quality-admitted producers and guarded writers share canonical Git/D1 across bounded batches and one final signed review build', {timeout:600000}, async()=>{
 const f=await generalizedFixture('twenty'),originals=Object.fromEntries(readingArticleIds.map(id=>[id,readFileSync(maintenanceTarget(id).articlePath)])),receipts=[];let providerCalls=0,sourceCalls=0;
 try{
  for(const [index,articleId]of readingArticleIds.entries()){
   // Unchanged default request/cost limits: one call per day, five per month.
   const at=Date.UTC(2026,10+Math.floor(index/5),1+index%5,12),clock=()=>at,bridgeName='wiki-bridge-test-quality-twenty-'+index,collectionName='maintenance-source-collection-test-quality-twenty-'+index;
   clean(bridgeName);rmSync(join(git,collectionName),{recursive:true,force:true});const bridge=new WikiBridge(bridgeName),selected=f.selection(articleId,'article-'+index),command=selected.command;
   command.evidence=command.evidence.slice(0,1);command.revision.article.sources=command.revision.article.sources.slice(0,1);const citationId=command.evidence[0].citationId;command.revision.article.blocks=[{type:'paragraph',content:[{type:'text',text:'This pending controlled revision is replaced by a separately charged proposal before trusted quality assessment.'},{type:'citation',sourceId:citationId}]}];
   const source=await collectMaintenanceSource({sourceId:command.evidence[0].sourceId,citationId,requestKey:command.evidence[0].receiptKey},{enabled:true,metadataProfile:'quality-gated-v1',db:f.db,collectionName,clock,transport:{kind:'controlled-source-fixture',async send(){sourceCalls++;return new Response('Controlled original documentation for '+articleId+' explains the bounded action policy and preserves enough explicit context for a complete evidence-linked canonical revision and later human review.',{headers:{'Content-Type':'text/plain'}});}}});command.evidence=[source.evidence];
   const base=f.remote.tip(),priorProvider=f.context().provider,context={...f.context(),bridge,clock,policy:demonstrationPolicy,sourceDirectory:source.sourceDirectory,canonicalBase:{kind:'controlled-canonical-base-fixture',repo:f.remote.state.root,sourceCommit:base},provider:{...priorProvider,invoke(request,signal){providerCalls++;return priorProvider.invoke(request,signal);}}};
   const generated=await runMaintenance(command,context);assert.equal(generated.generated,true);const receipt=await writeMaintenanceRevision({schemaVersion:1,mode:'local-synthetic-only',expectedBaseCommit:base,previousRevision:null,command},context);receipts.push(receipt);
   writeFileSync(join(git,'production-quality-evidence/twenty-progress.json'),JSON.stringify({completed:receipts.length,total:readingArticleIds.length,lastArticleId:articleId,lastCommit:receipt.commit,providerCalls,sourceCalls,livePublished:false},null,2)+'\n');
  }
  assert.equal(providerCalls,20);assert.equal(sourceCalls,20);assert.equal(f.remote.state.mutations,20);const view=readCanonicalMaintenance({mode:'controlled-static-preview',repo:f.remote.state.root,sourceCommit:f.remote.tip()});assert.equal(view.history.length,20);assert.equal(view.history.filter(e=>e.current).length,20);assert.deepEqual(new Set(view.history.map(e=>e.articleId)),new Set(readingArticleIds));assert.ok(view.history.every(e=>e.qualityRequired&&e.flags.includes('editorial-review')));
  for(const id of readingArticleIds)assert.deepEqual(readFileSync(maintenanceTarget(id).articlePath),originals[id]);
  const proposals=(await f.db.prepare('SELECT state,month,day,reserved_cost,actual_cost FROM maintenance_proposals ORDER BY created_at').all()).results;assert.equal(proposals.length,20);assert.ok(proposals.every(p=>p.state==='complete'));for(const month of new Set(proposals.map(p=>p.month))){const batch=proposals.filter(p=>p.month===month);assert.equal(batch.length,5);assert.ok(batch.length<=demonstrationPolicy.monthRequests);assert.ok(batch.reduce((n,p)=>n+p.reserved_cost,0)<=demonstrationPolicy.monthCost);}assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM canonical_maintenance_writes').first()).n,20);assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM maintenance_quality_admissions').first()).n,20);
  const built=buildCanonicalHistorySite({remote:f.remote},f.remote.tip());assert.equal(built.catalog.schemaVersion,2);assert.equal(built.catalog.history.length,20);const modules=join(built.project,'node_modules'),installed=realpathSync(modules);unlinkSync(modules);mkdirSync(modules);for(const name of readdirSync(installed))symlinkSync(join(installed,name),join(modules,name));const candidatePath=join(built.project,'.git/twenty-candidate');await prepareCandidate(built.project,candidatePath);const {candidate,id}=verifyCandidate(candidatePath);assert.equal(candidate.assets['maintenance-history.json'].sha256,hash(built.manifest));await f.app.restart(built);const response=await f.app.request(),review=await response.json();assert.equal(response.status,200);assert.equal(review.catalog.history.filter(e=>e.current).length,20);assert.equal(review.reviews.length,0);
  writeFileSync(join(git,'production-quality-evidence/twenty-native.json'),JSON.stringify({actualSharedWorkerdD1:true,actualOwnedCanonicalGit:true,articleIds:readingArticleIds,producerCalls:providerCalls,sourceCalls,canonicalMutations:f.remote.state.mutations,currentHeads:view.history.filter(e=>e.current).length,unchangedRequestAndPaidLimits:true,controlledMonths:[...new Set(proposals.map(p=>p.month))],sourceCommit:f.remote.tip(),candidateDigest:id,catalogHash:hash(built.manifest),actualAstroPagefind:true,actualShippedSignedReview:true,privateProducerContexts:20,privateV1LimitsUnchanged:true,originalRepositoryArticlesIntact:true,livePublished:false},null,2)+'\n');
 }finally{await f.close();}
});
