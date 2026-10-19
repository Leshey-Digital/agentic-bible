import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink,truncate} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecoveryBackup,restoreRecoveryBackup} from '../../src/recovery/backup.ts';

const commit='a'.repeat(40),time='2026-10-19T12:00:00.000Z';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'ab-recovery-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

test('backup verifies complete inventory and restores exact bytes into a new tree',async t=>{
 const root=await fixture(t);await mkdir(join(root,'assets'));await writeFile(join(root,'index.html'),'<h1>Local</h1>');await writeFile(join(root,'assets','app.js'),Buffer.from([0,1,2,255]));
 const backup=await createRecoveryBackup(root,commit,time),destination=join(root,'restored');
 assert.deepEqual(backup.manifest.files.map(x=>x.path),['assets/app.js','index.html']);
 const receipt=await restoreRecoveryBackup(backup,destination);assert.equal(receipt.fileCount,2);assert.equal(receipt.sourceCommit,commit);
 assert.deepEqual(await readFile(join(destination,'index.html')),Buffer.from('<h1>Local</h1>'));assert.deepEqual(await readFile(join(destination,'assets','app.js')),Buffer.from([0,1,2,255]));
});

test('rejects tampered, omitted and extra files before creating a restore destination',async t=>{
 const root=await fixture(t);await writeFile(join(root,'a.txt'),'payload');const b=await createRecoveryBackup(root,commit,time),dest=join(root,'out');
 for(const changed of [ {...b,files:{}}, {...b,files:{...b.files,'extra':'eA=='}}, {...b,files:{...b.files,'a.txt':'cGF5bG9hZA=='} ,manifest:{...b.manifest,files:[{...b.manifest.files[0],sha256:'0'.repeat(64)}]}} ])
  await assert.rejects(restoreRecoveryBackup(changed,dest),/recovery_/);
 await assert.rejects(readFile(dest));
});

test('rejects traversal paths and never overwrites an existing destination',async t=>{
 const root=await fixture(t);await writeFile(join(root,'a'),'x');const b=await createRecoveryBackup(root,commit,time),dest=join(root,'existing');await mkdir(dest);await writeFile(join(dest,'keep'),'safe');
 const malicious=structuredClone(b);malicious.manifest.files[0].path='../outside';
 await assert.rejects(restoreRecoveryBackup(malicious,join(root,'bad')),/recovery_path_invalid/);
 await assert.rejects(restoreRecoveryBackup(b,dest));assert.equal(await readFile(join(dest,'keep'),'utf8'),'safe');
});

test('refuses symlinks during capture',async t=>{
 const root=await fixture(t),outside=join(root,'outside');await writeFile(outside,'secret');await symlink(outside,join(root,'link'));
 await assert.rejects(createRecoveryBackup(root,commit,time),/recovery_symlink_unsupported/);
 const rootLink=join(root,'root-link');await symlink(root,rootLink);await assert.rejects(createRecoveryBackup(rootLink,commit,time),/recovery_root_invalid/);
});

test('rejects oversized regular files before reading them into the recovery bundle',async t=>{
 const root=await fixture(t),large=join(root,'large.bin');await writeFile(large,'x');await truncate(large,64*1024*1024+1);
 await assert.rejects(createRecoveryBackup(root,commit,time),/recovery_byte_limit/);
});
