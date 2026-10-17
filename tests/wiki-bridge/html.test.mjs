import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rebasePublisherLinks,pinWikiLinks} from '../../src/wiki-bridge/html.ts';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {git} from './helpers.mjs';
test('only real href/src attributes rebase; prose, code, raw bodies, comments and other attributes retain bytes',()=>{
  const base='/local-publications/releases/'+'a'.repeat(64)+'/',literal='fetch("/local-publications/") href="/local-publications/"';
  const input=`<p>The literal path /local-publications/ stays.</p><pre><code>${literal}</code></pre><p>https://example.org/local-publications/ #source-openai</p><!-- <a href="/local-publications/comment/"> -->`+
    `<div data-code='href="/local-publications/"'><a href="${base}articles/tool-use/">Read</a><a href='/local-publications/history/'>History</a><img src=${base}assets/icon.svg><a href="https://example.org/local-publications/">External</a><a href="#source-openai">Source</a></div>`+
    `<script src="${base}assets/preview.js">const code='<a href="/local-publications/">'; ${literal}</script><style>.example{content:'href="/local-publications/"'}</style><textarea>${literal}</textarea>`;
  const expected=input.replace(`href="${base}articles/tool-use/"`,'href="/articles/tool-use/"').replace("href='/local-publications/history/'","href='/history/'").replace(`src=${base}assets/icon.svg`,'src=/assets/icon.svg').replace(`src="${base}assets/preview.js"`,'src="/assets/preview.js"');
  assert.equal(rebasePublisherLinks(input,base),expected);
  const pinned=pinWikiLinks(expected,'/wiki-snapshots/test/');assert.ok(pinned.includes(`<pre><code>${literal}</code></pre>`));assert.ok(pinned.includes(`<textarea>${literal}</textarea>`));assert.ok(pinned.includes(`data-code='href="/local-publications/"'`));assert.ok(pinned.includes('href="/wiki-snapshots/test/articles/tool-use/"'));assert.ok(pinned.includes('href="https://example.org/local-publications/"'));assert.ok(pinned.includes('href="#source-openai"'));assert.ok(pinned.includes('src="/wiki-snapshots/test/assets/preview.js"'));
});
test('a child with a mismatched expected parent refuses work before creating output',()=>{
  const root=mkdtempSync(join(git,'wiki-bridge-test-child-guard-')),plan=join(root,'plan.json'),output=join(root,'output');writeFileSync(plan,JSON.stringify({siteId:'a'.repeat(64),publisherFiles:{},proofs:[]}));
  try{const marker=join(root,'heavy-import.txt');const result=spawnSync(process.execPath,['--import',new URL('./guard-import-probe.mjs',import.meta.url).href,'scripts/wiki-bridge-build.mjs',join(root,'project'),output,plan,String(process.pid+1)],{timeout:5000,stdio:'ignore',env:{...process.env,WIKI_GUARD_IMPORT_MARKER:marker}});assert.equal(result.status,3);assert.equal(existsSync(marker),false,'invalid owner must reject before resolving Astro or Pagefind');assert.equal(existsSync(output),false);const missing=spawnSync(process.execPath,['--import',new URL('./guard-import-probe.mjs',import.meta.url).href,'scripts/wiki-bridge-build.mjs','','','',String(process.pid)],{timeout:5000,stdio:'ignore',env:{...process.env,WIKI_GUARD_IMPORT_MARKER:marker}});assert.equal(missing.status,3);assert.equal(existsSync(marker),false,'invalid arguments must reject before heavy imports');}finally{rmSync(root,{recursive:true,force:true});}
});
