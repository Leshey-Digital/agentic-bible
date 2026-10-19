import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,readdir,open,mkdir,writeFile,rm} from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const MAX_FILES=4096,MAX_BYTES=64*1024*1024;
const SHA=/^[a-f0-9]{64}$/;
const SOURCE=/^[a-f0-9]{40}$/;
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const fail=(code:string):never=>{throw Object.assign(new Error(code),{code});};
type FileSnapshot={dev:bigint;ino:bigint;size:bigint;mtimeNs:bigint;ctimeNs:bigint};
const sameFile=(a:FileSnapshot,b:FileSnapshot)=>
 a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;

export type RecoveryEntry={path:string;size:number;sha256:string};
export type RecoveryManifest={schemaVersion:1;kind:'agentic-bible-recovery';sourceCommit:string;capturedAt:string;fileCount:number;totalBytes:number;files:RecoveryEntry[]};
export type RecoveryBackup={manifest:RecoveryManifest;files:Record<string,string>};

function safePath(path:string){
 if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||path.includes('\0')||path.split('/').some(p=>!p||p==='.'||p==='..')||path.length>512)fail('recovery_path_invalid');
}
function exactObject(value:any,keys:string[]){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');}

async function readRegularFileNoFollow(path:string,expected:{dev:bigint;ino:bigint},remaining:number){
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const before=await handle.stat({bigint:true});
  if(!before.isFile()||before.dev!==expected.dev||before.ino!==expected.ino)fail('recovery_file_changed');
  if(before.size>BigInt(remaining))fail('recovery_byte_limit');
  const chunks:Buffer[]=[];let length=0;
  while(length<=remaining){
   const buffer=Buffer.allocUnsafe(Math.min(64*1024,remaining-length+1));
   const {bytesRead}=await handle.read(buffer,0,buffer.length,null);
   if(bytesRead===0)break;
   length+=bytesRead;if(length>remaining)fail('recovery_byte_limit');
   chunks.push(buffer.subarray(0,bytesRead));
  }
  const after=await handle.stat({bigint:true});
  if(!sameFile(before,after)||BigInt(length)!==before.size)fail('recovery_file_changed');
  return Buffer.concat(chunks,length);
 }finally{await handle.close();}
}

function descriptorPath(directory:FileHandle){
 if(process.platform!=='linux')fail('recovery_descriptor_traversal_unsupported');
 return `/proc/self/fd/${directory.fd}`;
}

