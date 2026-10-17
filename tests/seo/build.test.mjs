import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {projectFiles,write,inventory} from '../../src/wiki-bridge/files.ts';
import {articleIds,publicRoutes} from '../../src/seo/policy.ts';
import {git} from '../wiki-bridge/helpers.mjs';
import {seoPreviewEnvironment} from './local-runtime.mjs';
import {verifySeoCliIsolation} from './cli-isolation.mjs';
test('actual canonical, staging, synthetic and mixed builds produce coherent discovery without touching ordinary dist',{timeout:120000},async()=>{
  const original=inventory('src/content/articles'),dist=inventory('dist');const scratch=mkdtempSync(join(tmpdir(),'agentic-seo-build-')),root=join(scratch,'project');mkdirSync(root);
  for(const [path,bytes]of Object.entries(projectFiles(process.cwd()).files))write(join(root,path),bytes);symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
  async function build(name,env){const output=join(root,'build-artifacts',name);await new Promise((done,failed)=>{const child=spawn(process.execPath,[resolve('scripts/seo-build-child.mjs'),root,output],{cwd:root,env:{PATH:process.env.PATH,ASTRO_TELEMETRY_DISABLED:'1',...env},stdio:['ignore','ignore','pipe']});let diagnostic='';child.stderr.on('data',chunk=>{if(diagnostic.length<2000)diagnostic+=chunk.toString().slice(0,2000-diagnostic.length);});const timer=setTimeout(()=>{child.kill('SIGKILL');failed(Error('isolated SEO build timeout'));},30000);child.on('error',failed);child.on('exit',code=>{clearTimeout(timer);code===0?done():failed(Error('isolated SEO build failed: '+diagnostic));});});return output;}
  const manifest=output=>JSON.parse(readFileSync(join(output,'indexing-manifest.json'),'utf8'));
  const html=(output,path)=>readFileSync(join(output,path.endsWith('/')?path.slice(1)+'index.html':path.slice(1)),'utf8');
  async function serve(output,canonical){
    await new Promise((done,failed)=>{const probe=createServer();probe.once('error',failed);probe.listen(8794,'127.0.0.1',()=>probe.close(done));});
    const config=join(scratch,'wrangler-seo-proof.json');writeFileSync(config,JSON.stringify({name:'agentic-bible-seo-proof',compatibility_date:'2026-10-16',workers_dev:false,preview_urls:false,send_metrics:false,assets:{directory:output,html_handling:'force-trailing-slash',not_found_handling:'404-page'}}));
    const child=spawn(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'dev','--local','--config',config,'--ip','127.0.0.1','--port','8794','--persist-to',join(root,'worker-state')],{cwd:root,env:seoPreviewEnvironment(resolve('.git/runtime-config'),resolve('.git/runtime-cache')),stdio:'ignore'});
    const origin='http://127.0.0.1:8794';try{
      let ready=false;for(let n=0;n<150;n++){if(child.exitCode!==null)throw Error('local static Worker exited');try{const response=await fetch(origin+'/articles/tool-use/');if(response.status===200){ready=true;assert.equal(response.headers.get('x-robots-tag'),canonical?null:'noindex, nofollow');break;}}catch(error){if(error?.code==='ERR_ASSERTION')throw error;}await new Promise(resolve=>setTimeout(resolve,100));}assert.equal(ready,true,'local static Worker startup');
      assert.deepEqual(await (await fetch(origin+'/indexing-manifest.json')).json(),manifest(output));
      for(const path of ['/search/','/contribute/','/admin/','/api/admin/settings','/indexing-manifest.json']){const response=await fetch(origin+path);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow',path);}
      assert.match((await fetch(origin+'/articles/tool-use/')).headers.get('content-security-policy'),/default-src 'self'/);
    }finally{if(child.exitCode===null&&child.signalCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await stopped;clearTimeout(timer);}}
  }
  try{
    const canonical=await build('canonical',{AGENTIC_BIBLE_DISCOVERY_MODE:'production',AGENTIC_BIBLE_CANONICAL_ORIGIN:'https://agenticbible.si'}),m=manifest(canonical);assert.deepEqual(m.entries.map(e=>e.articleId).sort(),[...articleIds].sort());
    writeFileSync(join(git,'seo-canonical-manifest.json'),JSON.stringify(m));
    const xml=readFileSync(join(canonical,'sitemap.xml'),'utf8');writeFileSync(join(git,'seo-canonical-sitemap.xml'),xml);assert.equal((xml.match(/<url>/g)??[]).length,publicRoutes.length);for(const path of publicRoutes)assert.ok(xml.includes(`<loc>https://agenticbible.si${path}</loc>`));
    for(const entry of m.entries){assert.ok(xml.includes(`<loc>${entry.url}</loc>`));const source=html(canonical,`/articles/${entry.articleId}/`);assert.ok(source.includes(`rel="canonical" href="${entry.url}"`));assert.match(source,/name="robots" content="index, follow"/);const data=JSON.parse(/<script type="application\/ld\+json">([^]*?)<\/script>/.exec(source)?.[1]??'null');assert.equal(data['@type'],'TechArticle');assert.equal(data.url,entry.url);assert.ok(data.headline);assert.ok(data.description);assert.equal(data.dateModified,undefined);assert.equal(data.datePublished,undefined);assert.equal(data.author,undefined);assert.ok(data.citation.length>=2);}
    for(const path of publicRoutes)assert.match(html(canonical,path),/name="robots" content="index, follow"/);
    for(const path of ['/search/','/contribute/','/404.html']){const source=html(canonical,path);assert.match(source,/name="robots" content="noindex, nofollow"/);assert.doesNotMatch(source,/rel="canonical"|application\/ld\+json/);}
    const headers=readFileSync(join(canonical,'_headers'),'utf8');assert.doesNotMatch(headers.split('\n\n')[0],/X-Robots-Tag/);assert.match(headers,/\/admin\*\n  X-Robots-Tag: noindex, nofollow/);assert.match(headers,/\/search\*\n  X-Robots-Tag: noindex, nofollow/);assert.match(readFileSync(join(canonical,'robots.txt'),'utf8'),/Sitemap: https:\/\/agenticbible.si\/sitemap.xml/);assert.doesNotMatch(xml,/staging|admin|search|contribute|fixtures|wiki-snapshots|local-publications|history|review/);
    const staging=await build('staging',{});assert.equal(manifest(staging).entries.length,0);assert.equal(existsSync(join(staging,'sitemap.xml')),false);assert.match(html(staging,'/articles/tool-use/'),/rel="canonical" href="https:\/\/staging.agenticbible.si\/articles\/tool-use\//);assert.match(html(staging,'/articles/tool-use/'),/noindex, nofollow/);assert.doesNotMatch(html(staging,'/articles/tool-use/'),/application\/ld\+json/);assert.match(readFileSync(join(staging,'_headers'),'utf8'),/X-Robots-Tag: noindex, nofollow/);assert.doesNotMatch(readFileSync(join(staging,'robots.txt'),'utf8'),/Disallow:|Sitemap:/);
    assert.equal(spawnSync(process.execPath,['scripts/assert-staging-discovery.mjs',staging]).status,0);assert.equal(spawnSync(process.execPath,['scripts/assert-staging-discovery.mjs',canonical]).status,1);
    await serve(canonical,true);await serve(staging,false);
    const synthetic=await build('synthetic',{AGENTIC_BIBLE_DISCOVERY_MODE:'production',AGENTIC_BIBLE_CANONICAL_ORIGIN:'https://agenticbible.si',AGENTIC_BIBLE_LOCAL_WIKI_BUILD:'1'});assert.equal(manifest(synthetic).mode,'synthetic');assert.deepEqual(manifest(synthetic).entries,[]);assert.equal(existsSync(join(synthetic,'sitemap.xml')),false);assert.match(html(synthetic,'/articles/tool-use/'),/noindex, nofollow/);
    const path=join(root,'src/content/articles/tool-use.md');writeFileSync(path,readFileSync(path,'utf8').replace('status: Working draft','status: Published local demonstration').replace('author: AI-assisted project draft','author: Supplied local demonstration'));
    const mixed=await build('mixed',{AGENTIC_BIBLE_DISCOVERY_MODE:'production',AGENTIC_BIBLE_CANONICAL_ORIGIN:'https://agenticbible.si'});assert.deepEqual(manifest(mixed).entries.map(e=>e.articleId),[...articleIds].filter(id=>id!=='tool-use').sort());assert.doesNotMatch(readFileSync(join(mixed,'sitemap.xml'),'utf8'),/tool-use/);assert.doesNotMatch(html(mixed,'/articles/tool-use/'),/rel="canonical"|application\/ld\+json/);assert.match(html(mixed,'/articles/tool-use/'),/noindex, nofollow/);assert.match(readFileSync(join(mixed,'_headers'),'utf8'),/\/articles\/tool-use\/\*\n  X-Robots-Tag: noindex, nofollow/);
    assert.deepEqual(inventory('src/content/articles'),original);assert.deepEqual(inventory('dist'),dist);
  }finally{rmSync(scratch,{recursive:true,force:true});}
});

test('actual cold-cache SEO Wrangler CLI denies external networking and skips metadata only with explicit isolation',{timeout:45000},async()=>{await verifySeoCliIsolation();});
