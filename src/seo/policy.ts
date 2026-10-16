export const articleIds=['ai-agent','tool-use','model-context-protocol'] as const;
export const publicRoutes=['/','/about/','/topics/','/topics/foundations/','/topics/capabilities/','/topics/protocols/',...articleIds.map(id=>`/articles/${id}/`)];
export type DiscoveryPolicy={mode:'staging'|'canonical'|'synthetic';origin:string};
export function canonicalOrigin(value:unknown):string{
  if(typeof value!=='string')throw new Error('canonical_origin_required');
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='agenticbible.si'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||value!==url.origin)throw new Error('invalid_canonical_origin');
  return url.origin;
}
export function discoveryPolicy(env:Record<string,string|undefined>=process.env):DiscoveryPolicy{
  if(env.AGENTIC_BIBLE_LOCAL_WIKI_BUILD==='1')return {mode:'synthetic',origin:'https://staging.agenticbible.si'};
  const mode=env.AGENTIC_BIBLE_DISCOVERY_MODE??'staging';
  if(mode==='staging')return {mode,origin:'https://staging.agenticbible.si'};
  if(mode!=='production')throw new Error('invalid_discovery_mode');
  return {mode:'canonical',origin:canonicalOrigin(env.AGENTIC_BIBLE_CANONICAL_ORIGIN)};
}
export function pageDiscovery(policy:DiscoveryPolicy,path:string,synthetic=false){
  const publicPage=publicRoutes.includes(path)&&!synthetic;
  return {canonical:publicPage?new URL(path,policy.origin).href:null,indexable:policy.mode==='canonical'&&publicPage};
}
export const robots=(policy:DiscoveryPolicy)=>`User-agent: *\nAllow: /\n${policy.mode==='canonical'?`Sitemap: ${policy.origin}/sitemap.xml\n`:''}`;
// Crawlers must be able to read noindex; robots.txt is never an authentication boundary.
export const privateHeaderPaths=['/admin*','/api*','/contribute*','/search*','/404*','/history*','/review*','/local-publications*','/wiki-snapshots*','/fixtures*','/indexing-manifest.json','/source-catalog.json'];
