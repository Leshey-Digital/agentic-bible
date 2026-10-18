import {readingArticleIds} from '../lib/article-ids.ts';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync,readdirSync,renameSync,rmSync,openSync,closeSync,fsyncSync,realpathSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {createIndex,close as closePagefind} from 'pagefind';
import {articleInput,baselineArticles,canonical,commandInput,concerns,digestId,fail,hash,publicationLimits,PublicationError,qualityFlags,validateCrosslinks,type Article,type Manifest,type PublicationState,type Receipt,type Reference} from './contracts.ts';
import {pages,releaseBase} from './render.ts';

export type Phase='after-revision'|'after-render'|'after-index'|'after-seal'|'after-activate';
type Options={checkpoint?:(phase:Phase)=>void|Promise<void>};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[])=>object(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const id=(v:unknown):v is string=>typeof v==='string'&&v.length<=50&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v)&&!['constructor','prototype'].includes(v);
const event=(v:unknown):v is string=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v);
const ref=(v:unknown):v is Reference=>exact(v,['id','manifestHash'])&&digestId((v as Reference).id)&&digestId((v as Reference).manifestHash);
const safePath=(p:string)=>p.length<240&&/^[a-zA-Z0-9_./-]+$/.test(p)&&p.split('/').every(s=>s!==''&&s!=='.'&&s!=='..');
const sync=(path:string)=>{const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};
function write(path:string,data:string|Uint8Array){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data);}
function walk(root:string):string[]{
  if(!existsSync(root))return [];
  return readdirSync(root).sort().flatMap(name=>{const path=join(root,name);const stat=lstatSync(path);if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))fail('unsafe_output');return stat.isDirectory()?walk(path):[path];});
}
function checkedState(v:unknown):asserts v is PublicationState{
  if(!exact(v,['schemaVersion','sequence','rendererHash','parent','ancestors','articles','history','receipts','lastOperation']))fail('artifact_corrupt');const s=v as PublicationState;
  if(s.schemaVersion!==1||!digestId(s.rendererHash)||!Number.isInteger(s.sequence)||s.sequence<1||s.sequence>publicationLimits.operations||!Array.isArray(s.ancestors)||s.ancestors.length!==s.sequence-1||s.ancestors.some(x=>!ref(x))||new Set(s.ancestors.map(x=>x.id)).size!==s.ancestors.length||canonical(s.parent)!==canonical(s.ancestors.at(-1)??null)||!object(s.articles)||!object(s.history)||!Array.isArray(s.receipts)||s.receipts.length!==s.sequence)fail('artifact_corrupt');
  if(Object.keys(s.articles).length>publicationLimits.articles||Object.keys(s.history).length>publicationLimits.revisions)fail('artifact_corrupt');
  const all=new Set<string>();
  for(const [article,ids]of Object.entries(s.history)){
    if(!id(article)||!Array.isArray(ids)||!ids.length||ids.length>publicationLimits.revisions||ids.some(x=>!digestId(x))||new Set(ids).size!==ids.length)fail('artifact_corrupt');for(const revision of ids)all.add(revision);
  }
  if(all.size>publicationLimits.revisions)fail('artifact_corrupt');
  for(const [article,revision]of Object.entries(s.articles))if(!id(article)||!digestId(revision)||!s.history[article]?.includes(revision))fail('artifact_corrupt');
  const events=new Set<string>();
  for(const [i,r]of s.receipts.entries()){
    if(!exact(r,['eventId','fingerprint','sequence','action','articleId','revisionId','flags'])||!event(r.eventId)||events.has(r.eventId)||!digestId(r.fingerprint)||r.sequence!==i+1||!['publish','rollback'].includes(r.action)||!Array.isArray(r.flags)||r.flags.some(f=>!concerns.includes(f))||r.flags.length>4)fail('artifact_corrupt');
    if(r.action==='publish'?(!id(r.articleId)||!digestId(r.revisionId)||!s.history[r.articleId]?.includes(r.revisionId)):(r.articleId!==null||r.revisionId!==null||r.flags.length!==0))fail('artifact_corrupt');events.add(r.eventId);
  }
  if(s.lastOperation!==s.receipts.at(-1)?.action)fail('artifact_corrupt');
}

