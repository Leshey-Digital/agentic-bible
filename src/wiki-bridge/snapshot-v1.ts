import {reject} from './limits.ts';

// Persisted V1 layout contract. Do not import today's reading registry, content schema,
// or monitoring validator here: those evolve independently of already sealed artifacts.
export const snapshotV1CatalogBytes=32768;
const core=['ai-agent','tool-use','model-context-protocol'];
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const articleId=(value:unknown):value is string=>typeof value==='string'&&value.length<=50&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)&&!['constructor','prototype'].includes(value);
export function snapshotV1ArticlePages(value:unknown,files:Record<string,unknown>):string[]{
  if(!object(value)||value.version!==1||!Array.isArray(value.articles)||value.articles.length<3||value.articles.length>20||!Array.isArray(value.sources)||!value.sources.length||value.sources.length>128)reject('site_corrupt');
  const ids:string[]=[];
  for(const article of value.articles){
    if(!object(article)||!articleId(article.id)||typeof article.title!=='string'||article.title.length>100)reject('site_corrupt');
    ids.push(article.id);
  }
  if(new Set(ids).size!==ids.length||core.some(id=>!ids.includes(id)))reject('site_corrupt');
  const expected=ids.map(id=>`articles/${id}/index.html`).sort();
  const actual=Object.keys(files).filter(path=>/^articles\/[^/]+\/index\.html$/.test(path)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))reject('site_corrupt');
  // Source metadata is immutable, hash-bound display data. Its live admission/host
  // policy is enforced by the writer, never reinterpreted to execute a historical URL.
  return expected;
}
