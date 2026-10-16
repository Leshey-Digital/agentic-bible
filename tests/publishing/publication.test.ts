import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync,readdirSync,symlinkSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {get as httpGet} from 'node:http';
import {close as closePagefind} from 'pagefind';
import {PublicationStore,type Phase} from '../../src/publishing/store.ts';
import {publicationServer} from '../../src/publishing/preview.ts';
import {commandInput,hash,publicationLimits,PublicationError,type Publish} from '../../src/publishing/contracts.ts';

const roots:string[]=[];
function store(){const value=new PublicationStore('article-publication-unit-'+crypto.randomUUID());roots.push(value.root);return value;}
const fixture=()=>JSON.parse(readFileSync('fixtures/local-publication/article-v1.json','utf8')) as Publish;
function next(base:string|null,eventId='revision-two'):Publish{const value=fixture();value.eventId=eventId;value.baseRevision=base;value.article.title='Changed local revision';(value.article.blocks[1] as any).content[0].text='Cedarharbor is the unique token in this later supplied fixture. It must replace the previous current search content atomically while preserving the earlier readable revision.';return value;}
const code=(expected:string)=>(error:unknown)=>error instanceof PublicationError&&error.code===expected;
after(async()=>{await closePagefind();for(const root of roots)rmSync(root,{recursive:true,force:true});});

test('strict schema rejects unsafe markup/URLs, invalid citations/dates/types and unknown fields with technical reasons',()=>{
  const cases:[string,(v:any)=>void][]=[
    ['invalid_schema',v=>v.extra='not accepted'],['unsupported_schema',v=>v.schemaVersion=2],['invalid_identifier',v=>v.article.id='../escape'],
    ['unsafe_markup',v=>v.article.title='<img src=x onerror=alert(1)>'],['unsafe_markup',v=>v.article.blocks[1].content[0].text='<script>synthetic()</script>'],
    ['unsafe_source_url',v=>v.article.sources[0].url='https://127.0.0.1/private'],['unsafe_source_url',v=>v.article.sources[0].url='https://example.org/?key=synthetic'],
    ['unresolved_citation',v=>v.article.blocks[1].content[1].sourceId='missing'],['missing_paragraph_evidence',v=>v.article.blocks[1].content.pop()],
    ['unused_or_missing_evidence',v=>v.article.blocks.splice(3,1)],['duplicate_source',v=>v.article.sources.push(v.article.sources[0])],
    ['invalid_date',v=>v.article.verified='2026-02-31'],['invalid_quality_concern',v=>v.article.concerns=['approval-required']],
    ['unsupported_block',v=>v.article.blocks[0]={type:'html',content:'plain'}],['invalid_text',v=>v.article.title='\ud800'],
    ['unsupported_schema',v=>v.schemaVersion='1'],['invalid_text',v=>v.article.verified=['2026-10-16']],
    ['unsupported_provenance',v=>v.article.provenance=['supplied-local-fixture']],
    ['invalid_text',v=>v.article.sources[0].url=['https://example.org/']],
    ['invalid_quality_concern',v=>v.article.concerns=[['editorial-review']]],
  ];
  for(const [expected,mutate]of cases){const value=fixture();mutate(value);assert.throws(()=>commandInput(value),code(expected),expected);}
  const large=fixture();large.article.description='x'.repeat(publicationLimits.inputBytes);assert.throws(()=>commandInput(large),code('input_too_large'));
});

