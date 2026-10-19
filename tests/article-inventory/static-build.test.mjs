import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,relative,resolve,sep} from 'node:path';

const id='reader-inventory-regression';
const source=`---
title: Dynamic reader inventory regression
description: A schema-valid twenty-first reader article verifies static routes and discovery metadata.
topic: Foundations
order: 21
status: Working draft
verified: "2026-10-19"
author: AI-assisted project draft
related:
  - ai-agent
sources:
  - id: primary-source
    title: Official primary source
    url: https://developers.openai.com/api/docs/guides/function-calling
    publisher: OpenAI
    context: The official documentation used as a controlled source link for this build regression.
---

## A separate reader entry

This controlled fixture contains the unique phrase **quartz-boundary-reader-inventory** to confirm it is included in the locally generated Pagefind corpus.
`;

test('isolated canonical build includes a schema-valid twenty-first reader article in routes, history, Pagefind and sitemap',{timeout:180000},()=>{
  const project=resolve('.'),scratch=mkdtempSync(join(tmpdir(),'agentic-bible-reader-inventory-')),root=join(scratch,'project');
  try{
    cpSync(project,root,{recursive:true,filter:path=>{
      const rel=relative(project,path),first=rel.split(sep)[0];return !['.git','node_modules','dist','.astro','.wrangler','coverage'].includes(first);
    }});
    symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
    writeFileSync(join(root,'src/content/articles',id+'.md'),source);
    const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    git('init','--quiet','--initial-branch=reader-inventory-fixture');git('config','user.name','Reader Inventory Fixture');git('config','user.email','reader-inventory@example.test');git('add','-A');git('commit','--quiet','-m','isolated reader inventory fixture');
    const commit=git('rev-parse','HEAD').trim();
    execFileSync('npm',['run','build'],{cwd:root,stdio:'pipe',timeout:150000,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1',AGENTIC_BIBLE_DISCOVERY_MODE:'production',AGENTIC_BIBLE_CANONICAL_ORIGIN:'https://agenticbible.si',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false'}});
    const dist=join(root,'dist'),page=readFileSync(join(dist,'articles',id,'index.html'),'utf8');
    assert.match(page,/<h1[^>]*>Dynamic reader inventory regression<\/h1>/);
    assert.match(page,new RegExp(`rel="canonical" href="https://agenticbible\\.si/articles/${id}/"`));
    assert.match(page,/name="robots" content="index, follow"/);
    assert.match(page,/"@type":"TechArticle"/);assert.match(page,/quartz-boundary-reader-inventory/);
    assert.match(page,new RegExp(`data-source-commit="${commit}"`));
    assert.match(page,new RegExp(`${commit.slice(0,8)}<\\/code>`));
    const manifest=JSON.parse(readFileSync(join(dist,'indexing-manifest.json'),'utf8'));
    const entry=manifest.entries.find(value=>value.articleId===id);assert.ok(entry);assert.equal(entry.url,`https://agenticbible.si/articles/${id}/`);assert.match(entry.revision,/^[a-f0-9]{64}$/);
    assert.match(readFileSync(join(dist,'sitemap.xml'),'utf8'),new RegExp(`https://agenticbible\\.si/articles/${id}/`));
    assert.match(readFileSync(join(dist,'index.html'),'utf8'),/Dynamic reader inventory regression/);
    const pagefind=JSON.parse(readFileSync(join(dist,'pagefind/pagefind-entry.json'),'utf8'));assert.equal(pagefind.languages.en.page_count,21);
    const releaseSource=JSON.parse(readFileSync(join(dist,'release-source.json'),'utf8'));assert.equal(Object.keys(releaseSource.articleHashes).length,21);assert.equal(releaseSource.commit,commit);
    const headers=readFileSync(join(dist,'_headers'),'utf8');assert.doesNotMatch(headers,new RegExp(`\\n/articles/${id}/\\*\\n  X-Robots-Tag: noindex, nofollow`));
    assert.equal(git('status','--porcelain').trim(),'');

    const articlePath=join(root,'src/content/articles',id+'.md');
    writeFileSync(articlePath,source.replace('status: Working draft','status: Published local demonstration').replace('author: AI-assisted project draft','author: Supplied local demonstration'));
    git('add','-A');git('commit','--quiet','-m','mark reader inventory fixture as non-indexable');
    const privateOutput=join(root,'build-artifacts','canonical-non-eligible');
    execFileSync('npm',['run','build'],{cwd:root,stdio:'pipe',timeout:150000,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1',AGENTIC_BIBLE_DISCOVERY_MODE:'production',AGENTIC_BIBLE_CANONICAL_ORIGIN:'https://agenticbible.si',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',AGENTIC_BIBLE_SOURCE_COMMIT:git('rev-parse','HEAD').trim()}});
    const privatePage=readFileSync(join(root,'dist','articles',id,'index.html'),'utf8');
    assert.match(privatePage,/name="robots" content="noindex, nofollow"/);assert.doesNotMatch(privatePage,/rel="canonical"|application\/ld\+json/);
    assert.ok(!JSON.parse(readFileSync(join(root,'dist','indexing-manifest.json'),'utf8')).entries.some(value=>value.articleId===id));
    assert.doesNotMatch(readFileSync(join(root,'dist','sitemap.xml'),'utf8'),new RegExp(`https://agenticbible\\.si/articles/${id}/`));
    assert.match(readFileSync(join(root,'dist','_headers'),'utf8'),new RegExp(`\\n/articles/${id}/\\*\\n  X-Robots-Tag: noindex, nofollow`));
    assert.equal(git('status','--porcelain').trim(),'');
  }finally{rmSync(scratch,{recursive:true,force:true});}
});
