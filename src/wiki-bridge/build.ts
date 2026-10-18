import {childPhases,safeFailure} from './diagnostics.ts';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync,lstatSync,readdirSync,openSync,closeSync,fsyncSync,fstatSync,constants} from 'node:fs';
import {spawn} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
import {canonical,qualityFlags,hash as hashOriginal} from '../publishing/contracts.ts';
import {readingArticleIds} from '../lib/article-ids.ts';
import type {PublicationStore} from '../publishing/store.ts';
import type {Reference,Article} from '../publishing/contracts.ts';
import type {Binding} from './contracts.ts';
import {bounded,inventory,walk,write} from './files.ts';
import {reject,bridgeLimits,BridgeError} from './limits.ts';
import {pinWikiLinks} from './html.ts';

function markdown(article:Article,publisher:Reference,bindings:Binding[],citationOrder=article.sources.map(s=>s.id)){
  // Entity-encode plain-text punctuation before Markdown parsing. Backslash
  // escapes can leak into GFM URL recognition; entities preserve literal text
  // while the explicit citation and internal-link syntax below stays functional.
  const text=(value:string)=>value.replace(/[!-/:-@\[-`{-~]/g,char=>'&#'+char.charCodeAt(0)+';');
  const front={title:article.title,description:article.description,topic:article.topic,order:readingArticleIds.indexOf(article.id as any)+1,status:'Published local demonstration',verified:article.verified,author:'Supplied local demonstration',related:article.related,sources:article.sources,publication:{revisionId:'',publisherSnapshot:publisher.id,flags:article.concerns,evidence:bindings.map(b=>({citationId:b.citationId,sourceId:b.sourceId,url:b.url,hash:b.bodyHash,receiptKey:b.receiptKey}))}};
  const body=article.blocks.map(block=>block.type==='heading'?`## ${text(block.text)}`:block.content.map(part=>part.type==='text'?text(part.text):part.type==='citation'?` [${citationOrder.indexOf(part.sourceId)+1}](#source-${part.sourceId}) `:` [${text(part.label)}](/articles/${part.articleId}/) `).join('')).join('\n\n');
  return {front,body};
}
export async function buildWiki(options:{repo:string;captureRoot:string;capture:{eventId:string;jobId:string;attempt:number};project:Record<string,Buffer>;output:string;siteId:string;publisher:PublicationStore;reference:Reference;bindings:Binding[];proofs:{eventId:string;revisionId:string;bindings:Binding[]}[];started?:()=>void|Promise<void>}){
  const pinned=options.publisher.load(options.reference);const revision=pinned.state.articles['tool-use'];
  if(Object.keys(pinned.state.articles).some(id=>!readingArticleIds.includes(id as any)))reject('unsupported_publisher_snapshot');
  mkdirSync(options.captureRoot,{recursive:true});const scratch=mkdtempSync(join(options.captureRoot,`capture-${options.capture.jobId}-${options.capture.attempt}-`));write(join(scratch,'capture.json'),canonical({schemaVersion:1,...options.capture,siteId:options.siteId}));const project=join(scratch,'project');const built=join(project,'dist');mkdirSync(project);
  const captureSize=(dir:string):number=>{let names:string[];try{names=readdirSync(dir);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return 0;throw error;}return names.reduce((total,name)=>{const path=join(dir,name),stat=lstatSync(path,{throwIfNoEntry:false});if(!stat)return total;if(path===join(project,'node_modules')&&stat.isSymbolicLink())return total;if(stat.isSymbolicLink()||!stat.isDirectory()&&!stat.isFile())reject('unsafe_capture');return total+(stat.isDirectory()?captureSize(path):stat.size);},0);};
  let child:ReturnType<typeof spawn>|undefined;
  const diagnostic:{schemaVersion:number;phases:{phase:string;elapsedMs:number;error?:Record<string,unknown>}[];lastPhase?:string;stop?:string;exitCode?:number|null;signal?:string|null;stderrBytes:number;droppedStderrBytes:number;failure?:Record<string,unknown>}={schemaVersion:1,phases:[],stderrBytes:0,droppedStderrBytes:0};
  const diagnosticPath=join(dirname(options.captureRoot),'jobs',options.capture.jobId,`build-${options.capture.attempt}-diagnostics.json`);
  const persistDiagnostic=()=>{
    let fd:number|undefined;try{
      if(!/^[a-f0-9]{64}$/.test(options.capture.jobId)||![1,2,3].includes(options.capture.attempt))return;
      let cursor=dirname(options.captureRoot);for(const part of ['jobs',options.capture.jobId]){cursor=join(cursor,part);const stat=lstatSync(cursor,{throwIfNoEntry:false});if(stat&&(stat.isSymbolicLink()||!stat.isDirectory()))return;mkdirSync(cursor,{recursive:true});}
      const bytes=canonical(diagnostic);if(Buffer.byteLength(bytes)>8192)return;
      fd=openSync(diagnosticPath,constants.O_WRONLY|constants.O_CREAT|constants.O_TRUNC|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);if(!fstatSync(fd).isFile())return;writeFileSync(fd,bytes);fsyncSync(fd);
    }catch{/* Diagnostics cannot replace the publication error or grant success. */}finally{if(fd!==undefined)closeSync(fd);}
  };let stderr='';

  try{
    for(const [path,value]of Object.entries(options.project))write(join(project,path),value);
    for(const [articleId,articleRevision]of Object.entries(pinned.state.articles)){const article=options.publisher.revision(articleRevision);if(article.id!==articleId)reject('unsupported_publisher_snapshot');const path=join(project,'src/content/articles/'+articleId+'.md');const bindings=[...options.proofs].reverse().find(p=>p.revisionId===articleRevision)?.bindings;if(!bindings)reject('missing_article_build_proof');
      const baseline=readFileSync(path,'utf8'),parts=/^---\n([^]*?)\n---\n([^]*)$/.exec(baseline);
      const order=article.reviewedCorrections?[...parts![1].matchAll(/^  - id: (.+)$/gm)].map(m=>m[1]):undefined;
      const {front,body}=markdown(article,options.reference,bindings);front.publication.revisionId=articleRevision;front.publication.flags=qualityFlags(article);
      if(article.reviewedCorrections){
        if(!parts||order?.length!==3)reject('unsupported_correction_baseline');
        const corrected=markdown(article,options.reference,bindings,order).body;
        const publication={...front.publication,reviewedCorrections:article.reviewedCorrections};
        const meta=parts[1].replace(/^status: .+$/m,'status: Published local demonstration');
        writeFileSync(path,'---\n'+meta+'\npublication: '+JSON.stringify(publication)+'\n---\n'+parts[2]+'\n## Reviewed corrections\n\n'+corrected+'\n');
      }else writeFileSync(path,'---\n'+Object.entries(front).map(([key,value])=>key+': '+JSON.stringify(value)).join('\n')+'\n---\n\n'+body+'\n');
    }
    symlinkSync(resolve(options.repo,'node_modules'),join(project,'node_modules'),'dir');
    const publisherFiles:Record<string,string>={};for(const path of Object.keys(pinned.files)){if(path.startsWith('history/')||path==='review/index.html'||path.startsWith('assets/'))publisherFiles[path]=bounded(join(options.publisher.root,'releases',options.reference.id,path),16*1024*1024).toString('base64');}
    const reviewedHistory=(pinned.state.history['tool-use']??[]).some(id=>options.publisher.revision(id).reviewedCorrections);
    const correctionBaseline=reviewedHistory?{markdownHash:hashOriginal(options.project['src/content/articles/tool-use.md']),html:bounded(join(options.repo,'dist/articles/tool-use/index.html'),1024*1024).toString('base64')}:undefined;
    const plan=join(scratch,'plan.json'),planBytes=canonical({siteId:options.siteId,publisherFiles,proofs:options.proofs,...(correctionBaseline?{correctionBaseline}:{}),publisherBase:`/local-publications/releases/${options.reference.id}/`});if(Buffer.byteLength(planBytes)>bridgeLimits.projectBytes)reject('capture_plan_too_large');writeFileSync(plan,planBytes);
    await new Promise<void>((done,failed)=>{
      let settled=false;let monitor:ReturnType<typeof setInterval>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
      const finish=(reason?:string)=>{if(settled)return;settled=true;clearInterval(monitor);clearTimeout(timer);if(reason)diagnostic.stop=reason;persistDiagnostic();reason?failed(new Error('bounded child build failed')):done();};
      child=spawn(process.execPath,[join(project,'scripts/wiki-bridge-build.mjs'),project,built,plan,String(process.pid)],{cwd:project,env:{PATH:process.env.PATH??'',ASTRO_TELEMETRY_DISABLED:'1',AGENTIC_BIBLE_LOCAL_WIKI_BUILD:'1'},stdio:['ignore','ignore','pipe']});
      child.stderr?.on('data',chunk=>{
        if(settled)return;diagnostic.stderrBytes+=chunk.length;const remaining=Math.max(0,8192-Buffer.byteLength(stderr)),taken=Math.min(remaining,chunk.length);stderr+=chunk.subarray(0,taken).toString();diagnostic.droppedStderrBytes+=chunk.length-taken;
        for(;;){const end=stderr.indexOf('\n');if(end<0)break;const line=stderr.slice(0,end);stderr=stderr.slice(end+1);if(!line.startsWith('AB_WIKI_CHILD '))continue;
          try{const value=JSON.parse(line.slice(14));if(!childPhases.includes(value.phase)||!Number.isSafeInteger(value.elapsedMs)||value.elapsedMs<0||value.elapsedMs>60000||diagnostic.phases.length>=12)continue;
            const phase={phase:value.phase,elapsedMs:value.elapsedMs,...(value.error?{error:safeFailure(value.error)}:{})};diagnostic.phases.push(phase);diagnostic.lastPhase=phase.phase;persistDiagnostic();
          }catch{/* Discard non-structured child output; never retain raw stderr. */}
        }
      });
      monitor=setInterval(()=>{try{if(captureSize(scratch)>bridgeLimits.captureBytes){child!.kill('SIGKILL');finish('capture-capacity');}}catch{child!.kill('SIGKILL');finish('capture-accounting');}},100);
      timer=setTimeout(()=>{child!.kill('SIGKILL');finish('deadline');},45000);
      child.once('error',()=>finish('spawn'));
      // close follows complete stderr drainage; no late diagnostic writes after acceptance.
      child.once('close',(code,signal)=>{if(settled)return;diagnostic.exitCode=code;diagnostic.signal=signal;finish(code===0?undefined:'child-exit');});
      void Promise.resolve().then(()=>options.started?.()).catch(()=>{child!.kill('SIGKILL');finish('checkpoint');});
    });
    if(captureSize(scratch)>bridgeLimits.captureBytes)reject('capture_capacity');
    // Astro keeps static prerender intermediates within cwd when outDir is external.
    // Complete the build inside its private project, then bounded-copy across filesystems.
    for(const path of Object.keys(inventory(built)))write(join(options.output,path),bounded(join(built,path),16*1024*1024));
    if(reviewedHistory&&!revision){const path=join(options.output,'articles/tool-use/index.html');writeFileSync(path,readFileSync(path,'utf8').replace('</article>','<section class="revision" data-pagefind-ignore><h2>Retained correction history</h2><a href="/history/">Read reviewed correction history</a></section></article>'));}
    // Pin every internal navigation/asset link to this immutable full-site snapshot.
    const base=`/wiki-snapshots/${options.siteId}/`;
    for(const path of walk(options.output).filter(path=>path.endsWith('.html'))){let html=readFileSync(path,'utf8');html=pinWikiLinks(html,base).replace('<body','<body data-wiki-snapshot-base="'+base+'"');writeFileSync(path,html);}
    const catalog=JSON.parse(readFileSync(join(options.output,'source-catalog.json'),'utf8'));if(catalog.articles.length!==readingArticleIds.length||!readingArticleIds.every(id=>catalog.articles.some((a:{id:string})=>a.id===id)))reject('incomplete_wiki_catalog');
    const files=inventory(options.output);for(const path of ['index.html','topics/capabilities/index.html','source-catalog.json','history/index.html','review/index.html',...readingArticleIds.map(id=>`articles/${id}/index.html`),'pagefind/pagefind.js'])if(!files[path])reject('incomplete_wiki_artifact');
    return files;
  }catch(error){diagnostic.stop??='parent-build';diagnostic.failure=safeFailure(error);persistDiagnostic();throw Object.assign(new BridgeError('full_wiki_build_failed'),{diagnostics:{stop:diagnostic.stop,lastPhase:diagnostic.lastPhase}});}finally{if(child?.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');if(!child||child.exitCode===0)rmSync(scratch,{recursive:true,force:true});}
}

// Pure bounded serializer shared with the default-closed canonical maintenance writer.
export {markdown as publicationMarkdown};
