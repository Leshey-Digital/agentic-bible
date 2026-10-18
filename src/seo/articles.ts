import {digest} from '../editorial/validation.ts';
import {articleIds,type DiscoveryPolicy} from './policy.ts';
export type SeoArticle={id:string;body?:string;data:{title:string;description:string;topic:string;status:string;author:string;publication?:unknown;sources:{url:string}[]}};
export type IndexingManifest={schemaVersion:1;mode:DiscoveryPolicy['mode'];origin:string;entries:{articleId:string;url:string;revision:string}[]};
export const eligibleArticle=(article:SeoArticle)=>articleIds.includes(article.id as typeof articleIds[number])&&article.data.publication===undefined&&article.data.status==='Working draft'&&article.data.author==='AI-assisted project draft';
export function articleStructuredData(article:SeoArticle,policy:DiscoveryPolicy){
  if(policy.mode!=='canonical'||!eligibleArticle(article))return null;
  const url=`${policy.origin}/articles/${article.id}/`;
  return {'@context':'https://schema.org','@type':'TechArticle',headline:article.data.title,description:article.data.description,articleSection:article.data.topic,inLanguage:'en',url,mainEntityOfPage:{'@type':'WebPage','@id':url},citation:article.data.sources.map(source=>source.url)};
}
export const jsonLd=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function indexingManifest(articles:SeoArticle[],policy:DiscoveryPolicy):Promise<IndexingManifest>{
  const entries=[];
  if(policy.mode==='canonical')for(const article of [...articles].sort((a,b)=>a.id.localeCompare(b.id,'en'))){
    if(!eligibleArticle(article))continue;
    // Full actual body and metadata, not a source-check date or a fabricated publish timestamp.
    entries.push({articleId:article.id,url:`${policy.origin}/articles/${article.id}/`,revision:await digest(JSON.stringify({body:article.body??'',data:article.data}))});
  }
  return {schemaVersion:1,mode:policy.mode,origin:policy.origin,entries};
}
export function checkedManifest(value:unknown):IndexingManifest{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_indexing_manifest');
  const m=value as IndexingManifest;
  if(Object.keys(m).sort().join(',')!=='entries,mode,origin,schemaVersion'||m.schemaVersion!==1||!['staging','canonical','synthetic'].includes(m.mode)||!Array.isArray(m.entries)||m.entries.length>articleIds.length)throw new Error('invalid_indexing_manifest');
  if(m.mode!=='canonical'){if(m.origin!=='https://staging.agenticbible.si'||m.entries.length)throw new Error('invalid_indexing_manifest');return m;}
  if(m.origin!=='https://agenticbible.si')throw new Error('invalid_indexing_manifest');
  const seen=new Set();for(const e of m.entries){
    if(!e||Object.keys(e).sort().join(',')!=='articleId,revision,url'||!articleIds.includes(e.articleId as typeof articleIds[number])||e.url!==`${m.origin}/articles/${e.articleId}/`||typeof e.revision!=='string'||!/^[a-f0-9]{64}$/.test(e.revision)||seen.has(e.articleId))throw new Error('invalid_indexing_manifest');seen.add(e.articleId);
  }
  return m;
}
