// Private child of the bridge command. No network source fetch or package installation.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
const [project,output,planPath,ownerPid]=process.argv.slice(2);const started=performance.now();
const report=(phase,extra={})=>process.stderr.write('AB_WIKI_CHILD '+JSON.stringify({phase,elapsedMs:Math.round(performance.now()-started),...extra})+'\n');
const owner=Number(ownerPid);if(process.argv.slice(2).length!==4||![project,output,planPath].every(value=>typeof value==='string'&&value.length>0&&!value.includes('\0'))||!Number.isSafeInteger(owner)||owner<2||process.ppid!==owner)process.exit(3);
report('owner-checked');
const guard=setInterval(()=>{if(process.ppid!==owner){report('owner-lost');process.exit(3);}try{process.kill(owner,0);}catch{report('owner-lost');process.exit(3);}},100);guard.unref();
const deadline=setTimeout(()=>{report('deadline');process.exit(3);},45000);deadline.unref();
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let close=async()=>{};let summarize=()=>({type:'UnknownError',code:'unclassified'});
try{
  const [{build},{createIndex,close:finish},{rebasePublisherLinks},{readingArticleIds},{safeFailure}]=await Promise.all([import('astro'),import('pagefind'),import('../src/wiki-bridge/html.ts'),import('../src/lib/article-ids.ts'),import('../src/wiki-bridge/diagnostics.ts')]);close=finish;summarize=safeFailure;report('imports-ready');
  const plan=JSON.parse(readFileSync(planPath,'utf8'));report('plan-read');
  await build({root:project,outDir:output,cacheDir:join(project,'.astro'),vite:{cacheDir:join(project,'.vite')},logLevel:'silent'});report('astro-complete');
  // Reviewed notes retain the complete original article in current and historical output.
  // The local baseline archive is accepted only when its prose is byte-equivalent to
  // this isolated build's unmodified prefix; an out-of-date ordinary dist fails closed.
  let baselineProse='',baselineSources='',baselineFile='';
  const prose=html=>/<div class="prose"[^>]*>([^]*?)<\/div>/.exec(html)?.[1];
  if(plan.correctionBaseline){
    const current=readFileSync(join(output,'articles/tool-use/index.html'),'utf8'),baseline=Buffer.from(plan.correctionBaseline.html,'base64').toString('utf8');
    const currentProse=prose(current),originalProse=prose(baseline);if(currentProse===undefined||originalProse===undefined)throw Error('baseline');
    baselineProse=currentProse.split('<h2 id="reviewed-corrections">')[0].trim();if(baselineProse!==originalProse.trim())throw Error('stale baseline HTML');
    baselineSources=/<section class="sources"[^>]*>[^]*?<\/section>/.exec(baseline)?.[0]??'';if(!baselineSources)throw Error('baseline sources');
    baselineFile='history/tool-use/'+plan.correctionBaseline.markdownHash+'.html';
    plan.publisherFiles[baselineFile]=Buffer.from(baseline.replace(/<meta name="robots"[^>]*>/g,'<meta name="robots" content="noindex, nofollow">').replace(/<link rel="canonical"[^>]*>/g,'').replace(/<script type="application\/ld\+json"[^>]*>[^]*?<\/script>/g,'')).toString('base64');
  }
  // Materialize pinned publisher history/flags/assets into the same full-site artifact.
  for(const [path,base64]of Object.entries(plan.publisherFiles)){
    const destination=join(output,path);mkdirSync(dirname(destination),{recursive:true});
    let value=Buffer.from(base64,'base64');if(path.endsWith('.html')){
      let html=rebasePublisherLinks(value.toString('utf8'),plan.publisherBase);
      if(plan.correctionBaseline&&path.startsWith('history/tool-use/')&&path!==baselineFile){
        let notes=prose(html);if(notes===undefined)throw Error('history prose');
        const ids=[...baselineSources.matchAll(/id="source-([^"]+)"/g)].map(m=>m[1]);notes=notes.replace(/(<a href="#source-([^"]+)"[^>]*>)\[\d+\](<\/a>)/g,(_,a,id,b)=>{const n=ids.indexOf(id)+1;return a.replace(/aria-label="Source \d+"/,()=>`aria-label="Source ${n}"`)+'['+n+']'+b;});
        html=html.replace(/(<div class="prose"[^>]*>)[^]*?<\/div>/,(_,open)=>open+baselineProse+'<h2>Reviewed corrections</h2>'+notes+'</div>');
        html=html.replace(/<section class="sources"[^>]*>[^]*?<\/section>/,()=>baselineSources);
      }
      if(plan.correctionBaseline&&path==='history/index.html')html=html.replace('<h2>Publication actions</h2>',`<p><a href="/${baselineFile}">Original full article before community corrections</a></p><h2>Publication actions</h2>`);
      const revision=/^history\/[a-z][a-z0-9-]*\/([a-f0-9]{64})\.html$/.exec(path)?.[1];
      if(revision&&!plan.correctionBaseline){const proofs=plan.proofs.filter(p=>p.revisionId===revision);html=html.replace('</article>',`<section class="revision"><h2>Bound original local evidence</h2><p>Integrity binding is not factual or source-authenticity proof.</p>${proofs.map(p=>`<p>Event: ${escape(p.eventId)}</p><ul>${p.bindings.map(b=>`<li>${escape(b.citationId)} · ${escape(b.sourceId)} · <code>${escape(b.bodyHash)}</code> · ${escape(b.receiptKey)}</li>`).join('')}</ul>`).join('')}</section></article>`);}
      value=Buffer.from(html);
    }
    writeFileSync(destination,value);
  }
  report('history-complete');
  const base=`/wiki-snapshots/${plan.siteId}/`;
  const {index,errors}=await createIndex({forceLanguage:'en'});if(errors.length||!index)throw new Error('index');
  try{
    for(const id of readingArticleIds){const added=await index.addHTMLFile({url:base+`articles/${id}/`,content:readFileSync(join(output,`articles/${id}/index.html`),'utf8')});if(added.errors.length)throw new Error('index');}
    const files=await index.getFiles();if(files.errors.length||files.files.length>512||files.files.reduce((n,f)=>n+f.content.length,0)>16*1024*1024)throw new Error('index');
    for(const file of files.files){if(!/^[a-zA-Z0-9_./-]+$/.test(file.path)||file.path.split('/').some(p=>p==='..'||p==='.'||p===''))throw new Error('path');const destination=join(output,'pagefind',file.path);mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,Buffer.from(file.content));}
    report('index-complete');
  }finally{await index.deleteIndex();}
  report('complete');
}catch(error){report('failure',{error:summarize(error)});process.exitCode=2;}finally{try{await close();}finally{clearInterval(guard);clearTimeout(deadline);}}