test('topic requires an allowed string and malformed topics cannot change a published snapshot or claim an event',async()=>{
  const output=store();const first=await output.execute(fixture());
  const inventory=(directory=output.root):Record<string,string>=>Object.fromEntries(readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry=>{
    const path=join(directory,entry.name);return entry.isDirectory()?Object.entries(inventory(path)):[[path.slice(output.root.length+1),hash(readFileSync(path))]];
  }));
  const snapshot=()=>({current:output.current(),pointer:readFileSync(join(output.root,'current.json'),'utf8'),files:inventory()});
  const before=snapshot();
  const cases:[string,unknown][]=[['array',['Foundations']],['nested-array',[['Foundations']]],['object',{value:'Foundations'}],['null',null],['number',42],['boolean',true],['unexpected-string','Unexpected']];
  for(const [name,topic]of cases){
    const value=next(first.revisionId,'invalid-topic-'+name);(value.article as unknown as Record<string,unknown>).topic=topic;
    assert.throws(()=>commandInput(value),code('invalid_topic'),name);
    await assert.rejects(output.execute(value),code('invalid_topic'),name);
    assert.deepEqual(snapshot(),before,`${name}: pointer, manifests, revisions, search assets, receipts and sequence must be unchanged`);
  }
  for(const topic of ['Foundations','Capabilities','Protocols'] as const){const value=fixture();value.article.topic=topic;const normalized=commandInput(value) as Publish;assert.equal(normalized.article.topic,topic);}
  const corrected=next(first.revisionId,'invalid-topic-array');corrected.article.topic='Capabilities';
  const receipt=await output.execute(corrected);assert.equal(receipt.sequence,2);assert.deepEqual(receipt.flags,['editorial-review']);
  assert.equal(output.revision(receipt.revisionId!).topic,'Capabilities');
});

test('unknown crosslinks and stale bases fail before activation; valid flagged content publishes automatically and escapes text',async()=>{
  const output=store();const unknown=fixture();unknown.article.related=['unpublished-entry'];await assert.rejects(output.execute(unknown),code('unresolved_article_link'));assert.equal(output.current(),null);
  const value=fixture();value.article.title='Quotes " & < 7';const first=await output.execute(value);assert.equal(first.action,'publish');assert.deepEqual(first.flags,['editorial-review']);
  const current=output.current()!;const html=readFileSync(join(output.root,'releases',current.reference.id,'articles/fixture-agent-loop/index.html'),'utf8');
  assert.match(html,/Quotes &quot; &amp; &lt; 7/);assert.match(html,/href="#source-guide"/);assert.match(html,/id="source-guide"/);assert.match(html,/href="\/articles\/tool-use\/"/);assert.match(html,/Published locally/);assert.match(html,/Post-publication review flagged/);assert.doesNotMatch(html,/<script/);
  assert.ok(current.manifest.files['pagefind/pagefind.js']);assert.ok(current.manifest.files['review/index.html']);
  await assert.rejects(output.execute({...value,eventId:'wrong-base'}),code('stale_revision'));assert.equal(output.current()!.reference.id,current.reference.id);
  const one=store();const limited=fixture();limited.article.sources.pop();limited.article.blocks.splice(3,1);limited.article.concerns=[];assert.deepEqual((await one.execute(limited)).flags,['limited-source-coverage']);assert.ok(one.current());
});

test('exact event receipts survive later writes and rollback; conflicting reuse fails and every earlier revision stays readable',async()=>{
  const output=store();const original=fixture();const first=await output.execute(original);const initial=output.current()!;
  const secondInput=next(first.revisionId);const second=await output.execute(secondInput);const latest=output.current()!;
  assert.deepEqual(await new PublicationStore(output.root.split('/').at(-1)).execute(original),first);
  await assert.rejects(output.execute({...original,article:secondInput.article}),code('event_reference_conflict'));
  await assert.rejects(output.execute({schemaVersion:1,kind:'rollback',eventId:'bad-rollback',expectedRelease:initial.reference.id,targetRelease:null}),code('stale_release'));
  const rollback={schemaVersion:1,kind:'rollback',eventId:'rollback-one',expectedRelease:latest.reference.id,targetRelease:initial.reference.id};
  const restored=await output.execute(rollback);const current=output.current()!;assert.equal(current.manifest.state.articles[original.article.id],first.revisionId);assert.equal(current.manifest.state.history[original.article.id].length,2);
  assert.ok(current.manifest.files[`history/${original.article.id}/${second.revisionId}.html`]);assert.deepEqual(await output.execute(secondInput),second);assert.deepEqual(await output.execute(rollback),restored);assert.equal(output.current()!.reference.id,current.reference.id);
  assert.equal(output.load(latest.reference).state.articles[original.article.id],second.revisionId);
  await output.execute({schemaVersion:1,kind:'rollback',eventId:'rollback-empty',expectedRelease:current.reference.id,targetRelease:null});assert.deepEqual(output.current()!.manifest.state.articles,{});assert.equal(output.current()!.manifest.state.history[original.article.id].length,2);
});

