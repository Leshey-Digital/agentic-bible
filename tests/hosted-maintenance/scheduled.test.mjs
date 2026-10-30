import {sourceBackedArticleInput,articleInput,commandInput} from '../../src/publishing/contracts.ts';
import {executeQualityPublication} from '../../src/maintenance-quality/publisher.ts';
import {createHostedCompleteCandidateAction} from '../../src/hosted-maintenance/complete-candidate.ts';
import {admitSourceBackedPublication} from '../../src/hosted-maintenance/authority.ts';
import {cloudflareProseModel} from '../../src/maintenance-adapters/cloudflare-prose.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,rmSync} from 'node:fs';
import {build} from 'esbuild';
import {createHostedMaintenanceAction} from '../../src/hosted-maintenance/scheduled.ts';
import {PublicationStore} from '../../src/publishing/store.ts';
import {deterministicProvider,demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
import {fixture,sample,quality} from '../maintenance-quality/helpers.mjs';
import {mcp,document,urls} from '../maintenance-adapters/fixtures.mjs';

const roots=[];after(()=>{for(const root of roots)rmSync(root,{recursive:true,force:true});});
async function setup(label){
 const local=await fixture('hosted-scheduled-'+label);
 for(const file of ['0005_http_observations.sql','0010_maintenance_proposals.sql','0015_maintenance_pipeline.sql','0021_quality_pipeline_dispositions.sql']){
  const raw=readFileSync('migrations/'+file,'utf8');
  for(const sql of raw.replace(/--[^\n]*/g,'').split(file==='0021_quality_pipeline_dispositions.sql'?/;(?=\s*(?:CREATE|$))/:/;/).filter(s=>s.trim()))await local.db.prepare(sql).run();
 }
 const publisher=new PublicationStore('article-publication-hosted-scheduled-'+crypto.randomUUID());roots.push(publisher.root);
 const {article}=sample();article.id='tool-use';article.related=['ai-agent','model-context-protocol'];
 article.sources=[{id:'mcp-tools',title:'Original controlled source',url:urls[mcp],publisher:'Controlled example',context:'Synthetic original documentation; no live source retrieved.'}];
 article.blocks=[{type:'paragraph',content:[{type:'text',text:'This placeholder complete candidate is replaced by bounded controlled source extracts before quality review.'},{type:'citation',sourceId:'mcp-tools'}]}];
 article.concerns=[];
 let at=Date.UTC(2026,9,30,12),sourceCalls=0,providerCalls=0,qualityCalls=0,publicationCalls=0;
 const options=()=>({enabled:true,db:local.db,cron:'0 * * * *',clock:()=>at,selection:{article:structuredClone(article),baseRevision:null,sources:[{citationId:'mcp-tools',sourceId:mcp}]},policy:demonstrationPolicy,
  source:{kind:'controlled-maintenance-source-port-v1',async send(){sourceCalls++;return new Response(document(mcp,'A guarded agent validates every proposed tool argument before requesting an external action and retains the original evidence for later human review.'),{headers:{'Content-Type':'text/html'}});}},
  provider:deterministicProvider(()=>providerCalls++),quality:quality(()=>{},()=>qualityCalls++),publisher:{async execute(command){publicationCalls++;return publisher.execute(command);}}});
 return {local,publisher,article,options,event:()=>({scheduledTime:at,cron:'0 * * * *'}),advance:ms=>at+=ms,counts:()=>({sourceCalls,providerCalls,qualityCalls,publicationCalls})};
}
const code=value=>error=>error.code===value;

test('default closure and server configuration reject before source, proposal or publication effects',async()=>{
 assert.equal(createHostedMaintenanceAction().state,'unconfigured');
 await assert.rejects(createHostedMaintenanceAction().scheduled({scheduledTime:0,cron:'* * * * *'}),code('hosted_maintenance_unconfigured'));
 const f=await setup('closed');try{
  const disabled=createHostedMaintenanceAction({...f.options(),enabled:false});assert.equal(disabled.state,'disabled');await assert.rejects(disabled.scheduled(f.event()),code('hosted_maintenance_disabled'));
  for(const change of [o=>o.quality=undefined,o=>o.publisher=undefined,o=>o.source=undefined,o=>o.provider={...o.provider,kind:'production'},o=>o.quality.verifier.environment='production',o=>o.selection.article.reviewedCorrections=[],o=>o.selection.sources[0].sourceId='arbitrary-source']){
   const options=f.options();change(options);assert.equal(createHostedMaintenanceAction(options).state,'unconfigured');
  }
  const action=createHostedMaintenanceAction(f.options());await assert.rejects(action.scheduled({...f.event(),article:f.article}),code('hosted_maintenance_event'));
  await assert.rejects(action.scheduled({...f.event(),cron:'*/2 * * * *'}),code('hosted_maintenance_event'));
  const stale=f.event();stale.scheduledTime-=3600001;await assert.rejects(action.scheduled(stale),code('hosted_maintenance_schedule_stale'));
  assert.deepEqual(f.counts(),{sourceCalls:0,providerCalls:0,qualityCalls:0,publicationCalls:0});
 }finally{await f.local.close();}
});

test('scheduled source -> charged proposal -> exact quality -> existing publication retains flags/history and replays across D1 restart',async()=>{
 const f=await setup('allow');try{
  const event=f.event(),action=createHostedMaintenanceAction(f.options()),result=await action.scheduled(event);
  assert.equal(result.state,'controlled-publication-complete');assert.equal(result.livePublished,false);assert.equal(result.canonicalGitChanged,false);assert.equal(result.deploymentChanged,false);assert.equal(result.humanDispositionCreated,false);
  assert.equal(result.publication.quality.decision,'allow');assert.deepEqual(result.publication.publication.flags,['editorial-review','limited-source-coverage']);
  const current=f.publisher.current(),revision=result.publication.publication.revisionId;
  assert.equal(current.manifest.state.articles['tool-use'],revision);assert.deepEqual(current.manifest.state.history['tool-use'],[revision]);assert.ok(current.manifest.files[`history/tool-use/${revision}.html`]);
  const proposal=await f.local.db.prepare('SELECT * FROM maintenance_proposals').first();assert.equal(proposal.state,'complete');assert.ok(proposal.actual_cost>0);assert.ok(proposal.reserved_cost>=proposal.actual_cost);assert.equal(JSON.parse(proposal.packet).article.verified,'2026-10-30');
  assert.equal((await f.local.db.prepare('SELECT COUNT(*) n FROM http_request_reservations').first()).n,1);
  assert.deepEqual(f.counts(),{sourceCalls:1,providerCalls:1,qualityCalls:1,publicationCalls:1});
  await f.local.restart();f.advance(86400001);
  assert.deepEqual(await createHostedMaintenanceAction(f.options()).scheduled(event),result);assert.deepEqual(f.counts(),{sourceCalls:1,providerCalls:1,qualityCalls:1,publicationCalls:1});
  const changed=f.options();changed.selection.article.title='Conflicting server selection';await assert.rejects(createHostedMaintenanceAction(changed).scheduled(event),code('pipeline_event_conflict'));
 }finally{await f.local.close();}
});

test('durable semantic denial keeps source/provider charges and does not create any publication effect',async()=>{
 const f=await setup('deny');try{
  const event=f.event(),options=()=>({...f.options(),quality:quality(r=>r.checks.safe='unknown')}),result=await createHostedMaintenanceAction(options()).scheduled(event);
  assert.equal(result.state,'quality-denied');assert.equal(f.publisher.current(),null);assert.equal(f.counts().providerCalls,1);assert.equal(f.counts().publicationCalls,0);
  const proposal=await f.local.db.prepare('SELECT state,actual_cost FROM maintenance_proposals').first();assert.equal(proposal.state,'ready');assert.ok(proposal.actual_cost>0);
  await f.local.restart();f.advance(86400001);assert.deepEqual(await createHostedMaintenanceAction(options()).scheduled(event),result);assert.equal(f.counts().sourceCalls,1);assert.equal(f.counts().providerCalls,1);
 }finally{await f.local.close();}
});

test('proposal uncertainty is held without redispatch after restart',async()=>{
 const f=await setup('provider-uncertain');let calls=0;try{
  const event=f.event(),options=()=>({...f.options(),provider:{...deterministicProvider(),async invoke(){calls++;throw Error('uncertain controlled response');}}});
  await assert.rejects(createHostedMaintenanceAction(options()).scheduled(event));
  assert.equal((await f.local.db.prepare('SELECT state FROM maintenance_proposals').first()).state,'uncertain');
  await f.local.restart();await assert.rejects(createHostedMaintenanceAction(options()).scheduled(event),code('hosted_maintenance_proposal_unconfirmed_no_retry'));
  assert.equal(calls,1);assert.equal(f.counts().sourceCalls,1);assert.equal(f.publisher.current(),null);
 }finally{await f.local.close();}
});

test('lost source outcome never refetches and quality uncertainty never reverifies',async()=>{
 for(const phase of ['source','quality']){
  const f=await setup('uncertain-'+phase);let calls=0;try{
   const event=f.event(),options=()=>{const o=f.options();if(phase==='source')o.source.send=async()=>{calls++;throw Error('controlled source loss');};else o.quality.verifier.verify=async()=>{calls++;throw Error('controlled verifier loss');};return o;};
   await assert.rejects(createHostedMaintenanceAction(options()).scheduled(event));await f.local.restart();await assert.rejects(createHostedMaintenanceAction(options()).scheduled(event));
   assert.equal(calls,1);assert.equal(f.publisher.current(),null);assert.equal(f.counts().publicationCalls,0);
  }finally{await f.local.close();}
 }
});

test('lost completed publication response reuses existing publisher receipt without a second publication operation',async()=>{
 const f=await setup('publication-loss');let first=true,calls=0;try{
  const event=f.event(),options=()=>({...f.options(),publisher:{async execute(command){calls++;const receipt=await f.publisher.execute(command);if(first){first=false;throw Error('controlled response lost after commit');}return receipt;}}});
  await assert.rejects(createHostedMaintenanceAction(options()).scheduled(event));const initial=f.publisher.current();assert.equal(initial.manifest.state.sequence,1);
  await f.local.restart();f.advance(86400001);const result=await createHostedMaintenanceAction(options()).scheduled(event);
  assert.equal(result.state,'controlled-publication-complete');assert.equal(f.publisher.current().reference.id,initial.reference.id);assert.equal(f.publisher.current().manifest.state.sequence,1);assert.equal(calls,2);assert.equal(f.counts().providerCalls,1);assert.equal(f.counts().qualityCalls,1);
 }finally{await f.local.close();}
});

test('portable scheduled composition bundles without filesystem, process, Git or Node publisher imports',async()=>{
 const built=await build({entryPoints:['src/hosted-maintenance/scheduled.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*'],metafile:true});
 for(const path of Object.keys(built.metafile.inputs))assert.doesNotMatch(path,/(?:maintenance-pipeline\/runner|publishing\/store|wiki-bridge\/(?:store|files|build)|maintenance-github\/writer)\.ts$/);
 const imports=built.outputFiles[0].text;assert.doesNotMatch(imports,/from ["'](?:node:(?:fs|path|child_process)|fs|path)["']/);
});

async function native(f,change=()=>{}){
 for(const file of ['0016_maintenance_currency.sql','0024_currency_policy_rotation.sql']){
  const source=readFileSync('migrations/'+file,'utf8').replace(/--[^\n]*/g,'');
  for(const sql of source.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi)||[])if(sql.trim())await f.local.db.prepare(sql).run();
 }
 let calls=0;
 const options=()=>{const o=f.options();o.selection.article=sourceBackedArticleInput({...o.selection.article,provenance:'charged-acquired-sources-v1'});o.source.kind='bounded-official-http-source-v2';delete o.provider;o.publisher=f.publisher;
  const at=f.event().scheduledTime;o.completeCandidate={enabled:true,currency:{enabled:true,policy:{schemaVersion:1,unit:'MICRO_USD',account:'controlled-native-hosted',runLimit:100000,dayLimit:500000,monthLimit:10000000,dayBaseline:166667,monthBaseline:5000000,price:{id:'controlled-native-cloudflare-v1',provider:'cloudflare-workers-ai',model:cloudflareProseModel,tokenizer:'cloudflare-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:27000,outputPerMillion:201000,requestFee:0,validFrom:at-86400000,validUntil:at+86400000}}},ai:{async run(model,input){calls++;assert.equal(model,cloudflareProseModel);assert.equal(input.raw,true);assert.match(input.prompt,/complete sourced encyclopedia/);const output={title:'Complete native candidate',description:'Original bounded complete candidate from controlled evidence.',blocks:[{type:'heading',id:'native-complete',text:'Complete source-backed article'},{type:'paragraph',content:[{type:'text',text:'A guarded agent validates every proposed tool argument before requesting an external action and retains the original evidence for later human review.'},{type:'citation',sourceId:'mcp-tools'}]}]};change(output);return {response:JSON.stringify(output),usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}};}}};return o;};
 return {options,get calls(){return calls}};
}

test('native complete prose uses charged source/currency, exact quality and opaque admission for the existing publisher',async()=>{
 const f=await setup('native-allow'),n=await native(f);try{
  const event=f.event(),options=n.options(),result=await createHostedMaintenanceAction(options).scheduled(event);
  assert.equal(result.state,'source-backed-publication-complete');assert.equal(result.livePublished,false);assert.equal(n.calls,1);
  const revision=f.publisher.revision(result.publication.publication.revisionId);assert.equal(revision.provenance,'charged-acquired-sources-v1');assert.equal(revision.title,'Complete native candidate');
  assert.deepEqual(f.publisher.current().manifest.state.history['tool-use'],[result.publication.publication.revisionId]);assert.deepEqual(result.publication.publication.flags,['editorial-review','limited-source-coverage']);
  const generation=await f.local.db.prepare("SELECT * FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first();assert.equal(generation.state,'complete');assert.equal(generation.currency_state,'settled');assert.ok(generation.currency_actual>0);assert.ok(generation.currency_actual<=generation.currency_reserved);
  assert.equal((await f.local.db.prepare('SELECT COUNT(*) n FROM maintenance_proposals').first()).n,1);assert.equal(f.counts().qualityCalls,1);
  await f.local.restart();const reopened=n.options();reopened.completeCandidate=options.completeCandidate;assert.deepEqual(await createHostedMaintenanceAction(reopened).scheduled(event),result);assert.equal(n.calls,1);assert.equal(f.counts().sourceCalls,1);
 }finally{await f.local.close();}
});

test('native provenance and fabricated approval/capability cannot enter generic, manual, quality-publication or legacy paths',async()=>{
 const f=await setup('native-generic-reject'),n=await native(f);try{
  const article=n.options().selection.article,command={schemaVersion:1,kind:'publish',eventId:'native-forgery',baseRevision:null,article};
  assert.throws(()=>articleInput(article),code('unsupported_provenance'));assert.throws(()=>commandInput(command),code('unsupported_provenance'));
  await assert.rejects(f.publisher.execute(command),code('source_backed_publication_authority_required'));
  await assert.rejects(f.publisher.execute(command,{sourceBacked:{approved:true}}),code('source_backed_publication_authority_required'));
  await assert.rejects(executeQualityPublication(command,{db:f.local.db,quality:quality(),sources:[],publisher:f.publisher}),code('source_backed_publication_authority_required'));
  const options=n.options();delete options.completeCandidate;assert.equal(createHostedMaintenanceAction(options).state,'unconfigured');
  assert.equal(f.publisher.current(),null);assert.equal(n.calls,0);
 }finally{await f.local.close();}
});

test('native malformed complete output keeps settled charge and cannot be regenerated on replay',async()=>{
 const f=await setup('native-malformed'),n=await native(f,output=>{output.approved=true;});try{
  const event=f.event(),options=n.options();await assert.rejects(createHostedMaintenanceAction(options).scheduled(event),code('hosted_complete_candidate_json'));
  const generation=await f.local.db.prepare("SELECT * FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first();assert.equal(generation.state,'complete');assert.equal(generation.currency_state,'settled');
  await f.local.restart();await assert.rejects(createHostedMaintenanceAction({...options,db:f.local.db}).scheduled(event),code('hosted_complete_candidate_json'));assert.equal(n.calls,1);assert.equal(f.publisher.current(),null);
 }finally{await f.local.close();}
});

test('native semantic denial and uncertain usage preserve charges and have no publication effect',async()=>{
 for(const phase of ['deny','usage']){
  const f=await setup('native-'+phase),n=await native(f);let calls=0;try{
   const event=f.event(),options=n.options();if(phase==='deny')options.quality=quality(r=>r.checks.safe='unknown');else options.completeCandidate.ai.run=async()=>{calls++;return {response:'{}',usage:{prompt_tokens:100,completion_tokens:100,total_tokens:201}};};
   if(phase==='deny')assert.equal((await createHostedMaintenanceAction(options).scheduled(event)).state,'quality-denied');else await assert.rejects(createHostedMaintenanceAction(options).scheduled(event));
   const generation=await f.local.db.prepare("SELECT * FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first();assert.equal(generation.currency_state,phase==='deny'?'settled':'uncertain');assert.equal(f.publisher.current(),null);
   await f.local.restart();const again={...options,db:f.local.db};if(phase==='deny')assert.equal((await createHostedMaintenanceAction(again).scheduled(event)).state,'quality-denied');else await assert.rejects(createHostedMaintenanceAction(again).scheduled(event),code('hosted_complete_candidate_generation_unconfirmed_no_retry'));
   assert.equal(phase==='deny'?n.calls:calls,1);assert.equal(f.counts().sourceCalls,1);
  }finally{await f.local.close();}
 }
});

test('native replay after a lost actual publisher response mints fresh admission from durable records',async()=>{
 const f=await setup('native-publish-loss'),n=await native(f);let lost=true;try{
  const event=f.event(),options=n.options();options.publisher={async execute(command,admission){const receipt=await f.publisher.execute(command,admission);if(lost){lost=false;throw Error('controlled native response loss');}return receipt;}};
  await assert.rejects(createHostedMaintenanceAction(options).scheduled(event));const initial=f.publisher.current();assert.equal(initial.manifest.state.sequence,1);await f.local.restart();f.advance(86400001);
  const result=await createHostedMaintenanceAction({...options,db:f.local.db}).scheduled(event);assert.equal(result.state,'source-backed-publication-complete');assert.equal(f.publisher.current().reference.id,initial.reference.id);assert.equal(n.calls,1);assert.equal(f.counts().qualityCalls,1);
 }finally{await f.local.close();}
});
