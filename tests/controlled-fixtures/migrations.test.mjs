import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {migrationStatements} from '../support/migration-statements.mjs';

test('all repository migrations retain complete triggers and match SQLite whole-file application',()=>{
 const whole=new DatabaseSync(':memory:'),separate=new DatabaseSync(':memory:');
 try{
  for(const file of readdirSync('migrations').filter(name=>name.endsWith('.sql')).sort()){
   const sql=readFileSync('migrations/'+file,'utf8');whole.exec(sql);
   for(const statement of migrationStatements(sql))separate.prepare(statement).run();
  }
  const schema=db=>db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  assert.deepEqual(schema(separate),schema(whole));
  assert.equal(separate.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'maintenance_quality_%'").get().n,2);
  assert.throws(()=>migrationStatements('CREATE TABLE incomplete(id TEXT)'),/incomplete repository migration/);
 }finally{whole.close();separate.close();}
});
