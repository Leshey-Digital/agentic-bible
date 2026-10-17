import {test,expect,type Page} from '@playwright/test';
import {readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {Miniflare,convertV4MiniflareOptions,Response as ControlledResponse} from 'miniflare';
import {build} from 'esbuild';
import {close as closePagefind} from 'pagefind';
import {httpSources} from '../../src/monitoring/http-registry.ts';
import type {HttpLastGood} from '../../src/monitoring/http-core.ts';
import {PublicationStore} from '../../src/publishing/store.ts';
import {publicationServer} from '../../src/publishing/preview.ts';
import {hash,type Publish,type Receipt} from '../../src/publishing/contracts.ts';

test('controlled HTTP collection and separately supplied revisions retain distinct provenance through restart, replay and rollback',async({page})=>{
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
  const persist=join(git,'combined-http-publication-browser');const name='article-publication-combined-browser';
  rmSync(persist,{recursive:true,force:true});rmSync(join(git,name),{recursive:true,force:true});
  let publisher=new PublicationStore(name);let runtime:Miniflare|undefined;let requests=0;let scenario:'baseline'|'change'|'304'|'redirect'='baseline';
  const fixture=JSON.parse(readFileSync('fixtures/local-publication/article-v1.json','utf8')) as Publish;
  const source=httpSources.find(item=>item.url===fixture.article.sources.find(item=>item.id==='tools')!.url)!;
  expect(source).toBeTruthy();
  const originalArticles=['ai-agent','tool-use','model-context-protocol'].map(id=>hash(readFileSync(`src/content/articles/${id}.md`)));
  const bundle=await build({entryPoints:['tests/http-worker/entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*']});
  async function start(){
    runtime=new Miniflare({...convertV4MiniflareOptions({name:'combined-observation-test',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'combined-http'},outboundService:request=>{
      expect(request.url).toBe(source.url);expect(request.method).toBe('GET');expect(request.headers.has('authorization')).toBe(false);expect(request.headers.has('cookie')).toBe(false);requests++;
      if(scenario==='304'){expect(request.headers.get('if-none-match')).toBe(requests<4?'"controlled-v1"':'"controlled-v2"');return new ControlledResponse(null,{status:304});}
      if(scenario==='redirect')return new ControlledResponse(null,{status:302,headers:{Location:'http://169.254.169.254/private'}});
      return new ControlledResponse(scenario==='baseline'?'Synthetic controlled document one.':'Synthetic controlled document two.',{headers:{'Content-Type':'text/plain',ETag:scenario==='baseline'?'"controlled-v1"':'"controlled-v2"'}});
    }}),cf:false,resourcePersistencePath:persist});
    return runtime.getD1Database('EDITORIAL_DB');
  }
  const collect=async(key:string)=>{
    const response=await runtime!.dispatchFetch('http://localhost/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:source.id,key})});expect(response.status).toBe(200);
    return response.json() as Promise<{status:string;state:HttpLastGood;observation:{kind:string};error?:{code:string}}>;
  };
  let db=await start();let server:ReturnType<typeof publicationServer>|undefined;
  const state=()=>db.prepare('SELECT * FROM http_source_state WHERE source_id=?').bind(source.id).first();
  const outside:string[]=[];const errors:string[]=[];
  try{
    for(const file of readdirSync('migrations').filter(file=>file.endsWith('.sql')).sort()){
      for(const sql of readFileSync(join('migrations',file),'utf8').replace(/--[^\n]*/g,'').split(';').map(sql=>sql.trim()).filter(Boolean))await db.prepare(sql).run();
    }
    const firstKey=crypto.randomUUID();const baseline=await collect(firstKey);expect(baseline.observation.kind).toBe('baseline');expect(publisher.current()).toBeNull();
    await runtime!.dispose();db=await start();expect(await collect(firstKey)).toEqual(baseline);expect(requests).toBe(1);expect(publisher.current()).toBeNull();
    scenario='304';expect((await collect(crypto.randomUUID())).observation.kind).toBe('not-modified');expect(publisher.current()).toBeNull();

    // Explicitly supplied original fixture. No source bytes/hash are converted to article content or fed into its schema.
    fixture.eventId='combined-supplied-first';const firstReceipt=await publisher.execute(fixture);const first=publisher.current()!;
    server=publicationServer(publisher,0);await new Promise<void>(resolve=>server!.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Missing loopback address');
    const origin=`http://127.0.0.1:${address.port}`;
    page.on('request',request=>{if(new URL(request.url()).origin!==origin)outside.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
    const search=async(view:Page,release:string,term:string,count:number)=>{
      await view.goto(`${origin}/local-publications/releases/${release}/search/`);await view.getByLabel('Search published local revisions',{exact:true}).fill(`"${term}"`);await view.getByRole('button',{name:'Search',exact:true}).click();
      await expect(view.getByRole('status')).toHaveText(`${count} ${count===1?'entry':'entries'} found in this snapshot.`);await expect(view.locator('#search-results>li')).toHaveCount(count);
    };
    await search(page,first.reference.id,'amberorchard',1);await page.locator('#search-results a').click();await expect(page.getByRole('heading',{level:1})).toHaveText(fixture.article.title);
    await page.getByRole('link',{name:'Source 1',exact:true}).click();await expect(page.locator('#source-guide')).toBeVisible();
    scenario='change';const changedKey=crypto.randomUUID();const changed=await collect(changedKey);expect(changed.observation.kind).toBe('changed');expect(changed.state.hash).not.toBe(baseline.state.hash);
    expect(publisher.current()!.reference).toEqual(first.reference);expect((await db.prepare('SELECT COUNT(*) AS count FROM publication_candidates').first<{count:number}>())!.count).toBe(0);
    const invalid=structuredClone(fixture);invalid.eventId='combined-invalid-topic';invalid.baseRevision=firstReceipt.revisionId;(invalid.article as unknown as Record<string,unknown>).topic=['Foundations'];
    await expect(publisher.execute(invalid)).rejects.toMatchObject({code:'invalid_topic'});expect(publisher.current()!.reference).toEqual(first.reference);
    const supplied=structuredClone(fixture);supplied.eventId='combined-supplied-second';supplied.baseRevision=firstReceipt.revisionId;supplied.article.title='Separately supplied replacement';
    const paragraph=supplied.article.blocks[1];if(paragraph.type!=='paragraph'||paragraph.content[0].type!=='text')throw new Error('Expected supplied text');
    paragraph.content[0].text='Cedarharbor is the distinctive term in a separately supplied original fixture. No collector response generated this article; technical validation and publication are exercised independently.';
    const secondReceipt=await publisher.execute(supplied);const second=publisher.current()!;
    publisher=new PublicationStore(name);expect(await publisher.execute(fixture)).toEqual(firstReceipt);expect(publisher.current()!.reference).toEqual(second.reference);
    await search(page,first.reference.id,'amberorchard',1);await search(page,second.reference.id,'amberorchard',0);await search(page,second.reference.id,'cedarharbor',1);
    await page.goto(`${origin}/local-publications/releases/${second.reference.id}/review/`);await expect(page.getByRole('link',{name:supplied.article.title,exact:true})).toBeVisible();
    await page.goto(`${origin}/local-publications/releases/${second.reference.id}/history/`);await expect(page.locator('#article-fixture-agent-loop li')).toHaveCount(2);
    await runtime!.dispose();db=await start();scenario='304';expect((await collect(crypto.randomUUID())).state.hash).toBe(changed.state.hash);
    const lastGood=await state();scenario='redirect';expect((await collect(crypto.randomUUID())).error?.code).toBe('redirect_blocked');expect(await state()).toEqual(lastGood);expect(publisher.current()!.reference).toEqual(second.reference);
    const rollback={schemaVersion:1,kind:'rollback',eventId:'combined-rollback',expectedRelease:second.reference.id,targetRelease:first.reference.id};const rollbackReceipt=await publisher.execute(rollback);const restored=publisher.current()!;
    await search(page,restored.reference.id,'amberorchard',1);await search(page,restored.reference.id,'cedarharbor',0);expect(await publisher.execute(supplied)).toEqual(secondReceipt);expect(await new PublicationStore(name).execute(rollback)).toEqual(rollbackReceipt);
    expect(publisher.current()!.reference).toEqual(restored.reference);expect(await collect(changedKey)).toEqual(changed);expect(requests).toBe(5);expect(await state()).toEqual(lastGood);
    expect((await db.prepare('SELECT used FROM http_request_budget').first<{used:number}>())!.used).toBe(5);
    expect(['ai-agent','tool-use','model-context-protocol'].map(id=>hash(readFileSync(`src/content/articles/${id}.md`)))).toEqual(originalArticles);expect(outside).toEqual([]);expect(errors).toEqual([]);
    const receipts:Receipt[]=[firstReceipt,secondReceipt,rollbackReceipt];
    writeFileSync(join(git,'combined-journey-evidence.json'),JSON.stringify({scope:'test-orchestration-only',automaticBridge:false,sourceId:source.id,sourceUrl:source.url,baselineHash:baseline.state.hash,changedHash:changed.state.hash,requests,reservations:5,suppliedEventReceipts:receipts,restoredRelease:restored.reference.id,collectorRollback:false},null,2)+'\n');
  }finally{
    if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));if(runtime)await runtime.dispose();await closePagefind();
  }
});
