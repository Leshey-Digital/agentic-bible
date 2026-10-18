import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {join} from 'node:path';
import {bounded} from '../../src/wiki-bridge/files.ts';
import {git} from './helpers.mjs';

test('bounded file reads allocate for actual size, retain the ceiling and reject nonregular/symlink inputs',()=>{
  const root=fs.mkdtempSync(join(git,'wiki-bridge-test-bounded-')),file=join(root,'small'),link=join(root,'link');fs.writeFileSync(file,'small known bytes');fs.symlinkSync(file,link);
  const alloc=Buffer.alloc;let capacity=0;Buffer.alloc=function(n,...args){capacity+=n;return alloc(n,...args)};
  try{assert.equal(bounded(file,16*1024*1024).toString(),'small known bytes');assert.ok(capacity<=18,'tiny file must not reserve sixteen MiB');capacity=0;assert.throws(()=>bounded(file,2),{code:'bounded_file_too_large'});assert.equal(capacity,0);assert.throws(()=>bounded(link,1024));assert.throws(()=>bounded(root,1024),{code:'bounded_file_not_regular'});}
  finally{Buffer.alloc=alloc;fs.rmSync(root,{recursive:true,force:true});}
});
test('bounded reads fail closed when an open regular file grows or shrinks',()=>{
  const root=fs.mkdtempSync(join(git,'wiki-bridge-test-changing-')),file=join(root,'data'),read=fs.readSync;
  try{for(const change of ['grow','shrink']){fs.writeFileSync(file,'four');let changed=false;fs.readSync=function(...args){const n=read(...args);if(!changed){changed=true;change==='grow'?fs.appendFileSync(file,'more'):fs.truncateSync(file,2);}return n;};syncBuiltinESMExports();assert.throws(()=>bounded(file,1024),{code:'bounded_file_changed'});fs.readSync=read;syncBuiltinESMExports();}}
  finally{fs.readSync=read;syncBuiltinESMExports();fs.rmSync(root,{recursive:true,force:true});}
});
test('short reads return only initialized file bytes and close the descriptor after a read failure',()=>{
  const root=fs.mkdtempSync(join(git,'wiki-bridge-test-short-read-')),file=join(root,'data'),read=fs.readSync,close=fs.closeSync;fs.writeFileSync(file,'known complete bytes');let closed=0;
  try{fs.readSync=function(fd,buffer,offset,length,position){return read(fd,buffer,offset,Math.min(length,2),position)};fs.closeSync=function(...args){closed++;return close(...args)};syncBuiltinESMExports();assert.equal(bounded(file,1024).toString(),'known complete bytes');assert.equal(closed,1);
    fs.readSync=()=>{throw Error('controlled read fault')};syncBuiltinESMExports();assert.throws(()=>bounded(file,1024));assert.equal(closed,2);
  }finally{fs.readSync=read;fs.closeSync=close;syncBuiltinESMExports();fs.rmSync(root,{recursive:true,force:true});}
});
