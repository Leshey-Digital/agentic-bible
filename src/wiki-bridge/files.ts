import {writeFileSync,readdirSync,lstatSync,mkdirSync,renameSync,openSync,closeSync,readSync,fsyncSync,constants} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {canonical,hash} from '../publishing/contracts.ts';
import {bridgeLimits,reject} from './limits.ts';
export const safePath=(path:string)=>path.length<240&&/^[a-zA-Z0-9_./-]+$/.test(path)&&path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');
export function bounded(path:string,max:number):Buffer{
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const data=Buffer.alloc(max+1);let length=0;while(length<data.length){const n=readSync(fd,data,length,data.length-length,null);if(!n)break;length+=n;}if(length>max)reject('bounded_file_too_large');return data.subarray(0,length);}finally{closeSync(fd);}
}
export function sync(path:string){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
export function write(path:string,value:string|Uint8Array){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,value);sync(path);}
export function atomic(path:string,value:unknown){write(path+'.tmp',canonical(value));renameSync(path+'.tmp',path);sync(dirname(path));}
export function walk(root:string):string[]{return readdirSync(root).sort().flatMap(name=>{const path=join(root,name);const stat=lstatSync(path);if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))reject('unsafe_bridge_store');return stat.isDirectory()?walk(path):[path];});}
export function inventory(root:string){const files:Record<string,{sha256:string;bytes:number}>={};let total=0;for(const path of walk(root)){const name=relative(root,path);if(!safePath(name))reject('unsafe_bridge_store');const value=bounded(path,bridgeLimits.siteBytes);total+=value.length;if(total>bridgeLimits.siteBytes||Object.keys(files).length>=1024)reject('site_artifact_too_large');files[name]={sha256:hash(value),bytes:value.length};}return files;}
export function syncTree(root:string){const visit=(dir:string)=>{for(const name of readdirSync(dir)){const path=join(dir,name);const stat=lstatSync(path);if(stat.isSymbolicLink())reject('unsafe_bridge_store');if(stat.isDirectory())visit(path);else sync(path);}sync(dir);};visit(root);}
export function projectFiles(root:string){
  const paths=['astro.config.mjs','package.json','package-lock.json','tsconfig.json','.nvmrc','scripts/wiki-bridge-build.mjs',...walk(join(root,'src')).map(path=>relative(root,path)),...walk(join(root,'public')).map(path=>relative(root,path))].sort();
  const files:Record<string,Buffer>={};let bytes=0;if(paths.length>512)reject('project_snapshot_too_large');
  for(const path of paths){const value=bounded(join(root,path),bridgeLimits.projectBytes);bytes+=value.length;if(bytes>bridgeLimits.projectBytes)reject('project_snapshot_too_large');files[path]=value;}
  return {files,hash:hash(canonical(Object.fromEntries(Object.entries(files).map(([path,value])=>[path,hash(value)]))))};
}
export const json=(path:string,max=1024*1024):any=>JSON.parse(bounded(path,max).toString('utf8'));
