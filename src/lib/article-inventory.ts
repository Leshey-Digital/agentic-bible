export const readerArticleLimit=50_000;
export const articleSlugPattern=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const safeArticleSlug=(value:unknown):value is string=>typeof value==='string'&&value.length<=50&&articleSlugPattern.test(value)&&!['constructor','prototype','__proto__'].includes(value);

type ReaderArticle={id:string;data:{order:number;related:string[];sources:{id:string}[]}};
export function checkedReaderInventory<T extends ReaderArticle>(articles:readonly T[]):T[]{
  if(!Array.isArray(articles)||articles.length>readerArticleLimit)throw new Error('reader_inventory_capacity');
  const ids=new Set<string>(),orders=new Set<number>();
  for(const article of articles){
    if(!article||!safeArticleSlug(article.id))throw new Error('reader_article_slug_invalid');
    const route=`/articles/${article.id}/`;
    if(ids.has(article.id)||new URL(route,'https://agenticbible.si').pathname!==route)throw new Error('reader_article_path_collision');
    ids.add(article.id);
    if(!Number.isSafeInteger(article.data?.order)||article.data.order<1||orders.has(article.data.order))throw new Error('reader_article_order_collision');
    orders.add(article.data.order);
    if(!Array.isArray(article.data.related)||article.data.related.length<1||article.data.related.some((id:string)=>!safeArticleSlug(id))||new Set(article.data.related).size!==article.data.related.length||article.data.related.includes(article.id))throw new Error('reader_article_related_invalid');
    if(!Array.isArray(article.data.sources)||article.data.sources.length<1||article.data.sources.some((source:{id:string})=>!source||!safeArticleSlug(source.id))||new Set(article.data.sources.map((source:{id:string})=>source.id)).size!==article.data.sources.length)throw new Error('reader_article_source_id_invalid');
  }
  for(const article of articles)if(article.data.related.some((id:string)=>!ids.has(id)))throw new Error('reader_article_related_unresolved');
  return [...articles].sort((a,b)=>a.data.order-b.data.order);
}
