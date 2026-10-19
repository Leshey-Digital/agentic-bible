import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const schema=readFileSync('migrations/0019_integration_vault.sql','utf8');
const upgrade=readFileSync('migrations/0023_jev_integration_vault.sql','utf8');
test('atomic Jev vault upgrade preserves existing opaque ciphertext and crash lock; failure rolls back',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(schema);
  db.prepare('INSERT INTO integration_vault VALUES(?,?,?,?,?)').run('github-content','synthetic-key','{}','abcdefghijklmnop','x'.repeat(24));
  db.prepare('INSERT INTO integration_vault_locks VALUES(?,?,?)').run('github-content','synthetic-retained-crash-lock',1);
  const row=db.prepare('SELECT * FROM integration_vault').get(),lock=db.prepare('SELECT * FROM integration_vault_locks').get();
  assert.throws(()=>db.exec('BEGIN;'+upgrade+'SELECT * FROM synthetic_missing_upgrade_guard;'));
  db.exec('ROLLBACK;');
  assert.deepEqual(db.prepare('SELECT * FROM integration_vault').get(),row);
  assert.deepEqual(db.prepare('SELECT * FROM integration_vault_locks').get(),lock);
  assert.throws(()=>db.prepare('INSERT INTO integration_vault_locks VALUES(?,?,?)').run('typesafe-jev','synthetic',2));
  db.exec('BEGIN;'+upgrade+'COMMIT;');
  assert.deepEqual(db.prepare('SELECT * FROM integration_vault').get(),row);
  assert.deepEqual(db.prepare('SELECT * FROM integration_vault_locks').get(),lock);
  db.prepare('INSERT INTO integration_vault_locks VALUES(?,?,?)').run('typesafe-jev','synthetic-new-lock',2);
  assert.throws(()=>db.prepare('INSERT INTO integration_vault_locks VALUES(?,?,?)').run('unknown-provider','synthetic',3));
 }finally{db.close();}
});
