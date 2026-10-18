import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {existsSync,lstatSync,mkdirSync,readdirSync,openSync,closeSync,writeFileSync,fsyncSync,linkSync,unlinkSync,constants} from 'node:fs';
import {bounded,sync} from '../wiki-bridge/files.ts';
import {hash} from '../publishing/contracts.ts';
export class CollectionError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
export function stop(code:string):never{throw new CollectionError(code);}
export const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const collectionLimits=Object.freeze({rows:16,bodyBytes:2048,files:32});
const marker='local-synthetic-maintenance-source-collection-v1\n';
export class CollectionFiles {
 readonly root:string;readonly bodies:string;
 constructor(name:string){
  if(!/^maintenance-source-collection(?:-[a-z0-9]+)*$/.test(name)||name.length>80)stop('collection_unsafe_store');
  this.root=join(execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),name);this.bodies=join(this.root,'bodies');
  if(!existsSync(this.root)){mkdirSync(this.root);this.exclusive(join(this.root,'marker.txt'),Buffer.from(marker));sync(this.root);}
  if(lstatSync(this.root).isSymbolicLink()||!lstatSync(this.root).isDirectory())stop('collection_unsafe_store');
  try{if(bounded(join(this.root,'marker.txt'),128).toString()!==marker)stop('collection_unsafe_store');}catch{return stop('collection_unsafe_store');}
  if(!existsSync(this.bodies)){mkdirSync(this.bodies);sync(this.root);}this.check();
 }
 private exclusive(path:string,bytes:Buffer){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}}
 check(){
  if(lstatSync(this.root).isSymbolicLink()||!lstatSync(this.root).isDirectory()||lstatSync(this.bodies).isSymbolicLink()||!lstatSync(this.bodies).isDirectory())stop('collection_unsafe_store');
  if(readdirSync(this.root).sort().join(',')!=='bodies,marker.txt')stop('collection_unsafe_store');
  const names=readdirSync(this.bodies);if(names.length>collectionLimits.files)stop('collection_storage_capacity');
  for(const name of names){if(!/^[a-f0-9-]{36}\.txt(?:\.part)?$/.test(name)||!uuid(name.slice(0,36)))stop('collection_unsafe_store');const stat=lstatSync(join(this.bodies,name));if(!stat.isFile()||stat.isSymbolicLink()||stat.size>collectionLimits.bodyBytes)stop('collection_unsafe_store');}
 }
 file(key:string){if(!uuid(key))stop('collection_invalid_key');return key+'.txt';}
 begin(key:string){this.check();const path=join(this.bodies,this.file(key));if(existsSync(path)||existsSync(path+'.part'))stop('collection_orphan_body_unconfirmed');if(readdirSync(this.bodies).length+2>collectionLimits.files)stop('collection_storage_capacity');}
 read(key:string,digest:string,length:number){this.check();try{const bytes=bounded(join(this.bodies,this.file(key)),collectionLimits.bodyBytes);if(bytes.length!==length||hash(bytes)!==digest)stop('collection_body_corrupt');return bytes;}catch{return stop('collection_body_corrupt');}}
 put(key:string,bytes:Buffer){
  this.check();if(bytes.length<1||bytes.length>collectionLimits.bodyBytes)stop('collection_body_limit');const name=this.file(key),path=join(this.bodies,name);
  if(existsSync(path)){this.read(key,hash(bytes),bytes.length);return;}
  if(readdirSync(this.bodies).length+2>collectionLimits.files)stop('collection_storage_capacity');
  const pending=path+'.part';if(existsSync(pending))stop('collection_partial_unconfirmed');this.exclusive(pending,bytes);sync(this.bodies);
  linkSync(pending,path);sync(this.bodies);unlinkSync(pending);sync(this.bodies);
 }
}
