import {maintenanceTarget} from '../maintenance-quality/target.ts';
import {readQualityAdmission,requireQualityAllow} from '../maintenance-quality/admission.ts';
import type {QualityControl} from '../maintenance-quality/contracts.ts';
import {readingArticleIds} from '../lib/article-ids.ts';
import {reviewedCommand,verifyApproval,type ReviewedCommand} from '../corrections/approval.ts';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {mkdirSync,existsSync,lstatSync,readdirSync,renameSync,rmSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {PublicationStore} from '../publishing/store.ts';
import {PublicationError,canonical,hash,baselineArticles,validateCrosslinks,type Reference,type Receipt as ArticleReceipt} from '../publishing/contracts.ts';
import {bridgeInput,validateEvidence,reference,digest,object,type BridgeCommand,type Apply,type Binding} from './contracts.ts';
import {BridgeError,bridgeLimits,reject} from './limits.ts';
import {atomic,bounded,json,projectFiles,safePath,sync,syncTree,walk,write} from './files.ts';
import {buildWiki} from './build.ts';
import {snapshotV1ArticlePages,snapshotV1CatalogBytes} from './snapshot-v1.ts';

type Event={eventId:string;fingerprint:string;sequence:number;kind:'apply'|'rollback';publisher:Reference;articleRevision:string|null;evidenceHash:string};
export type SiteState={schemaVersion:1|2;targetArticleId?:string;mode:'local-synthetic-only';sequence:number;originalMarkdownHash:string;sourceTreeHash:string;publisher:Reference;articleRevision:string|null;bindings:Binding[];proofs:{eventId:string;revisionId:string;bindings:Binding[]}[];parent:Reference|null;ancestors:Reference[];events:Event[]};
export type SiteManifest={schemaVersion:1;siteId:string;state:SiteState;files:Record<string,{sha256:string;bytes:number}>};
export type SiteReceipt=Event&{outcome:'site-activated';site:Reference;parent:Reference|null};
type Job={schemaVersion:1;command:BridgeCommand;fingerprint:string;sourceTreeHash:string;phase:'validated'|'article-accepted/site-pending'|'building'|'complete';bindings:Binding[];buildAttempts:number;publisher?:Reference;articleReceipt?:ArticleReceipt;receipt?:SiteReceipt};
export type BridgePhase='after-validation'|'after-publication'|'after-article-journal'|'build-started'|'after-build'|'after-seal'|'after-activate';
type Options={quality?:QualityControl;checkpoint?:(phase:BridgePhase)=>void|Promise<void>};

export class WikiBridge {
  root:string;repo:string;publisher:PublicationStore;
  constructor(name='wiki-bridge-local',repo=process.cwd()){
    if(!/^wiki-bridge(?:-[a-z0-9]+)+$/.test(name))reject('unsafe_bridge_store');this.repo=realpathSync(repo);
    const git=realpathSync(execFileSync('git',['-C',this.repo,'rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim());this.root=join(git,name);
    if(existsSync(this.root)&&lstatSync(this.root).isSymbolicLink())reject('unsafe_bridge_store');mkdirSync(this.root,{recursive:true});
    const marker=join(this.root,'store.json');const value=canonical({schemaVersion:1,kind:'local-synthetic-wiki-bridge',name});
    if(existsSync(marker)){if(lstatSync(marker).isSymbolicLink()||bounded(marker,1000).toString()!==value)reject('unsafe_bridge_store');}else{if(readdirSync(this.root).length)reject('unsafe_bridge_store');write(marker,value);}
    this.publisher=new PublicationStore('article-publication-'+name);
  }
  private path(path:string){if(!safePath(path))reject('unsafe_bridge_store');let cursor=this.root;for(const part of path.split('/')){cursor=join(cursor,part);if(lstatSync(cursor,{throwIfNoEntry:false})?.isSymbolicLink())reject('unsafe_bridge_store');}return cursor;}
  load(ref:Reference):SiteManifest{
    try{
      if(!reference(ref))reject('site_corrupt');const folder=this.path(`sites/${ref.id}`);const raw=bounded(join(folder,'manifest.json'),1024*1024);if(hash(raw)!==ref.manifestHash)reject('site_corrupt');
      const manifest=JSON.parse(raw.toString()) as SiteManifest;const s=manifest.state;
      if(manifest.schemaVersion!==1||manifest.siteId!==ref.id||!object(s)||s.mode!=='local-synthetic-only'||hash(canonical(s))!==ref.id||!Number.isInteger(s.sequence)||s.sequence<1||s.sequence>8||!digest(s.originalMarkdownHash)||!digest(s.sourceTreeHash)||!reference(s.publisher)||!Array.isArray(s.ancestors)||s.ancestors.length!==s.sequence-1||!Array.isArray(s.events)||s.events.length!==s.sequence||canonical(s.parent)!==canonical(s.ancestors.at(-1)??null))reject('site_corrupt');
      if(s.schemaVersion===2){try{maintenanceTarget(s.targetArticleId);}catch{reject('site_corrupt');}}else if(s.schemaVersion!==1||s.targetArticleId!==undefined)reject('site_corrupt');
      for(const ancestor of s.ancestors)if(!reference(ancestor))reject('site_corrupt');
      if(new Set(s.events.map(e=>e.eventId)).size!==s.events.length||s.events.some((e,i)=>!digest(e.fingerprint)||e.sequence!==i+1||!reference(e.publisher)))reject('site_corrupt');
      const actual=inventoryExceptManifest(folder);if(canonical(actual)!==canonical(manifest.files))reject('site_corrupt');
      for(const path of ['index.html','search/index.html','source-catalog.json','pagefind/pagefind.js','history/index.html','review/index.html'])if(!actual[path])reject('site_corrupt');
      const catalog=bounded(join(folder,'source-catalog.json'),snapshotV1CatalogBytes);if(hash(catalog)!==actual['source-catalog.json'].sha256)reject('site_corrupt');
      snapshotV1ArticlePages(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(catalog)),actual);
      return manifest;
    }catch{return reject('site_corrupt');}
  }
  current(){const path=this.path('current.json');if(!existsSync(path))return null;try{const ref=reference(json(path,300));if(!ref)reject('site_corrupt');return {reference:ref,manifest:this.load(ref)};}catch{return reject('site_corrupt');}}
  private storageUsage(){
    const captures=this.path('captures');let captureSlots=0;
    if(existsSync(captures))for(const name of readdirSync(captures)){if(!/^capture-[a-f0-9]{64}-[1-3]-[A-Za-z0-9]{6}$/.test(name)||!lstatSync(this.path(`captures/${name}`)).isDirectory())reject('unsafe_capture');captureSlots++;}
    let storedBytes=0;for(const name of readdirSync(this.root)){if(name==='captures')continue;const path=this.path(name),stat=lstatSync(path);storedBytes+=stat.isDirectory()?walk(path).reduce((n,file)=>n+lstatSync(file).size,0):stat.size;}
    const reservedCaptureBytes=captureSlots*bridgeLimits.captureBytes;
    return {captureSlots,reservedCaptureBytes,accountedBytes:storedBytes+reservedCaptureBytes,limitBytes:bridgeLimits.storeBytes};
  }
  private receipt(current:NonNullable<ReturnType<WikiBridge['current']>>,event:Event):SiteReceipt{
    const site=event.sequence===current.manifest.state.sequence?current.reference:current.manifest.state.ancestors[event.sequence-1];
    return {...event,outcome:'site-activated',site,parent:event.sequence===1?null:current.manifest.state.ancestors[event.sequence-2]};
  }
  status(){
    const active=this.current();const jobs=this.path('jobs');const pending:{eventId:string;phase:string;buildAttempts:number}[]=[];
    if(existsSync(jobs))for(const id of readdirSync(jobs)){if(!digest(id))reject('unsafe_bridge_store');const job=json(this.path(`jobs/${id}/operation.json`)) as Job;if(job.phase==='complete'||active?.manifest.state.events.some(e=>e.eventId===job.command.eventId))continue;
      const accepted=this.publisher.current()?.manifest.state.receipts.some(e=>e.eventId===job.command.eventId);
      pending.push({eventId:job.command.eventId,phase:accepted?'article-accepted/site-pending':'evidence-validated/article-pending',buildAttempts:job.buildAttempts});}
    return {mode:'local-synthetic-only',active:active?{...active.reference,sequence:active.manifest.state.sequence,articleRevision:active.manifest.state.articleRevision,publisher:active.manifest.state.publisher}:null,pending,storage:this.storageUsage()};
  }
  async execute(value:unknown,db:SqlDatabase,sourceDirectory:string,options:Options={}):Promise<SiteReceipt>{
    const command=bridgeInput(value);if(command.kind==='apply'&&command.schemaVersion===2){if(!options.quality)reject('quality_verifier_unconfigured');options={...options,quality:{...options.quality,previousCandidateHash:command.revision.baseRevision}};}if(command.kind==='apply'&&command.revision.article.reviewedCorrections)reject('reviewed_approval_required');
    return this.executeCommand(command,db,sourceDirectory,options);
  }
  async executeReviewed(approvalId:string,db:SqlDatabase,options:Options={}):Promise<SiteReceipt>{
    const command=await reviewedCommand(approvalId,db);
    return this.executeCommand(command,db,'',options,()=>verifyApproval(command,db));
  }
  private async executeCommand(command:BridgeCommand|ReviewedCommand,db:SqlDatabase,sourceDirectory:string,options:Options,reviewed?:()=>Promise<{bindings:Binding[];files:Record<string,Buffer>;evidenceHash:string}>):Promise<SiteReceipt>{
    if(command.kind==='rollback'&&this.current()?.manifest.state.schemaVersion===2)reject('unsupported_bridge_rollback_profile');const targetId=command.kind==='apply'?command.revision.article.id:(this.current()?.manifest.state.targetArticleId??'tool-use'),articleTarget=maintenanceTarget(targetId);const fingerprint=hash(canonical(command));const jobId=hash(command.eventId);const jobDir=this.path(`jobs/${jobId}`);const jobPath=join(jobDir,'operation.json');let mutex:DatabaseSync|undefined;
    try{mutex=new DatabaseSync(this.path('mutex.sqlite'));mutex.exec('PRAGMA busy_timeout=0;CREATE TABLE IF NOT EXISTS bridge_mutex(id INTEGER PRIMARY KEY);BEGIN IMMEDIATE;');}catch(error){mutex?.close();return reject(/locked|busy/i.test(String(error))?'bridge_busy':'bridge_storage_unavailable');}
    let stage:string|undefined;
    try{
      let current=this.current();let job=existsSync(jobPath)?json(jobPath) as Job:null;
      if(job&&job.fingerprint!==fingerprint)reject('bridge_event_conflict');
      const priorEvent=current?.manifest.state.events.find(e=>e.eventId===command.eventId);
      if(priorEvent){if(priorEvent.fingerprint!==fingerprint)reject('bridge_event_conflict');return this.receipt(current!,priorEvent);}
      if(job?.receipt)return job.receipt;
      const jobs=this.path('jobs');if(existsSync(jobs))for(const id of readdirSync(jobs)){if(id===jobId)continue;const other=json(this.path(`jobs/${id}/operation.json`)) as Job;if(other.phase!=='complete'&&!current?.manifest.state.events.some(e=>e.eventId===other.command.eventId))reject('bridge_pending_operation');}
      if(canonical(current?.reference??null)!==canonical(command.expectedSite))reject('stale_site_parent');
      const original=bounded(join(this.repo,articleTarget.articlePath),128*1024);if(hash(original)!==command.originalMarkdownHash||current&&(current.manifest.state.targetArticleId??'tool-use')===targetId&&current.manifest.state.originalMarkdownHash!==command.originalMarkdownHash)reject('stale_original_markdown');
      const project=projectFiles(this.repo);if('authority' in command&&command.authority.sourceTreeHash!==project.hash)reject('build_source_changed');if(job&&job.sourceTreeHash!==project.hash||current&&current.manifest.state.sourceTreeHash!==project.hash)reject('build_source_changed');
      const sequence=(current?.manifest.state.sequence??0)+1;if(sequence>8||command.kind==='apply'&&sequence===8)reject('bridge_capacity');
      let validated:{bindings:Binding[];files:Record<string,Buffer>;evidenceHash:string};let target:SiteManifest|null=null;
      if(command.kind==='apply'){
        if(command.revision.baseRevision!==null&&!digest(command.revision.baseRevision))reject('invalid_publisher_base');validateCrosslinks(command.revision.article,new Set(command.schemaVersion===2?readingArticleIds:baselineArticles));
        validated=reviewed?await reviewed():await validateEvidence(command,db,sourceDirectory);if(options.quality){const admission=await readQualityAdmission(command.eventId,command.revision.article,command.evidence.map(e=>{const x='extractions' in validated?(validated.extractions as any)?.[e.bodyHash]:undefined;return {...e,bytes:validated.files[e.bodyHash],...(x?{extraction:{profileId:x.profileId,rawHash:x.raw.hash,extractedHash:x.evidence.hash,text:x.evidence.text,spans:x.evidence.spans},lineage:{originIds:[],provenance:'unknown' as const}}:{})};}),{db,quality:options.quality});requireQualityAllow(admission);}
      }else{
        if(command.targetSite){if(!current!.manifest.state.ancestors.some(ref=>canonical(ref)===canonical(command.targetSite)))reject('rollback_site_not_ancestor');target=this.load(command.targetSite);}
        validated=reviewed?await reviewed():await this.revalidateBindings(target?.state.bindings??[],target?.state.articleRevision??null,db);
      }
      const pub=this.publisher.current();const publisherCommand=command.kind==='apply'?command.revision:{schemaVersion:1,kind:'rollback',eventId:command.eventId,expectedRelease:command.expectedPublisher!.id,targetRelease:target?.state.publisher.id??null};
      const pubFingerprint=hash(canonical(publisherCommand));const ownAccepted=pub?.manifest.state.receipts.find(r=>r.eventId===command.eventId);
      if(canonical(pub?.reference??null)!==canonical(command.expectedPublisher)){
        if(!job||!ownAccepted||ownAccepted.fingerprint!==pubFingerprint||pub!.manifest.state.receipts.at(-1)?.eventId!==command.eventId)reject('stale_publisher_parent');
      }else if(command.kind==='apply'&&(pub?.manifest.state.articles[targetId]??null)!==command.revision.baseRevision)reject('stale_publisher_base');
      if(pub&&Object.keys(pub.manifest.state.articles).some(id=>!readingArticleIds.includes(id as any)))reject('unsupported_publisher_snapshot');
      if(!job){
        if(this.storageUsage().accountedBytes+bridgeLimits.captureBytes+bridgeLimits.siteBytes>bridgeLimits.storeBytes-(command.kind==='apply'?bridgeLimits.siteBytes:0))reject('bridge_storage_capacity');
        if(existsSync(jobs)&&readdirSync(jobs).length>=8)reject('bridge_capacity');
        job={schemaVersion:1,command,fingerprint,sourceTreeHash:project.hash,phase:'validated',bindings:validated.bindings,buildAttempts:0};
        for(const [sha,bytes]of Object.entries(validated.files))write(this.path(`evidence/${sha}.txt`),bytes);atomic(jobPath,job);
      }else if(canonical(job.bindings)!==canonical(validated.bindings))reject('evidence_changed_pending');
      await options.checkpoint?.('after-validation');
      const articleReceipt=await this.publisher.execute(publisherCommand);await options.checkpoint?.('after-publication');
      const pinned=this.publisher.current()!;if(pinned.manifest.state.receipts.at(-1)?.eventId!==command.eventId)reject('publisher_changed_pending');
      if(job.publisher&&canonical(job.publisher)!==canonical(pinned.reference))reject('publisher_changed_pending');
      job.publisher=pinned.reference;job.articleReceipt=articleReceipt;job.phase='article-accepted/site-pending';atomic(jobPath,job);await options.checkpoint?.('after-article-journal');
      const event:Event={eventId:command.eventId,fingerprint,sequence,kind:command.kind,publisher:pinned.reference,articleRevision:pinned.manifest.state.articles[targetId]??null,evidenceHash:reviewed?validated.evidenceHash:hash(canonical(job.bindings))};
      const generic=command.kind==='apply'&&command.schemaVersion===2||current?.manifest.state.schemaVersion===2;const state:SiteState={schemaVersion:generic?2:1,...(generic?{targetArticleId:targetId}:{}),mode:'local-synthetic-only',sequence,originalMarkdownHash:command.originalMarkdownHash,sourceTreeHash:job.sourceTreeHash,publisher:pinned.reference,articleRevision:event.articleRevision,bindings:job.bindings,proofs:[...(current?.manifest.state.proofs??[]),...(command.kind==='apply'?[{eventId:command.eventId,revisionId:event.articleRevision!,bindings:job.bindings}]:[])],parent:current?.reference??null,ancestors:[...(current?.manifest.state.ancestors??[]),...(current?[current.reference]:[])],events:[...(current?.manifest.state.events??[]),event]};
      const siteId=hash(canonical(state));const destination=this.path(`sites/${siteId}`);let ref:Reference;
      if(existsSync(destination)){
        ref={id:siteId,manifestHash:hash(bounded(join(destination,'manifest.json'),1024*1024))};if(canonical(this.load(ref).state)!==canonical(state))reject('site_corrupt');
      }else{
        const occupied=this.storageUsage().accountedBytes;
        if(occupied+bridgeLimits.captureBytes+bridgeLimits.siteBytes>bridgeLimits.storeBytes-(command.kind==='apply'?bridgeLimits.siteBytes:0))reject('bridge_storage_capacity');
        if(job.buildAttempts>=3)reject('bridge_build_attempts_exhausted');job.buildAttempts++;job.phase='building';atomic(jobPath,job);
        stage=this.path(`staging/${jobId}-${job.buildAttempts}`);if(existsSync(stage))reject('bridge_stage_exists');mkdirSync(stage,{recursive:true});
        const files=await buildWiki({repo:this.repo,captureRoot:this.path('captures'),capture:{eventId:command.eventId,jobId,attempt:job.buildAttempts},project:project.files,output:stage,siteId,publisher:this.publisher,reference:pinned.reference,bindings:job.bindings,proofs:state.proofs,started:()=>options.checkpoint?.('build-started')});await options.checkpoint?.('after-build');
        const manifest:SiteManifest={schemaVersion:1,siteId,state,files};write(join(stage,'manifest.json'),canonical(manifest));syncTree(stage);mkdirSync(this.path('sites'),{recursive:true});renameSync(stage,destination);stage=undefined;sync(this.path('sites'));ref={id:siteId,manifestHash:hash(canonical(manifest))};
      }
      this.load(ref);await options.checkpoint?.('after-seal');
      if(canonical(this.current()?.reference??null)!==canonical(command.expectedSite))reject('stale_site_parent');
      if(canonical(this.publisher.current()?.reference)!==canonical(pinned.reference))reject('publisher_changed_pending');
      if(projectFiles(this.repo).hash!==job.sourceTreeHash)reject('build_source_changed');
      const finalEvidence=reviewed?await reviewed():command.kind==='apply'?await validateEvidence(command,db,sourceDirectory):await this.revalidateBindings(job.bindings,event.articleRevision,db);if(canonical(finalEvidence.bindings)!==canonical(job.bindings)||reviewed&&finalEvidence.evidenceHash!==validated.evidenceHash)reject('evidence_changed_pending');
      atomic(this.path('current.json'),ref);await options.checkpoint?.('after-activate');
      current=this.current()!;const receipt=this.receipt(current,event);job.phase='complete';job.receipt=receipt;atomic(jobPath,job);return receipt;
    }catch(error){if(error instanceof BridgeError||error instanceof PublicationError)throw error;return reject('bridge_outcome_unconfirmed_retry_same_event');}
    finally{if(stage)rmSync(stage,{recursive:true,force:true});try{mutex.exec('ROLLBACK');}finally{mutex.close();}}
  }
  private async revalidateBindings(bindings:Binding[],revision:string|null,db:SqlDatabase){
    if(!revision){if(bindings.length)reject('invalid_rollback_evidence');return {bindings:[],files:{},evidenceHash:hash(canonical([]))};}
    const article=this.publisher.revision(revision);
    const evidence=bindings.map(b=>({citationId:b.citationId,sourceId:b.sourceId,url:b.url,receiptKey:b.receiptKey,bodyHash:b.bodyHash,file:b.bodyHash+'.txt'}));
    const input={revision:{article},evidence} as Apply;return validateEvidence(input,db,this.path('evidence'));
  }
}
function inventoryExceptManifest(folder:string){const files:SiteManifest['files']={};let bytes=0;for(const path of walk(folder)){const name=path.slice(folder.length+1);if(name==='manifest.json')continue;if(!safePath(name))reject('site_corrupt');const content=bounded(path,bridgeLimits.siteBytes);bytes+=content.length;if(bytes>bridgeLimits.siteBytes||Object.keys(files).length>=1024)reject('site_corrupt');files[name]={sha256:hash(content),bytes:content.length};}return files;}
