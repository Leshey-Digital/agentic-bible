import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,writeFileSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import type {AstroIntegration} from 'astro';
const sha256=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
export function articleSource(root:string,env:NodeJS.ProcessEnv=process.env){
  const empty={schemaVersion:1,repository:'Leshey-Digital/agentic-bible',commit:null,tree:null,articleHashes:{}};
  const requested=env.AGENTIC_BIBLE_SOURCE_COMMIT;
  if(env.AGENTIC_BIBLE_LOCAL_WIKI_BUILD==='1'||!existsSync(join(root,'.git'))){if(requested)throw Error('release_source_git_required');return empty;}
  const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{maxBuffer:1048576});
  if(resolve(git('rev-parse','--show-toplevel').toString().trim())!==resolve(root))throw Error('release_source_root');
  const commit=requested??git('rev-parse','HEAD').toString().trim();if(!/^[a-f0-9]{40}$/.test(commit)||git('rev-parse',commit+'^{commit}').toString().trim()!==commit)throw Error('release_source_commit');
  const articleHashes:Record<string,string>={};
  for(const name of readdirSync(join(root,'src/content/articles')).sort()){
    if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.md$/.test(name))throw Error('release_source_article_path');
    const path='src/content/articles/'+name;if(!lstatSync(join(root,path)).isFile()||!git('ls-tree',commit,'--',path).toString().startsWith('100644 blob '))throw Error('release_source_regular_blob_required');const current=readFileSync(join(root,path)),original=git('show',commit+':'+path);
    if(!current.equals(original))throw Error('release_source_article_changed');articleHashes[path]=sha256(current);
  }
  if(Object.keys(articleHashes).length<1||Object.keys(articleHashes).length>512)throw Error('release_source_article_capacity');
  return {schemaVersion:1,repository:empty.repository,commit,tree:git('rev-parse',commit+'^{tree}').toString().trim(),articleHashes};
}
export function sourceIntegration(source:ReturnType<typeof articleSource>):AstroIntegration{
  return {name:'commit-pinned-article-source',hooks:{'astro:config:setup':({updateConfig})=>{updateConfig({vite:{define:{'import.meta.env.PUBLIC_AGENTIC_BIBLE_SOURCE_COMMIT':JSON.stringify(source.commit)}}});},'astro:build:done':({dir})=>{writeFileSync(join(fileURLToPath(dir),'release-source.json'),JSON.stringify(source)+'\n');}}};
}
