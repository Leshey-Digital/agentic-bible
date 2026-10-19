import { getCollection } from 'astro:content';
import { buildCatalog } from '../monitoring/catalog';
import {readingArticleIds} from '../lib/article-ids.ts';

export async function GET() {
  const allow=new Set(readingArticleIds),articles=(await getCollection('articles')).filter(article=>allow.has(article.id as typeof readingArticleIds[number]));
  return Response.json(await buildCatalog(articles));
}
