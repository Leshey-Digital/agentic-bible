import {correctionCredits,type CorrectionCredit} from '../corrections/credits.ts';
import {createHash} from 'node:crypto';
import {validateSource} from '../editorial/validation.ts';

export const publicationLimits=Object.freeze({inputBytes:32768,operations:32,revisions:32,articles:20,diskBytes:64*1024*1024,artifactBytes:8*1024*1024});
export const baselineArticles=['ai-agent','tool-use','model-context-protocol'];
export const concerns=['editorial-review','source-recency','coverage-gap','limited-source-coverage'] as const;
export type Concern=typeof concerns[number];
export type Inline={type:'text';text:string}|{type:'citation';sourceId:string}|{type:'article';articleId:string;label:string};
export type Block={type:'heading';id:string;text:string}|{type:'paragraph';content:Inline[]};
export type Article={id:string;title:string;description:string;topic:'Foundations'|'Capabilities'|'Protocols';verified:string;provenance:'supplied-local-fixture';sources:{id:string;title:string;url:string;publisher:string;context:string}[];related:string[];blocks:Block[];concerns:Concern[];reviewedCorrections?:CorrectionCredit[]};
export type Publish={schemaVersion:1;kind:'publish';eventId:string;baseRevision:string|null;article:Article};
export type Rollback={schemaVersion:1;kind:'rollback';eventId:string;expectedRelease:string;targetRelease:string|null};
export type Command=Publish|Rollback;
export type Receipt={eventId:string;fingerprint:string;sequence:number;action:'publish'|'rollback';articleId:string|null;revisionId:string|null;flags:Concern[]};
export type Reference={id:string;manifestHash:string};
export type PublicationState={schemaVersion:1;sequence:number;rendererHash:string;parent:Reference|null;ancestors:Reference[];articles:Record<string,string>;history:Record<string,string[]>;receipts:Receipt[];lastOperation:Command['kind']};
export type Manifest={schemaVersion:1;releaseId:string;state:PublicationState;files:Record<string,{sha256:string;bytes:number}>};
export class PublicationError extends Error {code:string;constructor(code:string,cause?:unknown){super(code,{cause});this.code=code;}}
export function fail(code:string):never{throw new PublicationError(code);}
export const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export function canonical(value:unknown):string{
  const sort=(v:unknown):unknown=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,x])=>[k,sort(x)])):v;
  return JSON.stringify(sort(value))+'\n';
}
export const digestId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function shape(v:unknown,keys:string[]):asserts v is Record<string,unknown>{if(!record(v)||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))fail('invalid_schema');}
function text(v:unknown,max:number,min=1):string{
  if(typeof v!=='string'||v.length<min||v.length>max||v!==v.trim()||Buffer.from(v).toString('utf8')!==v||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v))fail('invalid_text');
  if(/<\s*[a-z!/?]/i.test(v))fail('unsafe_markup');
  return v;
}
function slug(v:unknown,max=50):string{const value=text(v,max);if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)||['__proto__','constructor','prototype'].includes(value))fail('invalid_identifier');return value;}
const list=(v:unknown,min:number,max:number):unknown[]=>{if(!Array.isArray(v)||v.length<min||v.length>max)fail('invalid_list');return v;};
export function articleInput(value:unknown):Article{
  shape(value,['id','title','description','topic','verified','provenance','sources','related','blocks','concerns',...(record(value)&&'reviewedCorrections' in value?['reviewedCorrections']:[])]);
  const id=slug(value.id);const title=text(value.title,100);const description=text(value.description,240);
  if(typeof value.topic!=='string'||!['Foundations','Capabilities','Protocols'].includes(value.topic))fail('invalid_topic');
  const verified=text(value.verified,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(verified)||!Number.isFinite(Date.parse(verified))||new Date(verified).toISOString().slice(0,10)!==verified)fail('invalid_date');
  if(value.provenance!=='supplied-local-fixture')fail('unsupported_provenance');
  const sources=list(value.sources,1,8).map(source=>{
    shape(source,['id','title','url','publisher','context']);const url=text(source.url,500);
    try{if(validateSource(url)!==url||new URL(url).search)fail('unsafe_source_url');}catch{fail('unsafe_source_url');}
    return {id:slug(source.id,30),title:text(source.title,150),url,publisher:text(source.publisher,100),context:text(source.context,300)};
  });
  if(new Set(sources.map(s=>s.id)).size!==sources.length||new Set(sources.map(s=>s.url)).size!==sources.length)fail('duplicate_source');
  const used=new Set<string>();const headings=new Set<string>();let paragraphs=0;
  const blocks:Block[]=list(value.blocks,1,24).map(block=>{
    if(!record(block))return fail('invalid_block');
    if(block.type==='heading'){
      shape(block,['type','id','text']);const heading=slug(block.id,40);if(headings.has(heading))fail('duplicate_heading');headings.add(heading);
      return {type:'heading',id:heading,text:text(block.text,120)};
    }
    shape(block,['type','content']);if(block.type!=='paragraph')fail('unsupported_block');let citations=0;paragraphs++;
    const content:Inline[]=list(block.content,1,30).map(part=>{
      if(!record(part))return fail('invalid_inline');
      if(part.type==='text'){shape(part,['type','text']);return {type:'text',text:text(part.text,2000)};}
      if(part.type==='citation'){shape(part,['type','sourceId']);const sourceId=slug(part.sourceId,30);if(!sources.some(s=>s.id===sourceId))fail('unresolved_citation');used.add(sourceId);citations++;return {type:'citation',sourceId};}
      if(part.type==='article'){shape(part,['type','articleId','label']);return {type:'article',articleId:slug(part.articleId),label:text(part.label,100)};}
      return fail('unsupported_inline');
    });
    if(!citations||!content.some(p=>p.type==='text'&&p.text.length>=20))fail('missing_paragraph_evidence');return {type:'paragraph',content};
  });
  if(!paragraphs||sources.some(s=>!used.has(s.id)))fail('unused_or_missing_evidence');
  const related=list(value.related,1,6).map(v=>slug(v));if(new Set(related).size!==related.length||related.includes(id))fail('invalid_related');
  const flags=list(value.concerns,0,3).map(v=>{if(!(concerns as readonly unknown[]).includes(v)||v==='limited-source-coverage')fail('invalid_quality_concern');return v as Concern;});
  return {id,title,description,topic:value.topic as Article['topic'],verified,provenance:'supplied-local-fixture',sources,related,blocks,concerns:[...new Set(flags)].sort(),...(value.reviewedCorrections?{reviewedCorrections:correctionCredits(value.reviewedCorrections)}:{})};
}
export function commandInput(value:unknown):Command{
  let size=0;try{size=Buffer.byteLength(JSON.stringify(value));}catch{fail('invalid_schema');}if(size>publicationLimits.inputBytes)fail('input_too_large');
  if(!record(value)||value.schemaVersion!==1)fail('unsupported_schema');
  const eventId=text(value.eventId,80);if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(eventId))fail('invalid_event');
  if(value.kind==='publish'){
    shape(value,['schemaVersion','kind','eventId','baseRevision','article']);if(value.baseRevision!==null&&!digestId(value.baseRevision))fail('invalid_base_revision');
    return {schemaVersion:1,kind:'publish',eventId,baseRevision:value.baseRevision as string|null,article:articleInput(value.article)};
  }
  if(value.kind==='rollback'){
    shape(value,['schemaVersion','kind','eventId','expectedRelease','targetRelease']);if(!digestId(value.expectedRelease)||(value.targetRelease!==null&&!digestId(value.targetRelease)))fail('invalid_release');
    return {schemaVersion:1,kind:'rollback',eventId,expectedRelease:value.expectedRelease,targetRelease:value.targetRelease as string|null};
  }
  return fail('unsupported_command');
}
export const qualityFlags=(article:Article):Concern[]=>[...new Set([...article.concerns,...(article.sources.length<2?['limited-source-coverage' as Concern]:[])])].sort();
export function validateCrosslinks(article:Article,known:Set<string>){
  for(const id of [...article.related,...article.blocks.flatMap(b=>b.type==='paragraph'?b.content.flatMap(p=>p.type==='article'?[p.articleId]:[]):[])])if(!known.has(id))fail('unresolved_article_link');
}
