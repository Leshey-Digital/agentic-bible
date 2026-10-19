import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecoveryBackup,restoreRecoveryBackup} from '../../src/recovery/backup.ts';
import {loadEncryptedRecovery,recoveryConfiguration,storeEncryptedRecovery} from '../../src/recovery/cloudflare.ts';

const commit='b'.repeat(40),capturedAt='2026-10-19T06:00:00.000Z';
class MemoryBucket{
 objects=new Map();deleted=[];
 async put(key,value){this.objects.set(key,Buffer.from(value.buffer??value,value.byteOffset??0,value.byteLength??value.length));}
 async get(key){const bytes=this.objects.get(key);return bytes?{size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null;}
 async list({prefix,cursor,limit=1000}){const keys=[...this.objects.keys()].filter(k=>k.startsWith(prefix)&&(!cursor||k>cursor)).sort().slice(0,limit);return {objects:keys.map(key=>({key})),truncated:false};}
 async delete(key){this.deleted.push(key);this.objects.delete(key);}
}
const key=Buffer.from(Array.from({length:32},(_,i)=>i+1)).toString('base64url');
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'ab-offsite-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

test('configuration keeps the adapter disabled until explicit opt-in and required bindings exist',async()=>{
 assert.equal((await recoveryConfiguration({})).reason,'disabled');
 assert.equal((await recoveryConfiguration({RECOVERY_BACKUP_ENABLED:'true'})).reason,'bucket_missing');
 assert.equal((await recoveryConfiguration({RECOVERY_BACKUP_ENABLED:'true',RECOVERY_BACKUP_BUCKET:new MemoryBucket()})).reason,'key_missing');
 assert.equal((await recoveryConfiguration({RECOVERY_BACKUP_ENABLED:'true',RECOVERY_BACKUP_BUCKET:new MemoryBucket(),RECOVERY_BACKUP_ENCRYPTION_KEY:'bad'})).reason,'key_invalid');
});

test('encrypted offsite object authenticates, verifies, and restores the source bundle',async t=>{
 const root=await fixture(t);await mkdir(join(root,'assets'));await writeFile(join(root,'assets','reader.js'),Buffer.from([0,1,2,255]));
 const backup=await createRecoveryBackup(root,commit,capturedAt),payload=new TextEncoder().encode(JSON.stringify(backup)),bucket=new MemoryBucket();
 const config=await recoveryConfiguration({RECOVERY_BACKUP_ENABLED:'true',RECOVERY_BACKUP_BUCKET:bucket,RECOVERY_BACKUP_ENCRYPTION_KEY:key});
 const stored=await storeEncryptedRecovery(config,payload,{sourceCommit:commit,capturedAt});
 assert.match(stored.key,/^agentic-bible\/recovery\/v1\/2026-10-19\/daily\.enc\.json$/);
 assert.equal(stored.retentionDays,7);assert.equal(stored.removed,0);
 const encrypted=await bucket.get(stored.key),ciphertext=Buffer.from(await encrypted.arrayBuffer()).toString('utf8');
 assert.equal(ciphertext.includes('reader.js'),false);assert.equal(ciphertext.includes(Buffer.from([0,1,2,255]).toString('base64')),false);
 const loaded=await loadEncryptedRecovery(config,stored.key),restoredBundle=JSON.parse(new TextDecoder().decode(loaded.payload)),destination=join(root,'restored');
 const receipt=await restoreRecoveryBackup(restoredBundle,destination);
 assert.equal(receipt.sourceCommit,commit);assert.deepEqual(await readFile(join(destination,'assets','reader.js')),Buffer.from([0,1,2,255]));
});

test('rejects modified ciphertext, wrong keys and objects outside the configured prefix',async()=>{
 const bucket=new MemoryBucket(),payload=new TextEncoder().encode('{"kind":"test"}'),metadata={sourceCommit:commit,capturedAt};
 const config=await recoveryConfiguration({RECOVERY_BACKUP_ENABLED:'true',RECOVERY_BACKUP_BUCKET:bucket,RECOVERY_BACKUP_ENCRYPTION_KEY:key});
 const stored=await storeEncryptedRecovery(config,payload,metadata),bytes=bucket.objects.get(stored.key);bytes[bytes.length-4]^=1;
 await assert.rejects(loadEncryptedRecovery(config,stored.key),/recovery_authentication_failed/);
 await assert.rejects(loadEncryptedRecovery(config,'other/2026-10-19/daily.enc.json'),/recovery_adapter_unconfigured/);
 const wrong=await recoveryConfiguration({RECOVERY_BACKUP_ENABLED:'true',RECOVERY_BACKUP_BUCKET:bucket,RECOVERY_BACKUP_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64url')});
 await assert.rejects(loadEncryptedRecovery(wrong,stored.key),/recovery_encryption_key_mismatch/);
});

test('uses a provisional seven-day UTC retention window and removes only expired managed keys',async()=>{
 const bucket=new MemoryBucket();
 bucket.objects.set('agentic-bible/recovery/v1/2026-10-11/daily.enc.json',Buffer.from('expired'));
 bucket.objects.set('agentic-bible/recovery/v1/2026-10-12/daily.enc.json',Buffer.from('expired'));
 bucket.objects.set('agentic-bible/recovery/v1/2026-10-13/daily.enc.json',Buffer.from('boundary'));
 bucket.objects.set('other/2026-10-01/daily.enc.json',Buffer.from('unmanaged'));
 const config=await recoveryConfiguration({RECOVERY_BACKUP_ENABLED:'true',RECOVERY_BACKUP_BUCKET:bucket,RECOVERY_BACKUP_ENCRYPTION_KEY:key});
 const stored=await storeEncryptedRecovery(config,new TextEncoder().encode('{}'),{sourceCommit:commit,capturedAt});
 assert.deepEqual(bucket.deleted,['agentic-bible/recovery/v1/2026-10-11/daily.enc.json','agentic-bible/recovery/v1/2026-10-12/daily.enc.json']);
 assert.equal(stored.retentionDays,7);assert.equal(bucket.objects.has('agentic-bible/recovery/v1/2026-10-13/daily.enc.json'),true);
});
