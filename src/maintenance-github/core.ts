import {maintenanceTarget} from '../maintenance-quality/target.ts';
import {readingArticleIds} from '../lib/article-ids.ts';
import {sha,stop,writerLimits,blobSha,hash,canonical} from './contracts.ts';
export type Entry={path:string;type:string;mode:string;sha:string};
export function leaves(value:any,expected:string):Map<string,Entry>{
 if(value?.sha!==expected||value.truncated!==false||!Array.isArray(value.tree)||value.tree.length>writerLimits.treeEntries)stop('writer_tree_rejected');const result=new Map<string,Entry>(),all=new Set<string>();
 for(const e of value.tree){if(typeof e.path!=='string'||e.path.length>240||!/^[A-Za-z0-9_./\[\]-]+$/.test(e.path)||e.path.split('/').some((p:string)=>!p||p==='.'||p==='..')||!sha(e.sha)||!['tree','blob','commit'].includes(e.type)||!['040000','100644','100755','120000','160000'].includes(e.mode)||all.has(e.path))stop('writer_tree_rejected');if(e.type==='tree'&&e.mode!=='040000'||e.type==='blob'&&!['100644','100755','120000'].includes(e.mode)||e.type==='commit'&&e.mode!=='160000')stop('writer_tree_rejected');all.add(e.path);if(e.type!=='tree')result.set(e.path,e);}
 for(const path of [...readingArticleIds.flatMap(id=>{const t=maintenanceTarget(id);return [t.articlePath,t.pointerPath];}),'src/content/maintenance/history/x.json'])for(const e of result.values())if(path.startsWith(e.path+'/'))stop('writer_unsafe_path');return result;
}
export function commit(value:any,oid:string){if(value?.sha!==oid||!sha(value.tree?.sha)||!Array.isArray(value.parents)||value.parents.some((p:any)=>!sha(p.sha))||typeof value.message!=='string')stop('writer_commit_rejected');return value;}
export function regular(tree:Map<string,Entry>,path:string){const entry=tree.get(path);if(!entry||entry.type!=='blob'||entry.mode!=='100644')stop('writer_regular_file_required');return entry;}
export function decodeBlob(value:any,oid:string,max:number){if(value?.sha!==oid||value.encoding!=='base64'||!Number.isSafeInteger(value.size)||value.size<1||value.size>max||typeof value.content!=='string'||value.content.length>max*2)stop('writer_blob_rejected');const encoded=value.content.replace(/\n/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))stop('writer_blob_rejected');const bytes=Buffer.from(encoded,'base64');if(bytes.length!==value.size)stop('writer_blob_rejected');let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return stop('writer_blob_rejected');}if(blobSha(text)!==oid)stop('writer_blob_rejected');return text;}

export function qualifiedCanonicalCodeHash(tree:Map<string,Entry>){
 const files=[...tree.values()].filter(e=>(e.path.startsWith('src/')||e.path.startsWith('public/')||['astro.config.mjs','package.json','package-lock.json','tsconfig.json','.nvmrc','scripts/wiki-bridge-build.mjs','scripts/maintenance-review-build.mjs'].includes(e.path))&&!/^src\/content\/(articles\/|maintenance\/)/.test(e.path));
 if(!files.length||files.some(e=>e.type!=='blob'||e.mode!=='100644'))stop('native_unqualified_canonical_code');
 return hash(canonical(files.sort((a,b)=>a.path.localeCompare(b.path,'en'))));
}