/** Capture a portable, content-verified copy of a tree without following symlinks. */
export async function createRecoveryBackup(root:string,sourceCommit:string,capturedAt=new Date().toISOString()):Promise<RecoveryBackup>{
 if(!SOURCE.test(sourceCommit))fail('recovery_source_commit_invalid');
 if(typeof capturedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(capturedAt)||!Number.isFinite(Date.parse(capturedAt))||new Date(capturedAt).toISOString()!==capturedAt)fail('recovery_timestamp_invalid');
 const base=resolve(root),rootInfo=await lstat(base,{bigint:true}),entries:RecoveryEntry[]=[],files:Record<string,string>=Object.create(null);let total=0;
 if(rootInfo.isSymbolicLink()||!rootInfo.isDirectory())fail('recovery_root_invalid');
 const rootHandle=await open(base,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_DIRECTORY);
 try{
  const openedRoot=await rootHandle.stat({bigint:true});
  if(!openedRoot.isDirectory()||openedRoot.dev!==rootInfo.dev||openedRoot.ino!==rootInfo.ino)fail('recovery_root_changed');
  async function walk(dir:FileHandle,prefix:string){
   const dirPath=descriptorPath(dir);
   for(const item of (await readdir(dirPath,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const path=prefix?`${prefix}/${item.name}`:item.name;safePath(path);
    const abs=join(dirPath,item.name),info=await lstat(abs,{bigint:true});
   if(info.isSymbolicLink())fail('recovery_symlink_unsupported');
    if(info.isDirectory()){
     const child=await open(abs,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_DIRECTORY);
     try{const opened=await child.stat({bigint:true});if(!opened.isDirectory()||opened.dev!==info.dev||opened.ino!==info.ino)fail('recovery_directory_changed');await walk(child,path);}finally{await child.close();}
     continue;
    }
    if(!info.isFile())fail('recovery_special_file_unsupported');
    if(entries.length>=MAX_FILES)fail('recovery_file_limit');
    if(info.size>BigInt(MAX_BYTES-total))fail('recovery_byte_limit');
    const bytes=await readRegularFileNoFollow(abs,info,MAX_BYTES-total);total+=bytes.length;
    entries.push({path,size:bytes.length,sha256:digest(bytes)});files[path]=bytes.toString('base64');
   }
  }
  await walk(rootHandle,'');entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(entries.length===0)fail('recovery_empty_tree');
  return {manifest:{schemaVersion:1,kind:'agentic-bible-recovery',sourceCommit,capturedAt,fileCount:entries.length,totalBytes:total,files:entries},files};
 }finally{await rootHandle.close();}
}

export function verifyRecoveryBackup(value:unknown):RecoveryBackup{
 if(!exactObject(value,['manifest','files']))fail('recovery_bundle_schema');
 const m=(value as any).manifest,f=(value as any).files;
 if(!exactObject(m,['schemaVersion','kind','sourceCommit','capturedAt','fileCount','totalBytes','files'])||m.schemaVersion!==1||m.kind!=='agentic-bible-recovery'||!SOURCE.test(m.sourceCommit)||typeof m.capturedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.capturedAt)||!Number.isFinite(Date.parse(m.capturedAt))||new Date(m.capturedAt).toISOString()!==m.capturedAt||!Number.isSafeInteger(m.fileCount)||m.fileCount<1||m.fileCount>MAX_FILES||!Number.isSafeInteger(m.totalBytes)||m.totalBytes<0||m.totalBytes>MAX_BYTES||!Array.isArray(m.files)||m.files.length!==m.fileCount||!f||typeof f!=='object'||Array.isArray(f)||Object.getPrototypeOf(f)!==Object.prototype&&Object.getPrototypeOf(f)!==null)fail('recovery_bundle_schema');
 if(Object.keys(f).length!==m.fileCount)fail('recovery_inventory_mismatch');
 let total=0,last='';
 for(const e of m.files){
  if(!exactObject(e,['path','size','sha256']))fail('recovery_bundle_schema');safePath(e.path);
  if(e.path<=last)fail('recovery_inventory_order');last=e.path;
  if(!Number.isSafeInteger(e.size)||e.size<0||!SHA.test(e.sha256)||typeof f[e.path]!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f[e.path]))fail('recovery_bundle_schema');
  const bytes=Buffer.from(f[e.path],'base64');if(bytes.length!==e.size||digest(bytes)!==e.sha256)fail('recovery_file_digest_mismatch');total+=bytes.length;
  if(total>MAX_BYTES)fail('recovery_byte_limit');
 }
 if(total!==m.totalBytes)fail('recovery_inventory_mismatch');
 return value as RecoveryBackup;
}

/** Restore only after full verification, into a destination that does not yet exist. */
export async function restoreRecoveryBackup(value:unknown,destination:string){
 const backup=verifyRecoveryBackup(value),target=resolve(destination);
 await mkdir(target,{recursive:false});
 try{
  for(const entry of backup.manifest.files){
   const path=join(target,...entry.path.split('/')),parent=join(path,'..');
   await mkdir(parent,{recursive:true});
   await writeFile(path,Buffer.from(backup.files[entry.path],'base64'),{flag:'wx',mode:0o600});
  }
 }catch(error){await rm(target,{recursive:true,force:true});throw error;}
 return {sourceCommit:backup.manifest.sourceCommit,fileCount:backup.manifest.fileCount,totalBytes:backup.manifest.totalBytes};
}
