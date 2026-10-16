import { getCollection } from 'astro:content';
import { buildCatalog } from '../monitoring/catalog';

export async function GET() {
  return Response.json(await buildCatalog(await getCollection('articles')));
}
