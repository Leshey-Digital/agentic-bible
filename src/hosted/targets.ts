import {readingArticleIds} from '../lib/article-ids.ts';
export type HostedArticleId=typeof readingArticleIds[number];
export function hostedTarget(value:unknown):{articleId:HostedArticleId;contentPath:string}|null{
  return typeof value==='string'&&(readingArticleIds as readonly string[]).includes(value)?{articleId:value as HostedArticleId,contentPath:'src/content/articles/'+value+'.md'}:null;
}
// Parse only the bounded existing source-declaration subset; arbitrary YAML or
// request fields cannot expand citation authority. Full build validation remains.
export function sourceCitations(markdown:string):string[]{
  const front=/^---\n([^]*?)\n---\n/.exec(markdown)?.[1];
  if(!front||front.split('\n').filter(line=>line==='sources:').length!==1||front.split('\n').filter(line=>line.startsWith('title: ')).length!==1)throw Error('unsupported_github_baseline');
  const sourceBlock=front.slice(front.indexOf('\nsources:')+10);if(/\n[^ \n]/.test(sourceBlock))throw Error('unsupported_github_baseline');
  const ids=[...sourceBlock.matchAll(/^  - id: ([a-z0-9][a-z0-9-]{0,63})$/gm)].map(match=>match[1]);
  if(ids.length<1||ids.length>16||new Set(ids).size!==ids.length)throw Error('unsupported_github_baseline');return ids;
}
