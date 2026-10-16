import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {checkedManifest} from '../src/seo/articles.ts';
try{
  const site=process.argv[2]??'dist',manifest=checkedManifest(JSON.parse(readFileSync(join(site,'indexing-manifest.json'),'utf8')));
  if(manifest.mode!=='staging'||manifest.origin!=='https://staging.agenticbible.si'||manifest.entries.length||existsSync(join(site,'sitemap.xml'))||!readFileSync(join(site,'_headers'),'utf8').startsWith('/*\n  X-Robots-Tag: noindex, nofollow\n'))throw Error('wrong artifact');
}catch{console.error('staging_discovery_artifact_required');process.exitCode=1;}
