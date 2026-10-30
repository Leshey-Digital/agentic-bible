import {readingArticleIds} from '../lib/article-ids.ts';

export type Signal =
  | {event:'page_view'}
  | {event:'search_complete';results:'none'|'few'|'many';expanded:boolean}
  | {event:'search_select';article:string}
  | {event:'contribution_open'}
  | {event:'contribution_result';outcome:'closed'|'saved'|'duplicate'|'rejected'|'unconfirmed'}
  | {event:'reader_error';component:'reader'|'search'|'contribution'};
export type Context={origin:string;pathname:string;consent:'granted'|'denied';dnt?:string|null;gpc?:boolean};
export type Measurement={schemaVersion:1;day:string;page:string;signal:Signal};
export type Recorder=(signal:unknown,context:Context)=>boolean;
const articles=new Set<string>(readingArticleIds);
const fixedPages=new Set(['/','/about/','/history/','/topics/','/topics/foundations/','/topics/capabilities/','/topics/protocols/','/search/','/contribute/']);
function page(path:string):string|null {
  if(fixedPages.has(path))return path;
  const id=/^\/articles\/([a-z-]+)\/$/.exec(path)?.[1];
  return id&&articles.has(id)?`/articles/${id}/`:null;
}
function checkedSignal(input:unknown,path:string):Signal|null {
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const s=input as Record<string,unknown>,keys=Object.keys(s).sort().join(',');
  if(keys==='event'&&s.event==='page_view'&&path!=='/contribute/')return {event:s.event};
  if(path==='/search/'){
    if(keys==='event,expanded,results'&&s.event==='search_complete'&&['none','few','many'].includes(String(s.results))&&typeof s.expanded==='boolean')return {event:s.event,results:s.results as 'none'|'few'|'many',expanded:s.expanded};
    if(keys==='article,event'&&s.event==='search_select'&&typeof s.article==='string'&&articles.has(s.article))return {event:s.event,article:s.article};
  }
  if(path==='/contribute/'){
    if(keys==='event'&&s.event==='contribution_open')return {event:s.event};
    if(keys==='event,outcome'&&s.event==='contribution_result'&&['closed','saved','duplicate','rejected','unconfirmed'].includes(String(s.outcome)))return {event:s.event,outcome:s.outcome as 'closed'|'saved'|'duplicate'|'rejected'|'unconfirmed'};
  }
  if(keys==='component,event'&&s.event==='reader_error'&&
    ((s.component==='search'&&path==='/search/')||(s.component==='contribution'&&path==='/contribute/')||(s.component==='reader'&&!['/search/','/contribute/'].includes(path))))return {event:s.event,component:s.component as 'reader'|'search'|'contribution'};
  return null;
}

// Preparation only: no caller in the public application supplies enabled=true or
// a sink. No network, cookies, storage, IDs, query text or error messages here.
export function createRecorder(options:{enabled:boolean;origin:'https://agenticbible.si'|'http://127.0.0.1';sink:(row:Measurement)=>void;now?:()=>number}):Recorder {
  let admitted=0,failed=false;
  return (input,context)=>{
    if(options.enabled!==true||!['https://agenticbible.si','http://127.0.0.1'].includes(options.origin)||failed||admitted>=32||context.origin!==options.origin||context.consent!=='granted'||context.dnt==='1'||context.gpc===true)return false;
    const path=page(context.pathname);if(!path)return false;
    const signal=checkedSignal(input,path);if(!signal)return false;
    const now=(options.now??Date.now)();if(!Number.isFinite(now)||now<0||now>8.64e15)return false;
    const row:Measurement={schemaVersion:1,day:new Date(now).toISOString().slice(0,10),page:path,signal};
    ++admitted; // Never retry a sink with an unknown outcome.
    try{options.sink(row);return true;}catch{failed=true;return false;}
  };
}

// Disposable local preview sink. Counts events, never unique people or sessions.
// Capacity stops new cells; it never evicts retained counters or grows unbounded.
export function aggregatePreview(){
  const cells=new Map<string,{measurement:Measurement;count:number}>();
  return {
    sink(row:Measurement){const key=JSON.stringify(row),cell=cells.get(key);if(cell){if(cell.count>=10000)throw new Error('measurement_counter_capacity');++cell.count;}else{if(cells.size>=128)throw new Error('measurement_cell_capacity');cells.set(key,{measurement:structuredClone(row),count:1});}},
    snapshot(){return [...cells.values()].map(cell=>structuredClone(cell));},
  };
}
