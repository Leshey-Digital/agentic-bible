// Private child of the bridge command. No network source fetch or package installation.
import {build} from 'astro';
import {createIndex,close} from 'pagefind';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {rebasePublisherLinks} from '../src/wiki-bridge/html.ts';
const [project,output,planPath,ownerPid]=process.argv.slice(2);const plan=JSON.parse(readFileSync(planPath,'utf8'));
const owner=Number(ownerPid);if(!Number.isSafeInteger(owner)||owner<2||process.ppid!==owner)process.exit(3);
const guard=setInterval(()=>{if(process.ppid!==owner)process.exit(3);try{process.kill(owner,0);}catch{process.exit(3);}},100);guard.unref();
const deadline=setTimeout(()=>process.exit(3),45000);deadline.unref();
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{
  await build({root:project,outDir:output,cacheDir:join(project,'.astro'),vite:{cacheDir:join(project,'.vite')},logLevel:'silent'});
  // Materialize pinned publisher history/flags/assets into the same full-site artifact.
  for(const [path,base64]of Object.entries(plan.publisherFiles)){
    const destination=join(output,path);mkdirSync(dirname(destination),{recursive:true});
    let value=Buffer.from(base64,'base64');if(path.endsWith('.html')){
      let html=rebasePublisherLinks(value.toString('utf8'),plan.publisherBase);
      const revision=/^history\/tool-use\/([a-f0-9]{64})\.html$/.exec(path)?.[1];
      if(revision){const proofs=plan.proofs.filter(p=>p.revisionId===revision);html=html.replace('</article>',`<section class="revision"><h2>Bound original local evidence</h2><p>Integrity binding is not factual or source-authenticity proof.</p>${proofs.map(p=>`<p>Event: ${escape(p.eventId)}</p><ul>${p.bindings.map(b=>`<li>${escape(b.citationId)} · ${escape(b.sourceId)} · <code>${escape(b.bodyHash)}</code> · ${escape(b.receiptKey)}</li>`).join('')}</ul>`).join('')}</section></article>`);}
      value=Buffer.from(html);
    }
    writeFileSync(destination,value);
  }
  const base=`/wiki-snapshots/${plan.siteId}/`;
  const {index,errors}=await createIndex({forceLanguage:'en'});if(errors.length||!index)throw new Error('index');
  try{
    for(const id of ['ai-agent','tool-use','model-context-protocol']){const added=await index.addHTMLFile({url:base+`articles/${id}/`,content:readFileSync(join(output,`articles/${id}/index.html`),'utf8')});if(added.errors.length)throw new Error('index');}
    const files=await index.getFiles();if(files.errors.length||files.files.length>512||files.files.reduce((n,f)=>n+f.content.length,0)>16*1024*1024)throw new Error('index');
    for(const file of files.files){if(!/^[a-zA-Z0-9_./-]+$/.test(file.path)||file.path.split('/').some(p=>p==='..'||p==='.'||p===''))throw new Error('path');const destination=join(output,'pagefind',file.path);mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,Buffer.from(file.content));}
  }finally{await index.deleteIndex();}
}catch{process.exitCode=2;}finally{try{await close();}finally{clearInterval(guard);clearTimeout(deadline);}}
