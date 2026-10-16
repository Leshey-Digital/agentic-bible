import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync,lstatSync,readdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
import {canonical,qualityFlags} from '../publishing/contracts.ts';
import {escape} from '../publishing/render.ts';
import type {PublicationStore} from '../publishing/store.ts';
import type {Reference,Article} from '../publishing/contracts.ts';
import type {Binding} from './contracts.ts';
import {bounded,inventory,walk,write} from './files.ts';
import {reject,bridgeLimits} from './limits.ts';
import {pinWikiLinks} from './html.ts';

function markdown(article:Article,publisher:Reference,bindings:Binding[]){
  const text=(value:string)=>escape(value.replace(/[\\`*_[\]{}()#+.!|>~-]/g,'\\$&'));
  const front={title:article.title,description:article.description,topic:article.topic,order:2,status:'Published local demonstration',verified:article.verified,author:'Supplied local demonstration',related:article.related,sources:article.sources,publication:{revisionId:'',publisherSnapshot:publisher.id,flags:article.concerns,evidence:bindings.map(b=>({citationId:b.citationId,sourceId:b.sourceId,url:b.url,hash:b.bodyHash,receiptKey:b.receiptKey}))}};
  const body=article.blocks.map(block=>block.type==='heading'?`## ${text(block.text)}`:block.content.map(part=>part.type==='text'?text(part.text):part.type==='citation'?` [${article.sources.findIndex(s=>s.id===part.sourceId)+1}](#source-${part.sourceId}) `:` [${text(part.label)}](/articles/${part.articleId}/) `).join('')).join('\n\n');
  return {front,body};
}
export async function buildWiki(options:{repo:string;captureRoot:string;capture:{eventId:string;jobId:string;attempt:number};project:Record<string,Buffer>;output:string;siteId:string;publisher:PublicationStore;reference:Reference;bindings:Binding[];proofs:{eventId:string;revisionId:string;bindings:Binding[]}[];started?:()=>void|Promise<void>}){
  const pinned=options.publisher.load(options.reference);const revision=pinned.state.articles['tool-use'];
  if(Object.keys(pinned.state.articles).some(id=>id!=='tool-use'))reject('unsupported_publisher_snapshot');
  mkdirSync(options.captureRoot,{recursive:true});const scratch=mkdtempSync(join(options.captureRoot,`capture-${options.capture.jobId}-${options.capture.attempt}-`));write(join(scratch,'capture.json'),canonical({schemaVersion:1,...options.capture,siteId:options.siteId}));const project=join(scratch,'project');const built=join(project,'dist');mkdirSync(project);
  const captureSize=(dir:string):number=>{let names:string[];try{names=readdirSync(dir);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return 0;throw error;}return names.reduce((total,name)=>{const path=join(dir,name),stat=lstatSync(path,{throwIfNoEntry:false});if(!stat)return total;if(path===join(project,'node_modules')&&stat.isSymbolicLink())return total;if(stat.isSymbolicLink()||!stat.isDirectory()&&!stat.isFile())reject('unsafe_capture');return total+(stat.isDirectory()?captureSize(path):stat.size);},0);};
  let child:ReturnType<typeof spawn>|undefined;
  try{
    for(const [path,value]of Object.entries(options.project))write(join(project,path),value);
    if(revision){const article=options.publisher.revision(revision);const {front,body}=markdown(article,options.reference,options.bindings);front.publication.revisionId=revision;front.publication.flags=qualityFlags(article);writeFileSync(join(project,'src/content/articles/tool-use.md'),'---\n'+Object.entries(front).map(([key,value])=>key+': '+JSON.stringify(value)).join('\n')+'\n---\n\n'+body+'\n');}
    symlinkSync(resolve(options.repo,'node_modules'),join(project,'node_modules'),'dir');
    const publisherFiles:Record<string,string>={};for(const path of Object.keys(pinned.files)){if(path.startsWith('history/')||path==='review/index.html'||path.startsWith('assets/'))publisherFiles[path]=bounded(join(options.publisher.root,'releases',options.reference.id,path),16*1024*1024).toString('base64');}
    const plan=join(scratch,'plan.json'),planBytes=canonical({siteId:options.siteId,publisherFiles,proofs:options.proofs,publisherBase:`/local-publications/releases/${options.reference.id}/`});if(Buffer.byteLength(planBytes)>bridgeLimits.projectBytes)reject('capture_plan_too_large');writeFileSync(plan,planBytes);
    await new Promise<void>((done,failed)=>{
      child=spawn(process.execPath,[join(project,'scripts/wiki-bridge-build.mjs'),project,built,plan,String(process.pid)],{cwd:project,env:{PATH:process.env.PATH??'',ASTRO_TELEMETRY_DISABLED:'1',AGENTIC_BIBLE_LOCAL_WIKI_BUILD:'1'},stdio:'ignore'});
      const monitor=setInterval(()=>{try{if(captureSize(scratch)>bridgeLimits.captureBytes){child!.kill('SIGKILL');clearInterval(monitor);failed(new Error('capture capacity'));}}catch{child!.kill('SIGKILL');clearInterval(monitor);failed(new Error('capture accounting'));}},100);
      const timer=setTimeout(()=>{child!.kill('SIGKILL');clearInterval(monitor);failed(new Error('deadline'));},45000);
      child.once('error',()=>{clearTimeout(timer);clearInterval(monitor);failed(new Error('spawn'));});child.once('exit',code=>{clearTimeout(timer);clearInterval(monitor);code===0?done():failed(new Error('build'));});
      void Promise.resolve(options.started?.()).catch(()=>{child!.kill('SIGKILL');failed(new Error('checkpoint'));});
    });
    if(captureSize(scratch)>bridgeLimits.captureBytes)reject('capture_capacity');
    // Astro keeps static prerender intermediates within cwd when outDir is external.
    // Complete the build inside its private project, then bounded-copy across filesystems.
    for(const path of Object.keys(inventory(built)))write(join(options.output,path),bounded(join(built,path),16*1024*1024));
    // Pin every internal navigation/asset link to this immutable full-site snapshot.
    const base=`/wiki-snapshots/${options.siteId}/`;
    for(const path of walk(options.output).filter(path=>path.endsWith('.html'))){let html=readFileSync(path,'utf8');html=pinWikiLinks(html,base).replace('<body','<body data-wiki-snapshot-base="'+base+'"');writeFileSync(path,html);}
    const catalog=JSON.parse(readFileSync(join(options.output,'source-catalog.json'),'utf8'));if(catalog.articles.length!==3||!catalog.articles.some((a:{id:string})=>a.id==='tool-use'))reject('incomplete_wiki_catalog');
    const files=inventory(options.output);for(const path of ['index.html','topics/capabilities/index.html','source-catalog.json','history/index.html','review/index.html','articles/tool-use/index.html','articles/ai-agent/index.html','articles/model-context-protocol/index.html','pagefind/pagefind.js'])if(!files[path])reject('incomplete_wiki_artifact');
    return files;
  }catch{return reject('full_wiki_build_failed');}finally{if(child?.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');if(!child||child.exitCode===0)rmSync(scratch,{recursive:true,force:true});}
}