export class PublicationStore{
  root:string;
  constructor(name='article-publication'){
    if(!/^article-publication(?:-[a-z0-9]+)*$/.test(name))fail('unsafe_output');
    const git=realpathSync(execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim());this.root=join(git,name);
    if(existsSync(this.root)&&lstatSync(this.root).isSymbolicLink())fail('unsafe_output');mkdirSync(this.root,{recursive:true});
    const marker=join(this.root,'store.json');const expected=canonical({schemaVersion:1,kind:'isolated-local-article-publication'});
    if(existsSync(marker)){if(lstatSync(marker).isSymbolicLink()||readFileSync(marker,'utf8')!==expected)fail('unsafe_output');}
    else{if(readdirSync(this.root).length)fail('unsafe_output');writeFileSync(marker,expected);}
  }
  private file(path:string){
    if(!safePath(path))fail('unsafe_output');let cursor=this.root;
    for(const part of path.split('/')){cursor=join(cursor,part);if(lstatSync(cursor,{throwIfNoEntry:false})?.isSymbolicLink())fail('unsafe_output');}return cursor;
  }
  revision(revisionId:string):Article{
    if(!digestId(revisionId))fail('artifact_corrupt');try{const raw=readFileSync(this.file(`revisions/${revisionId}.json`));if(raw.byteLength>publicationLimits.inputBytes||hash(raw)!==revisionId)fail('artifact_corrupt');return articleInput(JSON.parse(raw.toString('utf8')));}catch{ return fail('artifact_corrupt');}
  }
  load(reference:Reference):Manifest{
    if(!ref(reference))fail('artifact_corrupt');
    let check='manifest';
    try{
      const folder=this.file(`releases/${reference.id}`);const raw=readFileSync(join(folder,'manifest.json'));
      if(raw.length>131072||hash(raw)!==reference.manifestHash)fail('artifact_corrupt');const manifest=JSON.parse(raw.toString('utf8')) as Manifest;
      if(!exact(manifest,['schemaVersion','releaseId','state','files'])||manifest.schemaVersion!==1||manifest.releaseId!==reference.id||!object(manifest.files))fail('artifact_corrupt');check='state';checkedState(manifest.state);
      if(hash(canonical(manifest.state))!==reference.id)fail('artifact_corrupt');
      const names=Object.keys(manifest.files);if(names.length<9||names.length>512)fail('artifact_corrupt');let bytes=0;
      for(const [path,expected]of Object.entries(manifest.files)){
        check='file '+path;
        if(!safePath(path)||path==='manifest.json'||!exact(expected,['sha256','bytes'])||!digestId(expected.sha256)||!Number.isSafeInteger(expected.bytes)||expected.bytes<0||expected.bytes>publicationLimits.artifactBytes)fail('artifact_corrupt');
        const content=readFileSync(this.file(`releases/${reference.id}/${path}`));bytes+=content.length;if(content.length!==expected.bytes||hash(content)!==expected.sha256)fail('artifact_corrupt');
      }
      if(bytes>publicationLimits.artifactBytes)fail('artifact_corrupt');
      check='inventory';const actual=walk(folder).map(p=>relative(folder,p));if(canonical(actual.filter(p=>p!=='manifest.json').sort())!==canonical(names.sort()))fail('artifact_corrupt');
      check='required-files';
      for(const path of ['index.html','search/index.html','history/index.html','review/index.html','assets/global.css','assets/reading.css','assets/preview.css','assets/search.js','assets/favicon.svg'])if(!manifest.files[path])fail('artifact_corrupt');
      check='revisions';for(const [article,revision]of Object.entries(manifest.state.articles))if(!manifest.files[`articles/${article}/index.html`]||this.revision(revision).id!==article)fail('artifact_corrupt');
      for(const [article,ids]of Object.entries(manifest.state.history))for(const revision of ids)if(!manifest.files[`history/${article}/${revision}.html`]||this.revision(revision).id!==article)fail('artifact_corrupt');
      check='search-entry';if(Object.keys(manifest.state.articles).length&&!manifest.files['pagefind/pagefind.js'])fail('artifact_corrupt');
      return manifest;
    }catch(error){throw new PublicationError('artifact_corrupt',{check,cause:error});}
  }
  current():{reference:Reference;manifest:Manifest}|null{
    const pointer=this.file('current.json');if(!existsSync(pointer))return null;
    try{const raw=readFileSync(pointer);if(raw.length>300)fail('artifact_corrupt');const reference:unknown=JSON.parse(raw.toString('utf8'));if(!ref(reference))fail('artifact_corrupt');return {reference,manifest:this.load(reference)};}catch{return fail('artifact_corrupt');}
  }
  private rendererHash(){return hash(canonical(['package-lock.json','.nvmrc','src/publishing/contracts.ts','src/publishing/render.ts','src/publishing/store.ts','src/publishing/search.js','src/publishing/preview.css','src/styles/global.css','src/styles/reading.css','public/favicon.svg'].map(path=>[path,hash(readFileSync(path))])));}
  async execute(value:unknown,options:Options={}):Promise<Receipt>{
    const command=commandInput(value);const fingerprint=hash(canonical(command));
    let mutex:DatabaseSync|undefined;
    try{
      mutex=new DatabaseSync(this.file('mutex.sqlite'));mutex.exec('PRAGMA busy_timeout=0; CREATE TABLE IF NOT EXISTS publication_mutex(id INTEGER PRIMARY KEY); BEGIN IMMEDIATE;');
    }catch(error){mutex?.close();if(/locked|busy/i.test(String(error)))return fail('publication_busy');return fail('storage_unavailable');}
    let staging:string|undefined;
    try{
      const current=this.current();const prior=current?.manifest.state;
      const receipt=prior?.receipts.find(r=>r.eventId===command.eventId);if(receipt){if(receipt.fingerprint!==fingerprint)fail('event_reference_conflict');return receipt;}
      // Reserve a terminal rollback operation and a complete artifact's disk budget.
      if((prior?.sequence??0)>=publicationLimits.operations||(command.kind==='publish'&&(prior?.sequence??0)>=publicationLimits.operations-1))fail('publication_capacity');
      const stages=this.file('staging');mkdirSync(stages,{recursive:true});for(const name of readdirSync(stages)){if(!/^stage-[a-f0-9-]{36}$/.test(name))fail('unsafe_output');rmSync(this.file(`staging/${name}`),{recursive:true});}
      const diskLimit=publicationLimits.diskBytes-(command.kind==='publish'?publicationLimits.artifactBytes:0);
      if(walk(this.root).reduce((n,path)=>n+lstatSync(path).size,0)+publicationLimits.artifactBytes+publicationLimits.inputBytes+4096>diskLimit)fail('publication_capacity');
      let articles={...prior?.articles};const history=structuredClone(prior?.history??{});let revisionId:string|null=null;let articleId:string|null=null;let flags:Receipt['flags']=[];
      if(command.kind==='publish'){
        const article=command.article;articleId=article.id;if((articles[article.id]??null)!==command.baseRevision)fail('stale_revision');
        validateCrosslinks(article,new Set([...baselineArticles,...readingArticleIds,...Object.keys(articles),article.id]));revisionId=hash(canonical(article));flags=qualityFlags(article);
        articles[article.id]=revisionId;history[article.id]??=[];if(!history[article.id].includes(revisionId))history[article.id].push(revisionId);
        if(Object.keys(articles).length>publicationLimits.articles||new Set(Object.values(history).flat()).size>publicationLimits.revisions)fail('publication_capacity');
        const revision=this.file(`revisions/${revisionId}.json`);if(existsSync(revision)){if(hash(readFileSync(revision))!==revisionId)fail('artifact_corrupt');}
        else{const temporary=this.file(`revisions/${revisionId}.tmp`);write(temporary,canonical(article));sync(temporary);renameSync(temporary,revision);sync(dirname(revision));}
        await options.checkpoint?.('after-revision');
      }else{
        if(!current||current.reference.id!==command.expectedRelease)fail('stale_release');
        const target=command.targetRelease===null?null:prior!.ancestors.find(r=>r.id===command.targetRelease);if(command.targetRelease!==null&&!target)fail('rollback_target_not_ancestor');
        articles=target?{...this.load(target).state.articles}:{};
      }
      const sequence=(prior?.sequence??0)+1;
      const result:Receipt={eventId:command.eventId,fingerprint,sequence,action:command.kind,articleId,revisionId,flags};
      const state:PublicationState={schemaVersion:1,sequence,rendererHash:this.rendererHash(),parent:current?.reference??null,ancestors:[...(prior?.ancestors??[]),...(current?[current.reference]:[])],articles,history,receipts:[...(prior?.receipts??[]),result],lastOperation:command.kind};
      checkedState(state);const releaseId=hash(canonical(state));const base=releaseBase(releaseId);const destination=this.file(`releases/${releaseId}`);
      let reference:Reference;
      if(existsSync(destination)){
        reference={id:releaseId,manifestHash:hash(readFileSync(join(destination,'manifest.json')))};const existing=this.load(reference);if(canonical(existing.state)!==canonical(state))fail('artifact_corrupt');
      }else{
        staging=this.file(`staging/stage-${randomUUID()}`);mkdirSync(staging);
        const revisions=Object.fromEntries([...new Set(Object.values(history).flat())].map(revision=>[revision,this.revision(revision)]));
        const rendered=pages(state,base,revisions);for(const [path,html]of rendered)write(join(staging,path),html);
        for(const [name,path]of Object.entries({'global.css':'src/styles/global.css','reading.css':'src/styles/reading.css','preview.css':'src/publishing/preview.css','search.js':'src/publishing/search.js','favicon.svg':'public/favicon.svg'}))write(join(staging,'assets',name),readFileSync(path));
        await options.checkpoint?.('after-render');
        if(Object.keys(articles).length){
          let timer:ReturnType<typeof setTimeout>|undefined;let timedOut=false;
          const build=async()=>{
            const created=await createIndex({forceLanguage:'en'});if(created.errors.length||!created.index)fail('search_build_failed');
            try{
              for(const article of Object.keys(articles).sort()){const added=await created.index.addHTMLFile({url:base+`articles/${article}/`,content:rendered.get(`articles/${article}/index.html`)!});if(added.errors.length)fail('search_build_failed');}
              // Materialize owned bytes before sealing, independent of the service's filesystem writer.
              const built=await created.index.getFiles();if(built.errors.length||built.files.length>512||built.files.reduce((n,f)=>n+f.content.byteLength,0)>publicationLimits.artifactBytes)fail('search_build_failed');
              for(const file of built.files){if(!safePath(file.path))fail('search_build_failed');write(join(staging!,'pagefind',file.path),Buffer.from(file.content));}
            }finally{if(!timedOut)await created.index.deleteIndex();}
          };
          try{await Promise.race([build(),new Promise<never>((_,reject)=>{timer=setTimeout(async()=>{timedOut=true;await closePagefind();reject(new PublicationError('search_build_timeout'));},30000);})]);}
          finally{if(timer)clearTimeout(timer);}
        }
        await options.checkpoint?.('after-index');
        const files=Object.fromEntries(walk(staging).map(path=>{const data=readFileSync(path);return [relative(staging!,path),{sha256:hash(data),bytes:data.length}];}));
        if(Object.values(files).reduce((n,f)=>n+f.bytes,0)>publicationLimits.artifactBytes)fail('publication_capacity');
        const manifest:Manifest={schemaVersion:1,releaseId,state,files};write(join(staging,'manifest.json'),canonical(manifest));
        for(const file of walk(staging))sync(file);const directories=new Set(walk(staging).map(dirname));for(const directory of [...directories].sort((a,b)=>b.length-a.length))sync(directory);sync(staging);
        mkdirSync(dirname(destination),{recursive:true});renameSync(staging,destination);staging=undefined;sync(dirname(destination));
        reference={id:releaseId,manifestHash:hash(canonical(manifest))};
      }
      this.load(reference);await options.checkpoint?.('after-seal');
      if(walk(this.root).reduce((n,path)=>n+lstatSync(path).size,0)>publicationLimits.diskBytes)fail('publication_capacity');
      const temporary=this.file('current.tmp');writeFileSync(temporary,canonical(reference));sync(temporary);renameSync(temporary,this.file('current.json'));sync(this.root);
      await options.checkpoint?.('after-activate');return result;
    }catch(error){if(error instanceof PublicationError)throw error;return fail('publication_outcome_unconfirmed');}
    finally{if(staging)rmSync(staging,{recursive:true,force:true});try{mutex.exec('ROLLBACK');}finally{mutex.close();}}
  }
}
