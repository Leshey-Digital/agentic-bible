import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createD1RecoveryBackup,restoreD1RecoveryBackup,verifyD1RecoveryBackup} from '../../src/recovery/d1.ts';

const commit='c'.repeat(40),capturedAt='2026-10-19T12:00:00.000Z';
const authorizeSchema=async(manifest,schema)=>manifest.sourceCommit===commit&&schema.length>=2;
const options=(name,root)=>({...convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-10-16',d1Databases:{DB:name}}),cf:false,resourcePersistencePath:root});
async function database(t,name='d1-recovery'){
  const root=mkdtempSync(join(tmpdir(),'ab-d1-recovery-'));let mf=new Miniflare(options(name,root)),db=await mf.getD1Database('DB');
  t.after(async()=>{await mf.dispose();rmSync(root,{recursive:true,force:true});});
  return {get db(){return db;},async restart(){await mf.dispose();mf=new Miniflare(options(name,root));db=await mf.getD1Database('DB');return db;}};
}
async function seed(db){
  await db.batch([
    db.prepare('CREATE TABLE parent(id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL UNIQUE, payload BLOB, score REAL, optional TEXT)'),
    db.prepare('CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id), value TEXT)'),
    db.prepare('CREATE INDEX child_parent_idx ON child(parent_id)'),
    db.prepare('CREATE VIEW parent_labels AS SELECT id,label FROM parent'),
    db.prepare('CREATE TRIGGER parent_label_guard BEFORE INSERT ON parent WHEN NEW.label = \'blocked\' BEGIN SELECT RAISE(ABORT, \'blocked\'); END'),
    db.prepare('INSERT INTO parent(label,payload,score,optional) VALUES(?,?,?,?)').bind('first',new Uint8Array([0,1,255]).buffer,1.25,null),
    db.prepare('INSERT INTO parent(label,payload,score,optional) VALUES(?,?,?,?)').bind('deleted-id',new Uint8Array([9]).buffer,2.5,'set'),
    db.prepare('DELETE FROM parent WHERE label=?').bind('deleted-id'),
    db.prepare('INSERT INTO child(id,parent_id,value) VALUES(?,?,?)').bind(9,1,'child before parent alphabetically')
  ]);
}
async function rehash(value){const payload=JSON.stringify(value.payload),bytes=new TextEncoder().encode(payload),digest=await crypto.subtle.digest('SHA-256',bytes);value.manifest.payloadBytes=bytes.length;value.manifest.payloadSha256=[...new Uint8Array(digest)].map((x)=>x.toString(16).padStart(2,'0')).join('');return value;}

test('D1 recovery captures complete typed schema/data and restores into a new D1 database across restart',{timeout:30000},async(t)=>{
  const source=await database(t,'d1-recovery-source'),destination=await database(t,'d1-recovery-destination');await seed(source.db);
  const encoded=await createD1RecoveryBackup(source.db,commit,capturedAt),manifest=await verifyD1RecoveryBackup(encoded);
  assert.equal(manifest.tableCount,2);assert.equal(manifest.rowCount,2);
  await assert.rejects(restoreD1RecoveryBackup(destination.db,encoded),/d1_recovery_schema_not_authorized/);
  const receipt=await restoreD1RecoveryBackup(destination.db,encoded,{authorizeSchema});assert.deepEqual(receipt,{sourceCommit:commit,capturedAt,tableCount:2,rowCount:2,restored:true});
  assert.equal((await destination.db.prepare('SELECT * FROM parent_labels').all()).results.length,1);
  assert.equal((await destination.db.prepare('SELECT value FROM child').first()).value,'child before parent alphabetically');
  const parent=await destination.db.prepare('SELECT * FROM parent').first();assert.deepEqual([...new Uint8Array(parent.payload)],[0,1,255]);assert.equal(parent.optional,null);
  await destination.db.prepare('INSERT INTO parent(label) VALUES(?)').bind('after-restore').run();
  assert.equal((await destination.db.prepare('SELECT id FROM parent WHERE label=?').bind('after-restore').first()).id,3,'AUTOINCREMENT high-water mark survives deleted rows');
  const restored=await destination.restart();assert.equal((await restored.prepare('SELECT COUNT(*) n FROM child').first()).n,1);assert.equal((await restored.prepare('SELECT COUNT(*) n FROM parent').first()).n,2);
});

test('one D1 batch gives a point-in-time snapshot while concurrent atomic writers mutate paired tables',{timeout:30000},async(t)=>{
  const source=await database(t,'d1-recovery-race');await source.db.batch([
    source.db.prepare('CREATE TABLE left_counter(value INTEGER NOT NULL)'),source.db.prepare('CREATE TABLE right_counter(value INTEGER NOT NULL)'),source.db.prepare('INSERT INTO left_counter VALUES(0)'),source.db.prepare('INSERT INTO right_counter VALUES(0)')
  ]);
  const writes=Array.from({length:18},(_,i)=>source.db.batch([
    source.db.prepare('UPDATE left_counter SET value=?').bind(i+1),source.db.prepare('UPDATE right_counter SET value=?').bind(i+1)
  ]));
  const snapshots=Array.from({length:18},(_,i)=>createD1RecoveryBackup(source.db,commit,new Date(Date.UTC(2026,9,19,12,0,i)).toISOString()));
  const completed=await Promise.all([...writes,...snapshots]),backups=completed.slice(writes.length);
  for(const backup of backups){const parsed=JSON.parse(backup),left=parsed.payload.tables.find(x=>x.name==='left_counter').rows[0][0].value,right=parsed.payload.tables.find(x=>x.name==='right_counter').rows[0][0].value;assert.equal(left,right,'a snapshot must never combine values from opposite sides of one atomic writer batch');}
});

test('corrupt, truncated, oversized and schema-drift exports fail closed without modifying destination',{timeout:30000},async(t)=>{
  const source=await database(t,'d1-recovery-corrupt-source'),destination=await database(t,'d1-recovery-corrupt-dest');await seed(source.db);
  const encoded=await createD1RecoveryBackup(source.db,commit,capturedAt);
  await assert.rejects(verifyD1RecoveryBackup(encoded.slice(0,-10)),/d1_recovery_invalid_export/);
  const changed=JSON.parse(encoded),parent=changed.payload.tables.find((item)=>item.name==='parent');parent.rows[0][parent.columns.indexOf('label')].value='other';await assert.rejects(restoreD1RecoveryBackup(destination.db,changed,{authorizeSchema}),/d1_recovery_digest_mismatch/);
  await assert.rejects(restoreD1RecoveryBackup(destination.db,' '.repeat(32*1024*1024+1)),/d1_recovery_size_limit/);
  await source.db.prepare('CREATE TABLE later(id INTEGER)').run();let injectNextSchemaRead=true;const driftDb={
    prepare(sql){const statement=source.db.prepare(sql);if(injectNextSchemaRead&&sql.startsWith('SELECT type,name,tbl_name')){injectNextSchemaRead=false;return {async all(){const result=await statement.all();await source.db.prepare('CREATE TABLE raced(id INTEGER)').run();return result;}};}return statement;},
    batch(statements){return source.db.batch(statements);}
  };await assert.rejects(createD1RecoveryBackup(driftDb,commit,capturedAt),/d1_recovery_schema_changed/);
  assert.equal((await destination.db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").first()).n,0);
});

test('D1 atomic restore failure rolls back schema and data; existing destinations are protected',{timeout:30000},async(t)=>{
  const source=await database(t,'d1-recovery-atomic-source'),destination=await database(t,'d1-recovery-atomic-dest');await seed(source.db);
  const encoded=JSON.parse(await createD1RecoveryBackup(source.db,commit,capturedAt));
  // Keep the artifact internally consistent but violate the unique parent label in its second row.
  const table=encoded.payload.tables.find((item)=>item.name==='parent');table.rows.push(structuredClone(table.rows[0]));
  encoded.manifest.rowCount++;
  await rehash(encoded);
  await assert.rejects(restoreD1RecoveryBackup(destination.db,encoded,{authorizeSchema}),/UNIQUE|constraint/i);
  assert.equal((await destination.db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").first()).n,0,'failed atomic batch leaves no partial schema');
  await seed(destination.db);await assert.rejects(restoreD1RecoveryBackup(destination.db,encoded,{authorizeSchema}),/d1_recovery_destination_not_empty/);
  assert.equal((await destination.db.prepare('SELECT COUNT(*) n FROM parent').first()).n,1);
});

test('capture never emits an export that exceeds the conservative 100-statement restore ceiling',{timeout:30000},async(t)=>{
  const near=await database(t,'d1-recovery-near-cap'),over=await database(t,'d1-recovery-over-cap'),make=async(db,count)=>{
    const statements=[];for(let i=0;i<count;i++){const table=`t_${String(i).padStart(2,'0')}`;statements.push(db.prepare(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY,value TEXT)`),db.prepare(`CREATE INDEX ${table}_value_idx ON ${table}(value)`),db.prepare(`INSERT INTO ${table} VALUES(1,?)`).bind(table));}await db.batch(statements);
  };
  await make(near.db,32);const good=await createD1RecoveryBackup(near.db,commit,capturedAt),destination=await database(t,'d1-recovery-near-cap-dest');
  assert.equal((await restoreD1RecoveryBackup(destination.db,good,{authorizeSchema:async()=>true})).tableCount,32);
  await make(over.db,34);await assert.rejects(createD1RecoveryBackup(over.db,commit,capturedAt),/d1_recovery_statement_limit/);
});

test('schema/data omissions and column tampering fail inventory checks even when an unkeyed digest is recomputed',{timeout:30000},async(t)=>{
  const source=await database(t,'d1-recovery-inventory-source'),destination=await database(t,'d1-recovery-inventory-dest');await seed(source.db);const original=JSON.parse(await createD1RecoveryBackup(source.db,commit,capturedAt));
  const missing=structuredClone(original);missing.payload.tables=missing.payload.tables.filter((table)=>table.name!=='child');await rehash(missing);await assert.rejects(restoreD1RecoveryBackup(destination.db,missing,{authorizeSchema}),/d1_recovery_inventory_invalid/);
  const wrongColumns=structuredClone(original),parent=wrongColumns.payload.tables.find((table)=>table.name==='parent');parent.columns.pop();for(const row of parent.rows)row.pop();await rehash(wrongColumns);await assert.rejects(restoreD1RecoveryBackup(destination.db,wrongColumns,{authorizeSchema}),/CHECK constraint/);
  assert.equal((await destination.db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").first()).n,0);
});
