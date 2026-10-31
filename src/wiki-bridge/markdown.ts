import {readingArticleIds} from '../lib/article-ids.ts';
import type {Article,Reference} from '../publishing/contracts.ts';
import type {Binding} from './contracts.ts';
export function publicationMarkdown(article:Article,publisher:Reference,bindings:Binding[],citationOrder=article.sources.map(s=>s.id)){
  // Entity-encode plain-text punctuation before Markdown parsing. Backslash
  // escapes can leak into GFM URL recognition; entities preserve literal text
  // while the explicit citation and internal-link syntax below stays functional.
  const text=(value:string)=>value.replace(/[!-/:-@\[-`{-~]/g,char=>'&#'+char.charCodeAt(0)+';');
  const front={title:article.title,description:article.description,topic:article.topic,order:readingArticleIds.indexOf(article.id as any)+1,status:'Published local demonstration',verified:article.verified,author:'Supplied local demonstration',related:article.related,sources:article.sources,publication:{revisionId:'',publisherSnapshot:publisher.id,flags:article.concerns,evidence:bindings.map(b=>({citationId:b.citationId,sourceId:b.sourceId,url:b.url,hash:b.bodyHash,receiptKey:b.receiptKey}))}};
  const body=article.blocks.map(block=>block.type==='heading'?`## ${text(block.text)}`:block.content.map(part=>part.type==='text'?text(part.text):part.type==='citation'?` [${citationOrder.indexOf(part.sourceId)+1}](#source-${part.sourceId}) `:` [${text(part.label)}](/articles/${part.articleId}/) `).join('')).join('\n\n');
  return {front,body};
}