test('identical inputs produce byte-identical deterministic snapshot manifests and file hashes in independent stores',async()=>{
  const a=store(),b=store();assert.deepEqual(await a.execute(fixture()),await b.execute(fixture()));
  assert.deepEqual(a.current(),b.current());
});

test('rollback keeps historical crosslinks usable when a later linked article is no longer current',async()=>{
  const output=store();const original=fixture();const first=await output.execute(original);const target=output.current()!;
  const bridge=fixture();bridge.eventId='bridge-created';bridge.article.id='fixture-tool-bridge';bridge.article.title='A linked local bridge';bridge.article.related=[original.article.id];(bridge.article.blocks[3] as any).content[1].articleId=original.article.id;
  const linked=await output.execute(bridge);
  const revised=next(first.revisionId,'links-revised');revised.article.related=[bridge.article.id];(revised.article.blocks[3] as any).content[1].articleId=bridge.article.id;
  const newer=await output.execute(revised);const before=output.current()!;
  await output.execute({schemaVersion:1,kind:'rollback',eventId:'links-rollback',expectedRelease:before.reference.id,targetRelease:target.reference.id});
  const restored=output.current()!;assert.equal(restored.manifest.state.articles[bridge.article.id],undefined);
  const destination=`history/${bridge.article.id}/${linked.revisionId}.html`;assert.ok(restored.manifest.files[destination]);
  const old=readFileSync(join(output.root,'releases',restored.reference.id,`history/${original.article.id}/${newer.revisionId}.html`),'utf8');assert.ok(old.includes(`/local-publications/releases/${restored.reference.id}/${destination}`));
});

test('interruption checkpoints preserve the last complete snapshot until a full activation and retries recover once',async()=>{
  for(const phase of ['after-revision','after-render','after-index','after-seal','after-activate'] as Phase[]){
    const output=store();const first=await output.execute(fixture());const before=output.current()!;const value=next(first.revisionId,'interrupted-'+phase);
    await assert.rejects(output.execute(value,{checkpoint:p=>{if(p===phase)throw new Error('synthetic interruption');}}),code('publication_outcome_unconfirmed'));
    if(phase!=='after-activate')assert.equal(output.current()!.reference.id,before.reference.id);else assert.equal(output.current()!.manifest.state.sequence,2);
    const result=await output.execute(value);assert.equal(result.sequence,2);assert.deepEqual(await output.execute(value),result);assert.equal(output.current()!.manifest.state.sequence,2);assert.equal(readdirSync(join(output.root,'staging')).length,0);
  }
});

test('actual process death releases the mutex; sealed orphan stays invisible and post-activation retry confirms the committed event',async()=>{
  const output=store();const first=await output.execute(fixture());const before=output.current()!;
  for(const [index,phase]of (['after-render','after-seal','after-activate'] as const).entries()){
    const old=output.current()!;const base=old.manifest.state.articles['fixture-agent-loop'];const value=next(base,'process-death-'+index);
    const script=`import {PublicationStore} from ${JSON.stringify(pathToFileURL(resolve('src/publishing/store.ts')).href)};const store=new PublicationStore(${JSON.stringify(output.root.split('/').at(-1))});await store.execute(${JSON.stringify(value)},{checkpoint:phase=>{if(phase===${JSON.stringify(phase)})process.kill(process.pid,'SIGKILL');}});`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:60000});assert.equal(child.signal,'SIGKILL');
    if(phase==='after-activate')assert.equal(output.current()!.manifest.state.sequence,old.manifest.state.sequence+1);else assert.equal(output.current()!.reference.id,old.reference.id);
    const receipt=await output.execute(value);assert.equal(receipt.sequence,old.manifest.state.sequence+1);assert.deepEqual(await output.execute(value),receipt);
  }
  assert.equal(output.load(before.reference).state.articles['fixture-agent-loop'],first.revisionId);
});

