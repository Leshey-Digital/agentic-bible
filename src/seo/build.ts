import type {AstroIntegration} from 'astro';
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {discoveryPolicy,robots,privateHeaderPaths,publicRoutes,type DiscoveryPolicy} from './policy.ts';
import {checkedManifest} from './articles.ts';
export function discoveryIntegration(policy:DiscoveryPolicy=discoveryPolicy()):AstroIntegration{
  return {name:'bounded-discovery-artifacts',hooks:{'astro:build:done':({dir})=>{
    const output=fileURLToPath(dir),manifest=checkedManifest(JSON.parse(readFileSync(join(output,'indexing-manifest.json'),'utf8')));
    if(manifest.mode!==policy.mode||manifest.origin!==policy.origin)throw new Error('discovery_build_mismatch');
    writeFileSync(join(output,'robots.txt'),robots(policy));
    if(policy.mode==='canonical'){
      const paths=[...publicRoutes,...manifest.entries.map(entry=>`/articles/${entry.articleId}/`)];
      const urls=paths.map(path=>`  <url><loc>${policy.origin}${path}</loc></url>`).join('\n');
      writeFileSync(join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
      let headers=readFileSync(join(output,'_headers'),'utf8').replace(/^  X-Robots-Tag:.*\n/gm,'');
      for(const path of privateHeaderPaths)headers+=`\n${path}\n  X-Robots-Tag: noindex, nofollow\n`;
      const indexed=new Set(manifest.entries.map(entry=>entry.articleId));
      for(const id of readdirSync(join(output,'articles')).filter(name=>/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))){
        if(existsSync(join(output,'articles',id,'index.html'))&&!indexed.has(id))headers+=`\n/articles/${id}/*\n  X-Robots-Tag: noindex, nofollow\n`;
      }
      writeFileSync(join(output,'_headers'),headers);
    }
  }}};
}
