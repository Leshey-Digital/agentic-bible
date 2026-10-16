import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryPolicy,pageDiscovery,robots} from '../../src/seo/policy.ts';
import {articleStructuredData,eligibleArticle,indexingManifest,jsonLd,checkedManifest,type SeoArticle} from '../../src/seo/articles.ts';
const article:SeoArticle={id:'tool-use',body:'Actual original body.',data:{title:'Actual title </script><script>alert(1)</script>',description:'Actual description',topic:'Capabilities',status:'Working draft',author:'AI-assisted project draft',sources:[{url:'https://developers.openai.com/api/docs/guides/function-calling'}]}};
test('canonical origin is explicit, project-scoped and fail-closed; local synthetic overrides canonical mode',()=>{
  assert.equal(discoveryPolicy({}).mode,'staging');
  for(const origin of [undefined,'https://evil.example','https://staging.agenticbible.si','http://agenticbible.si','https://agenticbible.si/','https://agenticbible.si/path','https://user@agenticbible.si','https://agenticbible.si?token=x','https://agenticbible.si:8443'])assert.throws(()=>discoveryPolicy({AGENTIC_BIBLE_DISCOVERY_MODE:'canonical',AGENTIC_BIBLE_CANONICAL_ORIGIN:origin}));
  assert.throws(()=>discoveryPolicy({AGENTIC_BIBLE_DISCOVERY_MODE:'production'}));
  for(const origin of ['https://agenticbible.si','https://www.agenticbible.si'])assert.deepEqual(discoveryPolicy({AGENTIC_BIBLE_DISCOVERY_MODE:'canonical',AGENTIC_BIBLE_CANONICAL_ORIGIN:origin}),{mode:'canonical',origin});
  assert.equal(discoveryPolicy({AGENTIC_BIBLE_DISCOVERY_MODE:'canonical',AGENTIC_BIBLE_CANONICAL_ORIGIN:'https://agenticbible.si',AGENTIC_BIBLE_LOCAL_WIKI_BUILD:'1'}).mode,'synthetic');
});
test('private/query/snapshot/fixture paths never gain a canonical or indexing permission',()=>{
  const policy={mode:'canonical' as const,origin:'https://agenticbible.si'};
  for(const path of ['/admin/','/api/admin/settings','/search/','/contribute/','/404.html','/history/','/review/','/wiki-snapshots/abc/articles/tool-use/','/fixtures/tool-use/','/articles/fixture-agent-loop/','/articles/tool-use/?secret=1','/articles/tool-use/#local'])assert.deepEqual(pageDiscovery(policy,path),{canonical:null,indexable:false});
  assert.deepEqual(pageDiscovery(policy,'/articles/tool-use/'),{canonical:'https://agenticbible.si/articles/tool-use/',indexable:true});
  assert.equal(pageDiscovery(policy,'/articles/tool-use/',true).canonical,null);
  assert.doesNotMatch(robots(discoveryPolicy({})),/Disallow:|Sitemap:/);assert.match(robots(policy),/Sitemap: https:\/\/agenticbible.si\/sitemap.xml/);
});
test('structured data reflects actual metadata, safely escapes JSON-LD and invents no author/date/image',async()=>{
  const policy={mode:'canonical' as const,origin:'https://agenticbible.si'},data=articleStructuredData(article,policy)!;
  assert.equal(data.headline,article.data.title);assert.equal(data.description,article.data.description);assert.deepEqual(data.citation,article.data.sources.map(s=>s.url));
  for(const key of ['author','datePublished','dateModified','image','reviewedBy','license'])assert.ok(!(key in data));
  const text=jsonLd(data);assert.doesNotMatch(text,/<script|<\/script|[<>&]/);assert.deepEqual(JSON.parse(text),data);
  assert.equal(articleStructuredData(article,discoveryPolicy({})),null);
  const synthetic=structuredClone(article);synthetic.data.publication={revisionId:'a'.repeat(64)};assert.equal(eligibleArticle(synthetic),false);assert.equal(articleStructuredData(synthetic,policy),null);
  const first=await indexingManifest([article,synthetic],policy);assert.equal(first.entries.length,1);assert.equal(checkedManifest(first),first);
  assert.deepEqual(await indexingManifest([article],policy),first);
  const changed=structuredClone(article);changed.body+=' Updated.';assert.notEqual((await indexingManifest([changed],policy)).entries[0].revision,first.entries[0].revision);
  assert.equal((await indexingManifest([article],discoveryPolicy({}))).entries.length,0);
  for(const url of ['https://agenticbible.si/admin/','https://staging.agenticbible.si/articles/tool-use/','https://agenticbible.si/wiki-snapshots/abc/articles/tool-use/'])assert.throws(()=>checkedManifest({...first,entries:[{...first.entries[0],url}]}));
});