test('concurrent writers fail busy and safely retry without replacing another revision',async()=>{
  const output=store();const value=fixture();const outcomes=await Promise.allSettled([output.execute(value),output.execute(value)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);const rejected=outcomes.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.ok(code('publication_busy')(rejected.reason));
  assert.equal((await output.execute(value)).sequence,1);assert.equal(output.current()!.manifest.state.history[value.article.id].length,1);
});

test('tampered pointers, HTML/search assets, revisions and unlisted files fail closed without silently serving older state',async()=>{
  const output=store();const receipt=await output.execute(fixture());const current=output.current()!;
  for(const path of ['current.json',`releases/${current.reference.id}/articles/fixture-agent-loop/index.html`,`releases/${current.reference.id}/pagefind/pagefind.js`,`revisions/${receipt.revisionId}.json`]){
    const full=join(output.root,path);const original=readFileSync(full);writeFileSync(full,'synthetic corruption');assert.throws(()=>output.current(),code('artifact_corrupt'));writeFileSync(full,original);assert.equal(output.current()!.reference.id,current.reference.id);
  }
  const extra=join(output.root,'releases',current.reference.id,'not-in-manifest.txt');writeFileSync(extra,'synthetic');assert.throws(()=>output.current(),code('artifact_corrupt'));unlinkSync(extra);
  assert.throws(()=>new PublicationStore('../src/content'),code('unsafe_output'));
  const symlink=output.root+'-symlink';symlinkSync(output.root,symlink);try{assert.throws(()=>new PublicationStore(symlink.split('/').at(-1)),code('unsafe_output'));}finally{unlinkSync(symlink);}
});

test('bounded operation/storage capacity preserves accepted receipts and the prior active snapshot',async()=>{
  const output=store();const original=fixture();const first=await output.execute(original);let capacity=false;
  for(let i=1;i<=publicationLimits.operations;i++){
    const before=output.current()!;const value={...original,eventId:'capacity-'+i,baseRevision:first.revisionId};
    try{await output.execute(value);}catch(error){assert.ok(code('publication_capacity')(error),String(error));assert.equal(output.current()!.reference.id,before.reference.id);capacity=true;break;}
  }
  assert.equal(capacity,true);assert.deepEqual(await output.execute(original),first);assert.equal(output.current()!.manifest.state.history[original.article.id].length,1);
  const full=output.current()!;await output.execute({schemaVersion:1,kind:'rollback',eventId:'capacity-terminal-rollback',expectedRelease:full.reference.id,targetRelease:null});assert.deepEqual(output.current()!.manifest.state.articles,{});assert.deepEqual(await output.execute(original),first);
});

test('preview is loopback/read-only, refuses traversal and sealed uncommitted snapshots, and never alters source Markdown',async()=>{
  const output=store();const originalHashes=['ai-agent','tool-use','model-context-protocol'].map(id=>hash(readFileSync(`src/content/articles/${id}.md`)));
  const first=await output.execute(fixture());const current=output.current()!;
  await assert.rejects(output.execute(next(first.revisionId),{checkpoint:phase=>{if(phase==='after-seal')throw new Error('stop');}}));
  const orphan=readdirSync(join(output.root,'releases')).find(id=>id!==current.reference.id)!;
  const server=publicationServer(output,0);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as any;const origin='http://127.0.0.1:'+address.port;
  try{
    assert.equal((await fetch(origin+'/local-publications/')).status,200);
    assert.equal((await fetch(origin+'/local-publications/',{method:'POST'})).status,405);
    const remoteHost=await new Promise<number|undefined>((resolve,reject)=>{httpGet(origin+'/local-publications/',{headers:{Host:'remote.invalid'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);});assert.equal(remoteHost,403);
    for(const path of ['/local-publications/releases/'+orphan+'/',`/local-publications/releases/${current.reference.id}/../../store.json`,'/local-publications/current.json','/.git/config','/admin/'])assert.equal((await fetch(origin+path)).status,404,path);
    const response=await fetch(origin+`/local-publications/releases/${current.reference.id}/manifest.json`);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy')! ,/object-src 'none'/);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
  assert.deepEqual(['ai-agent','tool-use','model-context-protocol'].map(id=>hash(readFileSync(`src/content/articles/${id}.md`))),originalHashes);
});
