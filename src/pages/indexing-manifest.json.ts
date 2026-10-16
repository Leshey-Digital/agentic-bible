import {getCollection} from 'astro:content';
import {indexingManifest} from '../seo/articles.ts';
import {discoveryPolicy} from '../seo/policy.ts';
export async function GET(){return Response.json(await indexingManifest(await getCollection('articles'),discoveryPolicy()));}
