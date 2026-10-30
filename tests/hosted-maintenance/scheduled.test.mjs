import {qualifiedCanonicalCodeHash} from '../../src/maintenance-github/core.ts';
import {readSourceCapture} from '../../src/hosted-maintenance/source-capture.ts';
import {prepareCandidate} from '../../src/release/artifact.ts';
import {execFileSync} from 'node:child_process';
import {pages,articlePage} from '../../src/publishing/render.ts';
import {controlledGitHub} from '../maintenance-github/provider.mjs';
import {readCanonicalMaintenance} from '../../src/maintenance-history/canonical.ts';
import {historyPath,hash} from '../../src/maintenance-github/contracts.ts';
import {createHostedCanonicalPublisher} from '../../src/hosted-maintenance/canonical.ts';
import {sourceBackedArticleInput,articleInput,commandInput} from '../../src/publishing/contracts.ts';
import {executeQualityPublication} from '../../src/maintenance-quality/publisher.ts';
import {createHostedCompleteCandidateAction} from '../../src/hosted-maintenance/complete-candidate.ts';
import {admitSourceBackedPublication} from '../../src/hosted-maintenance/authority.ts';
import {cloudflareProseModel} from '../../src/maintenance-adapters/cloudflare-prose.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,rmSync,symlinkSync,readdirSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {createHostedMaintenanceAction} from '../../src/hosted-maintenance/scheduled.ts';
import {PublicationStore} from '../../src/publishing/store.ts';
import {deterministicProvider,demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
import {fixture,sample,quality} from '../maintenance-quality/helpers.mjs';
import {mcp,openai,document,urls} from '../maintenance-adapters/fixtures.mjs';

const roots=[];after(()=>{for(const root of roots)rmSync(root,{recursive:true,force:true});});
async function setup(label){
 const local=await fixture('hosted-scheduled-'+label);
 for(const file of ['0005_http_observations.sql','0010_maintenance_proposals.sql','0015_maintenance_pipeline.sql','0021_quality_pipeline_dispositions.sql','0026_http_download_envelope.sql','0028_hosted_source_capture.sql']){
  const raw=readFileSync('migrations/'+file,'utf8');
  for(const sql of raw.replace(/--[^\n]*/g,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi)||[])await local.db.prepare(sql).run();
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
 const options=()=>{const o=f.options();o.quality.verifier.acceptedRequestSchemas=[1,2];o.selection.article=sourceBackedArticleInput({...o.selection.article,provenance:'charged-acquired-sources-v1'});o.source.kind='bounded-official-http-source-v2';delete o.provider;o.publisher=f.publisher;
  const at=f.event().scheduledTime;o.completeCandidate={enabled:true,currency:{enabled:true,policy:{schemaVersion:1,unit:'MICRO_USD',account:'controlled-native-hosted',runLimit:100000,dayLimit:500000,monthLimit:10000000,dayBaseline:166667,monthBaseline:5000000,price:{id:'controlled-native-cloudflare-v1',provider:'cloudflare-workers-ai',model:cloudflareProseModel,tokenizer:'cloudflare-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:27000,outputPerMillion:201000,requestFee:0,validFrom:at-86400000,validUntil:at+86400000}}},ai:{async run(model,input){calls++;assert.equal(model,cloudflareProseModel);assert.equal(input.raw,true);assert.match(input.prompt,/complete sourced encyclopedia/);const output={title:'Complete native candidate',description:'Original bounded complete candidate from controlled evidence.',blocks:[{type:'heading',id:'native-complete',text:'Complete source-backed article'},{type:'paragraph',content:[{type:'text',text:'A guarded agent validates every proposed tool argument before requesting an external action and retains the original evidence for later human review.'},{type:'citation',sourceId:'mcp-tools'}]}]};change(output);return {response:JSON.stringify(output),usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}};}}};return o;};
 return {options,get calls(){return calls}};
}

test('native complete prose uses charged source/currency, exact quality and opaque admission for the existing publisher',async()=>{
 const f=await setup('native-allow'),n=await native(f);try{
  const event=f.event(),options=n.options(),result=await createHostedMaintenanceAction(options).scheduled(event);
  assert.equal(result.state,'source-backed-publication-complete');assert.equal(result.livePublished,false);assert.equal(n.calls,1);
  const revision=f.publisher.revision(result.publication.publication.revisionId);assert.equal(revision.provenance,'charged-acquired-sources-v1');assert.equal(revision.title,'Complete native candidate');
  const nativeHtml=readFileSync(`${f.publisher.root}/releases/${f.publisher.current().reference.id}/articles/tool-use/index.html`,'utf8');assert.match(nativeHtml,/Source-backed AI content/);assert.match(nativeHtml,/human factual certification unverified/);assert.doesNotMatch(nativeHtml,/Supplied synthetic fixture|Supplied local fixture|Supplied fixture content/);
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

function canonicalPins(remote,commit=remote.state.base){const rows=execFileSync('git',['--git-dir='+remote.state.root,'ls-tree','-r','-z',commit],{encoding:'utf8'}).split('\0').filter(Boolean).map(line=>{const [meta,path]=line.split('\t'),[mode,type,sha]=meta.split(' ');return {path,mode,type,sha};}),baselineMarkdown=remote.read('src/content/articles/tool-use.md',commit).toString();return {expectedBaseCommit:commit,baselineMarkdown,expectedMarkdownHash:hash(baselineMarkdown),qualifiedCodeHash:qualifiedCanonicalCodeHash(new Map(rows.map(e=>[e.path,e])))};}
async function canonicalOptions(f,n,remote){
 for(const sql of readFileSync('migrations/0011_canonical_maintenance_writes.sql','utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await f.local.db.prepare(sql).run();
 const options=n.options();delete options.publisher;options.canonical={enabled:true,...canonicalPins(remote),transport:{kind:'expected-head-maintenance-http-v1',send:remote.port.send}};return options;
}

test('native scheduled path is filesystem-free through atomic expected-head article/history/pointer Git publication',async()=>{
 const remote=controlledGitHub('hosted-native-canonical'),f=await setup('native-canonical'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote),event=f.event(),result=await createHostedMaintenanceAction(options).scheduled(event);
  assert.equal(result.state,'source-backed-canonical-complete');assert.equal(result.canonical.mode,'hosted-source-backed');assert.equal(result.canonicalGitChanged,true);assert.equal(result.deploymentChanged,false);assert.equal(result.livePublished,false);assert.equal(f.publisher.current(),null);assert.equal(remote.state.mutations,1);
  assert.deepEqual(remote.diff(remote.state.base).sort(),['src/content/articles/tool-use.md','src/content/maintenance/tool-use.json',historyPath(result.eventId)].sort());
  const record=JSON.parse(remote.read(historyPath(result.eventId)));assert.equal(record.schemaVersion,3);assert.equal(record.kind,'source-backed-automatic-maintenance-revision');assert.equal(record.proposal.article.provenance,'charged-acquired-sources-v1');assert.equal(record.quality.candidateHash,record.articleRevision);assert.deepEqual(record.flags,['editorial-review','limited-source-coverage']);
  const view=readCanonicalMaintenance({mode:'controlled-static-preview',repo:remote.state.root,sourceCommit:result.canonical.commit});assert.equal(view.history.length,1);assert.equal(view.history[0].receipt.mode,'hosted-source-backed');assert.equal(view.history[0].qualityRequired,true);assert.match(view.history[0].markdown,/AI-assisted sourced maintenance/);assert.match(view.history[0].markdown,/qualityReceiptHash/);
  const calls=remote.state.calls.length;await f.local.restart();assert.deepEqual(await createHostedMaintenanceAction({...options,db:f.local.db}).scheduled(event),result);assert.equal(remote.state.calls.length,calls);assert.equal(n.calls,1);assert.equal(f.counts().sourceCalls,1);assert.equal(f.counts().qualityCalls,1);
 }finally{await f.local.close();}
});

test('native lost GraphQL outcome reconciles after restart using the shared writer outbox without redispatch',async()=>{
 const remote=controlledGitHub('hosted-native-lost'),f=await setup('native-canonical-lost'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote),event=f.event();remote.state.lost=true;
  await assert.rejects(createHostedMaintenanceAction(options).scheduled(event),/controlled lost GraphQL/);assert.equal(remote.state.mutations,1);assert.equal((await f.local.db.prepare('SELECT state FROM canonical_maintenance_writes').first()).state,'dispatched');
  const committed=remote.tip();await f.local.restart();const result=await createHostedMaintenanceAction({...options,db:f.local.db}).scheduled(event);assert.equal(result.canonical.commit,committed);assert.equal(remote.state.dispatches,1);assert.equal(remote.state.mutations,1);assert.equal(n.calls,1);
 }finally{await f.local.close();}
});

test('native current-head conflict never mutates or silently rebases, and shared pipeline serializes concurrent events',async()=>{
 const remote=controlledGitHub('hosted-native-stale'),f=await setup('native-canonical-stale'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote),event=f.event();remote.append({'unrelated.txt':'A competing trusted edit changes the expected head.\n'});
  await assert.rejects(createHostedMaintenanceAction(options).scheduled(event),code('writer_stale_base'));assert.equal(remote.state.mutations,0);
  assert.equal(await f.local.db.prepare("SELECT currency_state FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first(),null);
  await assert.rejects(createHostedMaintenanceAction(options).scheduled({...event,scheduledTime:event.scheduledTime-1000}),code('writer_stale_base'));assert.equal(n.calls,0);assert.equal(remote.state.mutations,0);
 }finally{await f.local.close();}
});

test('native source authority revoked while canonical dispatch is held prevents the actual GraphQL write',async()=>{
 const remote=controlledGitHub('hosted-native-revoked'),f=await setup('native-canonical-revoked'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote),event=f.event();let entered,release;const ready=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);
  options.canonical.checkpoint=async phase=>{if(phase==='dispatched'){entered();await held;}};
  const running=createHostedMaintenanceAction(options).scheduled(event);await ready;
  await f.local.db.prepare("UPDATE http_check_jobs SET state='dead' WHERE state='succeeded'").run();release();await assert.rejects(running,code('adapter_uncharged_body'));
  assert.equal(remote.state.dispatches,0);assert.equal(remote.state.mutations,0);assert.equal((await f.local.db.prepare("SELECT currency_state FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first()).currency_state,'settled');
  await f.local.restart();await assert.rejects(createHostedMaintenanceAction({...options,db:f.local.db}).scheduled(event),code('adapter_uncharged_body'));assert.equal(n.calls,1);assert.equal(remote.state.mutations,0);
 }finally{await f.local.close();}
});

test('native source authority recheck after an actual local render await prevents activation',async()=>{
 const f=await setup('native-render-revoked'),n=await native(f);try{
  const options=n.options(),event=f.event();let entered,release;const ready=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);
  options.publisher={execute:(command,admission)=>f.publisher.execute(command,{...admission,checkpoint:async phase=>{if(phase==='after-seal'){entered();await held;}}})};
  const running=createHostedMaintenanceAction(options).scheduled(event);await ready;await f.local.db.prepare("UPDATE http_check_jobs SET state='dead' WHERE state='succeeded'").run();release();await assert.rejects(running);
  assert.equal(f.publisher.current(),null);assert.equal(n.calls,1);assert.equal((await f.local.db.prepare("SELECT currency_state FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first()).currency_state,'settled');
 }finally{await f.local.close();}
});

test('native concurrent dispatch has one durable claimant and one actual canonical mutation',async()=>{
 const remote=controlledGitHub('hosted-native-concurrent'),f=await setup('native-concurrent'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote),event=f.event();let entered,release;const ready=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve),send=options.source.send;
  options.source.send=async(...args)=>{entered();await held;return send(...args);};
  const running=createHostedMaintenanceAction(options).scheduled(event);await ready;
  await assert.rejects(createHostedMaintenanceAction(options).scheduled(event),code('pipeline_busy_or_attempt_limit'));
  await assert.rejects(createHostedMaintenanceAction(options).scheduled({...event,scheduledTime:event.scheduledTime-1000}),code('pipeline_capacity_or_pending_operation'));
  release();const result=await running;assert.equal(result.state,'source-backed-canonical-complete');assert.equal(remote.state.mutations,1);assert.equal(n.calls,1);assert.equal(f.counts().sourceCalls,1);assert.equal(f.counts().qualityCalls,1);
 }finally{await f.local.close();}
});

test('native opaque admission binds source/generation pins and candidate, and serialized copies cannot authorize',async()=>{
 const f=await setup('native-forged-pins'),n=await native(f);try{
  const options=n.options(),result=await createHostedMaintenanceAction(options).scheduled(f.event()),row=await f.local.db.prepare('SELECT journal FROM maintenance_pipeline_jobs').first(),references=await Promise.all(JSON.parse(row.journal).sources.map(async s=>({citationId:s.citationId,requestKey:s.requestKey,source:(await readSourceCapture(f.local.db,result.eventId,s,true)).source})));
  const complete={...options.completeCandidate,enabled:true,article:options.selection.article,policy:options.policy,db:f.local.db,clock:options.clock},proposal=await createHostedCompleteCandidateAction(complete).read({eventId:result.eventId,sources:references}),context={db:f.local.db,completeCandidate:complete,quality:options.quality,clock:options.clock};
  const forged=structuredClone(proposal);forged.generation.eventId='cfa-'+'0'.repeat(48);await assert.rejects(admitSourceBackedPublication({proposal:forged,baseRevision:null,references},context),code('source_backed_proposal_binding'));
  const forgedSources=structuredClone(references);forgedSources[0].requestKey=crypto.randomUUID();await assert.rejects(admitSourceBackedPublication({proposal,baseRevision:null,references:forgedSources},context),code('adapter_uncharged_body'));
  const authority=await admitSourceBackedPublication({proposal,baseRevision:null,references},context),command={schemaVersion:1,kind:'publish',eventId:result.eventId,baseRevision:null,article:proposal.article};
  await assert.rejects(f.publisher.execute(command,{sourceBacked:JSON.parse(JSON.stringify(authority))}),code('source_backed_publication_authority_required'));
  const altered=structuredClone(command);altered.article.title='A different candidate cannot reuse admission';await assert.rejects(f.publisher.execute(altered,{sourceBacked:authority}),code('source_backed_publication_authority_required'));
  assert.equal(f.publisher.current().manifest.state.sequence,1);assert.equal(n.calls,1);assert.equal(f.counts().qualityCalls,1);
 }finally{await f.local.close();}
});

test('native canonical verification detects an actual unexpected Git tree mutation and never retries the mutation',async()=>{
 const remote=controlledGitHub('hosted-native-unrelated'),f=await setup('native-unrelated'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote),event=f.event();remote.state.mutateFiles=files=>{files['surprise.txt']=Buffer.from('Unexpected controlled mutation.\n');};
  await assert.rejects(createHostedMaintenanceAction(options).scheduled(event),code('writer_unrelated_files_changed'));assert.equal(remote.state.mutations,1);assert.equal((await f.local.db.prepare('SELECT state FROM canonical_maintenance_writes').first()).state,'dispatched');
  await f.local.restart();await assert.rejects(createHostedMaintenanceAction({...options,db:f.local.db}).scheduled(event),code('writer_unrelated_files_changed'));assert.equal(remote.state.mutations,1);assert.equal(remote.state.dispatches,1);assert.equal(n.calls,1);
 }finally{await f.local.close();}
});

test('native and mixed render provenance is accurate while fixture rendering stays byte-identical to the reviewed checkpoint',async()=>{
 const fixture=sample().article,native=sourceBackedArticleInput({...structuredClone(fixture),id:'ai-agent',related:['tool-use','model-context-protocol'],provenance:'charged-acquired-sources-v1',sources:fixture.sources.map(s=>({...s,title:'Registered evidence',publisher:'Controlled original documentation',context:'Original controlled source data for rendering.'}))}),fixtureId=hash(JSON.stringify(fixture)),nativeId=hash(JSON.stringify(native)),base='/local-publications/releases/controlled-render/';
 const state={schemaVersion:1,sequence:1,rendererHash:'0'.repeat(64),parent:null,ancestors:[],articles:{[fixture.id]:fixtureId},history:{[fixture.id]:[fixtureId]},receipts:[],lastOperation:'publish'};
 const reviewed=execFileSync('git',['show','f24633a33f4f67151e04aa524c73b0e19c6921c1:src/publishing/render.ts'],{encoding:'utf8'}),compiled=await build({stdin:{contents:reviewed,resolveDir:process.cwd()+'/src/publishing',loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',external:['node:*']}),old=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 assert.equal(articlePage(fixture,fixtureId,state,base),old.articlePage(fixture,fixtureId,state,base));assert.deepEqual([...pages(state,base,{[fixtureId]:fixture})],[...old.pages(state,base,{[fixtureId]:fixture})]);
 const mixed={...state,sequence:2,articles:{...state.articles,[native.id]:nativeId},history:{...state.history,[native.id]:[nativeId]}},output=pages(mixed,base,{[fixtureId]:fixture,[nativeId]:native});
 assert.match(output.get('index.html'),/Supplied fixtures and source-backed AI content/);assert.match(output.get(`articles/${native.id}/index.html`),/AI-generated complete candidate; human factual certification unverified/);assert.doesNotMatch(output.get(`articles/${native.id}/index.html`),/Supplied synthetic fixture|Supplied local fixture|Supplied fixture content/);assert.match(output.get(`history/${native.id}/${nativeId}.html`),/Source-backed AI content/);assert.match(output.get(`articles/${fixture.id}/index.html`),/Supplied local fixture/);
});

test('actual workerd executes portable native source/currency/quality/canonical path and restarts without another external request',async()=>{
 const {Miniflare,convertV4MiniflareOptions}=await import('miniflare'),{report}=await import('../maintenance-quality/helpers.mjs'),remote=controlledGitHub('hosted-native-workerd'),{article:fixtureArticle}=sample(),article=sourceBackedArticleInput({...fixtureArticle,provenance:'charged-acquired-sources-v1',sources:[{id:'mcp-tools',title:'Controlled native evidence',url:urls[mcp],publisher:'Controlled documentation',context:'Original synthetic content for native Workers testing.'}],blocks:[{type:'paragraph',content:[{type:'text',text:'A controlled native complete candidate placeholder with a required source citation.'},{type:'citation',sourceId:'mcp-tools'}]}]}),path=process.cwd()+'/.git/hosted-native-workerd-test-'+crypto.randomUUID();roots.push(path);
 const script=(await build({entryPoints:['tests/hosted-maintenance/worker-entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*']})).outputFiles[0].text;let sourceCalls=0,aiCalls=0,qualityCalls=0,transportFailure;
 const options={...convertV4MiniflareOptions({name:'hosted-native-test',modules:true,script,compatibilityDate:'2026-10-16',compatibilityFlags:['nodejs_compat'],bindings:{ARTICLE:JSON.stringify(article),BASE:remote.state.base,MARKDOWN_HASH:hash(remote.read('src/content/articles/tool-use.md')),BASELINE:remote.read('src/content/articles/tool-use.md').toString(),CODE_HASH:canonicalPins(remote).qualifiedCodeHash},d1Databases:{EDITORIAL_DB:'hosted-native-d1'},outboundService:async request=>{
  const url=new URL(request.url);if(url.hostname==='api.github.com'){try{return await remote.port.send(new Request(request.url,{method:request.method,headers:[...request.headers],body:request.method==='GET'?undefined:await request.arrayBuffer(),redirect:'manual',credentials:'omit'}));}catch(error){transportFailure={message:String(error),origin:url.origin,redirect:request.redirect,authorizationPresent:request.headers.has('authorization')};return Response.json({controlledTransportError:String(error)},{status:500});}}
  if(url.hostname==='controlled-ai.invalid'){aiCalls++;return Response.json({response:JSON.stringify({title:'Actual Workers native candidate',description:'A complete native candidate tested with controlled source and provider responses.',blocks:[{type:'paragraph',content:[{type:'text',text:'A guarded agent validates every proposed tool argument before requesting an external action and retains the original evidence for later human review.'},{type:'citation',sourceId:'mcp-tools'}]}]}),usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}});}
  if(url.hostname==='controlled-quality.invalid'){qualityCalls++;return Response.json(report(await request.json()));}
  assert.equal(request.url,urls[mcp]);sourceCalls++;return new Response(document(mcp,'A guarded agent validates every proposed tool argument before requesting an external action and retains the original evidence for later human review.'),{headers:{'Content-Type':'text/html'}});
 }}),cf:false,resourcePersistencePath:path};let runtime=new Miniflare(options);
 try{
  const db=await runtime.getD1Database('EDITORIAL_DB');for(const file of ['0005_http_observations.sql','0010_maintenance_proposals.sql','0011_canonical_maintenance_writes.sql','0015_maintenance_pipeline.sql','0016_maintenance_currency.sql','0020_quality_admission.sql','0021_quality_pipeline_dispositions.sql','0024_currency_policy_rotation.sql','0026_http_download_envelope.sql','0028_hosted_source_capture.sql']){
   const raw=readFileSync('migrations/'+file,'utf8').replace(/--[^\n]*/g,'');for(const sql of raw.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi)||[])if(sql.trim())await db.prepare(sql).run();
  }
  const response=await runtime.dispatchFetch('https://controlled.invalid/controlled-scheduled-tick'),result=await response.json();assert.equal(response.status,200,JSON.stringify({result,calls:remote.state.calls,transportFailure}));assert.equal(result.state,'source-backed-canonical-complete');assert.equal(remote.state.mutations,1);assert.equal(sourceCalls,1);assert.equal(aiCalls,1);assert.equal(qualityCalls,1);
  const calls=remote.state.calls.length;await runtime.dispose();runtime=new Miniflare(options);const retry=await runtime.dispatchFetch('https://controlled.invalid/controlled-scheduled-tick');assert.equal(retry.status,200);assert.deepEqual(await retry.json(),result);assert.equal(remote.state.calls.length,calls);assert.equal(sourceCalls,1);assert.equal(aiCalls,1);assert.equal(qualityCalls,1);
 }finally{await runtime.dispose();}
});

test('native canonical tree builds the existing twenty-entry Astro/Pagefind reader with schema3 history and native provenance',async()=>{
 const remote=controlledGitHub('hosted-native-build'),f=await setup('native-build'),n=await native(f),checkout=process.cwd()+'/.git/hosted-native-projected-build-'+crypto.randomUUID();roots.push(checkout);try{
  const options=await canonicalOptions(f,n,remote),result=await createHostedMaintenanceAction(options).scheduled(f.event());
  execFileSync('git',['clone','--no-hardlinks','--no-checkout',remote.state.root,checkout],{stdio:'ignore'});execFileSync('git',['checkout','--detach',result.canonical.commit],{cwd:checkout,stdio:'ignore'});symlinkSync(process.cwd()+'/node_modules',checkout+'/node_modules','dir');writeFileSync(checkout+'/.git/info/exclude','node_modules\n');
  execFileSync('npm',['run','build'],{cwd:checkout,env:{...process.env,CI:'1',ASTRO_TELEMETRY_DISABLED:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',AGENTIC_BIBLE_DISCOVERY_MODE:'staging',AGENTIC_BIBLE_SOURCE_COMMIT:result.canonical.commit,AGENTIC_BIBLE_MAINTENANCE_HISTORY_MODE:'controlled-static-preview'},timeout:45000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
  const html=readFileSync(checkout+'/dist/articles/tool-use/index.html','utf8');assert.match(html,/Complete native candidate/);assert.match(html,/Published source-backed maintenance/);assert.match(html,/AI-assisted sourced maintenance/);assert.match(html,/Source-backed generation/);assert.match(html,/Post-publication review flagged/);
  const catalog=JSON.parse(readFileSync(checkout+'/dist/maintenance-history.json','utf8'));assert.equal(catalog.schemaVersion,3);assert.equal(catalog.history[0].receipt.mode,'hosted-source-backed');assert.equal(catalog.history[0].receipt.commit,result.canonical.commit);
  assert.equal(JSON.parse(readFileSync(checkout+'/dist/source-catalog.json','utf8')).articles.length,20);assert.ok(readdirSync(checkout+'/dist/pagefind').includes('pagefind.js'));
  const candidateOutput=process.cwd()+'/.git/hosted-native-candidate-'+crypto.randomUUID();roots.push(candidateOutput);const candidate=await prepareCandidate(checkout,candidateOutput);assert.equal(candidate.sourceCommit,result.canonical.commit);
 }finally{await f.local.close();}
});

test('native canonical successor binds its exact predecessor and preserves prior immutable history',async()=>{
 const remote=controlledGitHub('hosted-native-successor'),f=await setup('native-successor'),n=await native(f);try{
  const firstOptions=await canonicalOptions(f,n,remote),first=await createHostedMaintenanceAction(firstOptions).scheduled(f.event()),previousBytes=remote.read(historyPath(first.eventId));f.advance(1000);
  const next=n.options();delete next.publisher;next.selection.baseRevision=first.canonical.articleRevision;next.completeCandidate.currency=firstOptions.completeCandidate.currency;next.canonical={...firstOptions.canonical,...canonicalPins(remote,first.canonical.commit)};
  next.completeCandidate.ai.run=async()=>({response:JSON.stringify({title:'Revised native complete candidate',description:'A later complete candidate retains its exact canonical predecessor.',blocks:[{type:'paragraph',content:[{type:'text',text:'The next controlled article explains how a guarded agent validates requested tool arguments and preserves original evidence through every revision for later human review.'},{type:'citation',sourceId:'mcp-tools'}]}]}),usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}});
  const second=await createHostedMaintenanceAction(next).scheduled(f.event());assert.equal(remote.state.mutations,2);assert.equal(second.canonical.baseCommit,first.canonical.commit);assert.deepEqual(remote.read(historyPath(first.eventId)),previousBytes);
  const record=JSON.parse(remote.read(historyPath(second.eventId)));assert.equal(record.previous.eventId,first.eventId);assert.equal(record.proposal.base.revision,first.canonical.articleRevision);assert.equal(record.proposal.base.commit,first.canonical.commit);
  const view=readCanonicalMaintenance({mode:'controlled-static-preview',repo:remote.state.root,sourceCommit:second.canonical.commit});assert.equal(view.history.length,2);assert.equal(view.history[0].current,true);assert.equal(view.history[1].current,false);
 }finally{await f.local.close();}
});

test('native schema3 history retains the existing signed review and explicit restoration authority path',async()=>{
 const {buildCanonicalHistorySite}=await import('../maintenance-restore/build-site.mjs'),{restorationFixture}=await import('../maintenance-restore/helpers.mjs'),{restoreMaintenanceRevision}=await import('../../src/maintenance-restore/coordinator.ts'),remote=controlledGitHub('hosted-native-restoration'),f=await setup('native-restoration'),n=await native(f);let reviewed;
 try{
  const firstOptions=await canonicalOptions(f,n,remote),first=await createHostedMaintenanceAction(firstOptions).scheduled(f.event()),targetMarkdown=remote.read('src/content/articles/tool-use.md').toString();f.advance(1000);
  const next=n.options();delete next.publisher;next.selection.baseRevision=first.canonical.articleRevision;next.completeCandidate.currency=firstOptions.completeCandidate.currency;next.canonical={...firstOptions.canonical,...canonicalPins(remote,first.canonical.commit)};next.completeCandidate.ai.run=async()=>({response:JSON.stringify({title:'Native revision selected for later human follow-up',description:'A second native revision exercises retained restoration authority.',blocks:[{type:'paragraph',content:[{type:'text',text:'A later guarded agent revision retains all prior source records and verifies action boundaries before execution while allowing explicit human restoration to a retained ancestor.'},{type:'citation',sourceId:'mcp-tools'}]}]}),usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}});
  const second=await createHostedMaintenanceAction(next).scheduled(f.event()),site=buildCanonicalHistorySite({remote,writerReceipts:[second.canonical,first.canonical]},second.canonical.commit);assert.equal(site.catalog.schemaVersion,3);
  reviewed=await restorationFixture(site);assert.equal((await reviewed.approve()).status,200);assert.equal(remote.state.mutations,2);
  const approved=await reviewed.app.db.prepare('SELECT * FROM hosted_restoration_approvals').first();
  // Fill exactly the old 16-row boundary with unrelated valid-shaped retained
  // approval rows; schema3 must retain the existing 64-row admitted capacity.
  const audit=await reviewed.app.db.prepare('SELECT * FROM hosted_maintenance_reviews').first();
  for(let index=0;index<15;index++){
   const requestId=crypto.randomUUID(),approvalId=crypto.randomUUID(),receiptCommit=hash('retained-history-'+index).slice(0,40),input={...JSON.parse(audit.input_json),requestId,receiptCommit},raw=JSON.stringify(input,Object.keys(input).sort())+'\n';
   await reviewed.app.db.prepare('INSERT INTO hosted_maintenance_reviews(request_id,owner_hash,input_json,fingerprint,receipt_commit,catalog_hash,version,decision,target_commit,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(requestId,audit.owner_hash,raw,hash(JSON.stringify({owner:audit.owner_hash,input,createdAt:audit.created_at})),receiptCommit,audit.catalog_hash,1,audit.decision,audit.target_commit,audit.note,audit.created_at).run();
   await reviewed.app.db.prepare('INSERT INTO hosted_restoration_approvals(approval_id,request_id,owner_hash,input_json,approval_json,fingerprint,approved_at) VALUES(?,?,?,?,?,?,?)').bind(approvalId,requestId,approved.owner_hash,approved.input_json,approved.approval_json,approved.fingerprint,approved.approved_at).run();
  }
  const newer=reviewed.app.input({expectedVersion:1,decision:'revert-requested',targetCommit:first.canonical.commit});assert.equal((await reviewed.app.request(newer)).status,200);
  const another=crypto.randomUUID();assert.equal((await reviewed.signedRequest('restore-approval',{approvalId:another,requestId:newer.requestId,confirm:'approve-canonical-restoration'})).status,200);assert.equal((await reviewed.app.db.prepare('SELECT COUNT(*) n FROM hosted_restoration_approvals').first()).n,17);
  const receipt=await restoreMaintenanceRevision({approvalId:another},await reviewed.context());assert.equal(receipt.operation,'reviewed-restoration');assert.equal(receipt.restoredFromCommit,first.canonical.commit);assert.equal(remote.state.mutations,3);assert.equal(receipt.livePublished,false);
  const restored=remote.read('src/content/articles/tool-use.md').toString(),body=text=>text.replace(/^---\n[\s\S]*?\n---\n/,'');assert.equal(body(restored),body(targetMarkdown));assert.match(restored,/AI-assisted sourced maintenance/);assert.match(restored,/qualityReceiptHash/);assert.match(restored,/restoration/);
  const view=readCanonicalMaintenance({mode:'controlled-static-preview',repo:remote.state.root,sourceCommit:receipt.commit});assert.equal(view.history.length,3);assert.deepEqual(view.history.map(e=>e.operation),['restoration','automatic','automatic']);assert.equal(view.history[0].qualityRequired,true);assert.deepEqual(view.history[0].sources,view.history[2].sources);
  const restoredSite=buildCanonicalHistorySite(site,receipt.commit);assert.equal(restoredSite.catalog.schemaVersion,3);assert.match(readFileSync(restoredSite.assets+'/articles/tool-use/index.html','utf8'),/Restored after a separate explicit admin approval/);
 }finally{await reviewed?.close();await f.local.close();}
});

async function largeNativeOptions(f,n,remote,{overflow=false}={}){
 const options=await canonicalOptions(f,n,remote);options.selection.article.sources[0]={...options.selection.article.sources[0],id:'openai-tools',url:urls[openai]};options.selection.article.blocks[0].content[1].sourceId='openai-tools';options.selection.sources=[{citationId:'openai-tools',sourceId:openai}];
 const ai=options.completeCandidate.ai.run;options.completeCandidate.ai.run=async(...args)=>{const generated=await ai(...args),value=JSON.parse(generated.response);for(const block of value.blocks)if(block.type==='paragraph')for(const part of block.content)if(part.type==='citation')part.sourceId='openai-tools';return {...generated,response:JSON.stringify(value)};};
 const marker='PRIVATE_RAW_NAVIGATION_MARKER',html=document(openai,'A guarded agent validates every proposed tool argument before requesting an external action and retains the original evidence for later human review.').replace('Navigation is not evidence.',marker+' '+('navigation '.repeat(overflow?105000:6000)));let sourceCalls=0;
 options.source.send=async()=>{sourceCalls++;return new Response(html,{headers:{'Content-Type':'text/html'}});};
 return {options,html,marker,get sourceCalls(){return sourceCalls}};
}

test('registered large original HTML retains private bounded chunks and reaches exact native quality/canonical publication',async()=>{
 const remote=controlledGitHub('hosted-large-source'),f=await setup('large-source'),n=await native(f);try{
  const large=await largeNativeOptions(f,n,remote);let request;const verify=large.options.quality.verifier.verify;large.options.quality.verifier.verify=async(...args)=>{request=args[0];return verify(...args);};
  const event=f.event(),result=await createHostedMaintenanceAction(large.options).scheduled(event);assert.equal(result.state,'source-backed-canonical-complete');assert.ok(Buffer.byteLength(large.html)>32768);assert.equal(request.schemaVersion,2);assert.equal(request.sources[0].bodyHash,hash(large.html));assert.ok(request.canonicalBase.body.length>100);assert.doesNotMatch(JSON.stringify(request),new RegExp(large.marker));
  const capture=await f.local.db.prepare('SELECT * FROM hosted_maintenance_source_captures').first(),chunks=(await f.local.db.prepare('SELECT * FROM hosted_maintenance_source_chunks ORDER BY chunk_index').all()).results;assert.equal(capture.raw_bytes,Buffer.byteLength(large.html));assert.ok(chunks.length>1&&chunks.length<=32);assert.ok(chunks.every(c=>c.chunk_bytes<=32768));assert.equal(chunks.reduce((n,c)=>n+c.chunk_bytes,0),capture.raw_bytes);
  const journal=(await f.local.db.prepare('SELECT journal FROM maintenance_pipeline_jobs').first()).journal;assert.ok(Buffer.byteLength(journal)<2048);assert.doesNotMatch(journal,new RegExp(large.marker));assert.doesNotMatch(remote.read(historyPath(result.eventId)).toString(),new RegExp(large.marker));assert.equal(JSON.parse(remote.read(historyPath(result.eventId))).sourceBindings[0].bytes,capture.raw_bytes);
  const calls=remote.state.calls.length;await f.local.restart();assert.deepEqual(await createHostedMaintenanceAction({...large.options,db:f.local.db}).scheduled(event),result);assert.equal(large.sourceCalls,1);assert.equal(n.calls,1);assert.equal(f.counts().qualityCalls,1);assert.equal(remote.state.calls.length,calls);
 }finally{await f.local.close();}
});

test('missing private capture schema closes before any job admission, source, AI or canonical request',async()=>{
 const remote=controlledGitHub('hosted-missing-capture-schema'),f=await setup('missing-capture-schema'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote);await f.local.db.prepare('DROP TABLE hosted_maintenance_source_chunks').run();await f.local.db.prepare('DROP TABLE hosted_maintenance_source_captures').run();
  await assert.rejects(createHostedMaintenanceAction(options).scheduled(f.event()),code('hosted_capture_schema_required'));assert.equal((await f.local.db.prepare('SELECT COUNT(*) n FROM maintenance_pipeline_jobs').first()).n,0);assert.equal(f.counts().sourceCalls,0);assert.equal(n.calls,0);assert.equal(remote.state.calls.length,0);
 }finally{await f.local.close();}
});

test('over-profile source body stays charged/held without another source attempt or AI call',async()=>{
 const remote=controlledGitHub('hosted-over-profile'),f=await setup('over-profile'),n=await native(f);try{
  const large=await largeNativeOptions(f,n,remote,{overflow:true}),event=f.event();assert.ok(Buffer.byteLength(large.html)>1048576);await assert.rejects(createHostedMaintenanceAction(large.options).scheduled(event));await f.local.restart();await assert.rejects(createHostedMaintenanceAction({...large.options,db:f.local.db}).scheduled(event));assert.equal(large.sourceCalls,1);assert.equal(n.calls,0);assert.equal(remote.state.mutations,0);assert.equal((await f.local.db.prepare('SELECT COUNT(*) n FROM http_request_reservations').first()).n,1);
 }finally{await f.local.close();}
});

test('capture chunk/header corruption stays held after restart and never refetches or regenerates',async()=>{
 for(const variant of ['count','hash','partial']){
  const remote=controlledGitHub('hosted-capture-'+variant),f=await setup('capture-'+variant),n=await native(f);try{
   const large=await largeNativeOptions(f,n,remote),event=f.event();await createHostedMaintenanceAction(large.options).scheduled(event);
   await assert.rejects(f.local.db.prepare("UPDATE hosted_maintenance_source_captures SET state='capturing'").run());await assert.rejects(f.local.db.prepare("UPDATE hosted_maintenance_source_chunks SET chunk_hash=?").bind('0'.repeat(64)).run());
   // Explicit synthetic disk-corruption injection bypasses the append-only
   // trigger solely to verify read/restart closure; application code cannot do it.
   if(variant==='hash'){await f.local.db.prepare('DROP TRIGGER hosted_capture_chunk_immutable').run();await f.local.db.prepare('UPDATE hosted_maintenance_source_chunks SET chunk_hash=? WHERE chunk_index=0').bind('0'.repeat(64)).run();}
   else{await f.local.db.prepare('DROP TRIGGER hosted_capture_ready_immutable').run();await f.local.db.prepare(variant==='count'?'UPDATE hosted_maintenance_source_captures SET chunk_count=chunk_count+1':"UPDATE hosted_maintenance_source_captures SET state='capturing'").run();}
   const calls=remote.state.calls.length;await f.local.restart();await assert.rejects(createHostedMaintenanceAction({...large.options,db:f.local.db}).scheduled(event),code('hosted_capture_unconfirmed_or_corrupt'));assert.equal(large.sourceCalls,1);assert.equal(n.calls,1);assert.equal(remote.state.calls.length,calls);assert.equal(remote.state.mutations,1);
  }finally{await f.local.close();}
 }
});

test('lost atomic capture reply reconciles complete chunks without a new source or AI attempt',async()=>{
 const remote=controlledGitHub('hosted-capture-lost'),f=await setup('capture-lost'),n=await native(f);try{
  const large=await largeNativeOptions(f,n,remote),db=f.local.db;let captureBatch=false,lost=false;
  const proxy={prepare(sql){if(sql.startsWith('INSERT INTO hosted_maintenance_source_captures'))captureBatch=true;return db.prepare(sql);},async batch(rows){const result=await db.batch(rows);if(captureBatch&&!lost){captureBatch=false;lost=true;throw Error('Controlled lost capture reply after atomic commit');}return result;}};
  const result=await createHostedMaintenanceAction({...large.options,db:proxy}).scheduled(f.event());assert.equal(result.state,'source-backed-canonical-complete');assert.equal(lost,true);assert.equal(large.sourceCalls,1);assert.equal(n.calls,1);assert.equal((await db.prepare('SELECT state FROM hosted_maintenance_source_captures').first()).state,'ready');
 }finally{await f.local.close();}
});

test('new stale or unqualified canonical base stops before new source/AI/quality costs and cannot silently rebase',async()=>{
 const remote=controlledGitHub('hosted-preflight'),f=await setup('preflight'),n=await native(f);try{
  const options=await canonicalOptions(f,n,remote);await createHostedMaintenanceAction(options).scheduled(f.event());const counts=f.counts(),models=n.calls;f.advance(1000);await assert.rejects(createHostedMaintenanceAction(options).scheduled(f.event()),code('writer_stale_base'));assert.deepEqual(f.counts(),counts);assert.equal(n.calls,models);assert.equal(remote.state.mutations,1);
  const changed=remote.append({'src/styles/global.css':'/* An unqualified reader implementation. */\n'}),oldCode=options.canonical.qualifiedCodeHash,fresh={...options,canonical:{...options.canonical,...canonicalPins(remote,changed),qualifiedCodeHash:oldCode}};
  await assert.rejects(createHostedMaintenanceAction(fresh).scheduled(f.event()),code('native_unqualified_canonical_code'));assert.deepEqual(f.counts(),counts);assert.equal(n.calls,models);assert.equal(remote.state.mutations,1);
 }finally{await f.local.close();}
});

test('native generated links must resolve to compiled inventory even if the trusted semantic verifier would allow',async()=>{
 const remote=controlledGitHub('hosted-unresolved-link'),f=await setup('unresolved-link'),n=await native(f,output=>output.blocks[1].content.push({type:'article',articleId:'untrusted-new-topic',label:'Unknown topic'}));try{
  const options=await canonicalOptions(f,n,remote),event=f.event();await assert.rejects(createHostedMaintenanceAction(options).scheduled(event),code('unresolved_article_link'));await f.local.restart();await assert.rejects(createHostedMaintenanceAction({...options,db:f.local.db}).scheduled(event),code('unresolved_article_link'));assert.equal(n.calls,1);assert.equal(f.counts().qualityCalls,0);assert.equal(remote.state.mutations,0);assert.equal((await f.local.db.prepare("SELECT currency_state FROM maintenance_proposals WHERE event_id LIKE 'cfa-%'").first()).currency_state,'settled');
 }finally{await f.local.close();}
});
