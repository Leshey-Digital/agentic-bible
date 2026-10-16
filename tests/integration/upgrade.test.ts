import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {SqliteD1} from '../editorial/sqlite.ts';
import {D1EditorialStore} from '../../src/editorial/store.ts';
import {submissionInput,digest} from '../../src/editorial/validation.ts';
import {validateCatalog} from '../../src/monitoring/catalog.ts';
import {MonitorStore} from '../../src/monitoring/store.ts';
import {runJob} from '../../src/monitoring/runner.ts';
import {fixtureTransport} from '../../src/monitoring/fixtures.ts';
import {publishQueued} from '../../src/monitoring/publication.ts';
import {SettingsStore} from '../../src/settings/store.ts';
import {defaults,updateInput} from '../../src/settings/contracts.ts';

const now=1_792_168_000_000;
const catalog=await validateCatalog(JSON.parse(readFileSync('dist/source-catalog.json','utf8')));
const editorialTables=['submissions','editorial_audit','local_sessions','rate_windows'];
const sourceTables=['monitor_sources','monitor_jobs','monitor_reservations','source_events','publication_heads','publication_candidates','publication_revisions','publication_actions'];
function snapshot(db:SqliteD1,tables:string[]) {
  return Object.fromEntries(tables.map(table=>[table,db.raw.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
}

test('populated editorial → source ledger → settings upgrades retain all prior rows and keep each subsystem usable after reopen',async()=>{
  const dir=mkdtempSync('.git/integration-upgrade-');const path=join(dir,'upgrade.sqlite');let db=new SqliteD1(path);
  try {
    const editorial=new D1EditorialStore(db);
    const input=submissionInput({requestKey:crypto.randomUUID(),articleId:'tool-use',kind:'correction',message:'Synthetic upgrade fixture: preserve this older submission, tags and audit through every later migration.',sourceUrl:'https://example.org/upgrade-fixture',website:''});
    const receipt=await editorial.submit(input,'synthetic-upgrade-client',now);
    assert.equal(await editorial.update(receipt.id,{version:1,status:'follow-up',tags:['Upgrade fixture']},'local-editor',now+1),true);
    const tokenHash=await digest('synthetic-upgrade-session');
    await editorial.createSession({tokenHash,identity:'local-editor',role:'admin',csrf:crypto.randomUUID(),expiresAt:now+1_200_000});
    const legacy=snapshot(db,editorialTables);
    db.raw.exec(readFileSync('migrations/0002_source_monitoring.sql','utf8'));
    assert.deepEqual(snapshot(db,editorialTables),legacy);
    const monitor=new MonitorStore(db);await monitor.seed(catalog);const source=catalog.sources.find(source=>source.articleIds.length===1)!;
    for(const [index,scenario] of (['baseline','change'] as const).entries()) {
      const job=await monitor.enqueue(source.id,scenario,`synthetic-upgrade-${scenario}`,now+2+index);
      await runJob(monitor,catalog,job.id,fixtureTransport,()=>now+2+index);
    }
    await publishQueued(monitor,catalog,now+4);const candidate=(await monitor.candidates())[0];
    assert.equal(candidate.state,'published');assert.equal(candidate.reviewFlag,'flagged');
    const head=(await monitor.head(candidate.articleId))!;
    assert.equal(await monitor.transition(candidate.id,'clear-flag',head.version,candidate.version,crypto.randomUUID(),'local-editor',now+5),true);
    const sourceState=snapshot(db,sourceTables);
    db.raw.exec(readFileSync('migrations/0003_measurement_settings.sql','utf8'));
    assert.deepEqual(snapshot(db,editorialTables),legacy);assert.deepEqual(snapshot(db,sourceTables),sourceState);
    const settings=new SettingsStore(db);const initial=await settings.read();
    for(const group of ['google','clarity','privacy','advertising'] as const)assert.deepEqual(initial[group].values,defaults[group]);
    await settings.update(updateInput({group:'google',version:1,requestKey:crypto.randomUUID(),values:{tagId:'GT-UPGRADE001',ga4Id:'',enabled:false}}),'local-editor',now+6);
    const prior=snapshot(db,[...editorialTables,...sourceTables,'measurement_settings','measurement_audit']);
    // Any additive migrations introduced by an accepted follow-up must preserve the populated stack too.
    for(const filename of readdirSync('migrations').filter(name=>name.endsWith('.sql')&&!['0001_editorial.sql','0002_source_monitoring.sql','0003_measurement_settings.sql'].includes(name)).sort())db.raw.exec(readFileSync(join('migrations',filename),'utf8'));
    assert.deepEqual(snapshot(db,[...editorialTables,...sourceTables,'measurement_settings','measurement_audit']),prior);
    db.raw.close();db=new SqliteD1(path,false);
    assert.deepEqual(snapshot(db,[...editorialTables,...sourceTables,'measurement_settings','measurement_audit']),prior);
    const reopenedEditorial=new D1EditorialStore(db);assert.equal((await reopenedEditorial.session(tokenHash,now+10))?.role,'admin');
    assert.deepEqual((await reopenedEditorial.get(receipt.id))?.tags,['Upgrade fixture']);assert.equal((await reopenedEditorial.audit(receipt.id)).length,2);
    assert.equal((await reopenedEditorial.submit(input,'synthetic-upgrade-client',now+10)).duplicate,true);
    const reopenedMonitor=new MonitorStore(db);const queued=await reopenedMonitor.enqueue(source.id,'unchanged','synthetic-upgrade-after-reopen',now+10);
    assert.equal((await runJob(reopenedMonitor,catalog,queued.id,fixtureTransport,()=>now+10)).state,'succeeded');
    assert.equal((await reopenedMonitor.candidate(candidate.id))?.reviewFlag,'cleared');
    const reopenedSettings=new SettingsStore(db);assert.equal((await reopenedSettings.read()).google.values.tagId,'GT-UPGRADE001');
    assert.equal(await reopenedSettings.update(updateInput({group:'clarity',version:1,requestKey:crypto.randomUUID(),values:{projectId:'upgrade001',enabled:false}}),'local-editor',now+11),'saved');
    assert.equal((await reopenedSettings.audit()).length,2);
    assert.deepEqual(db.raw.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.raw.prepare('PRAGMA integrity_check').get()?.integrity_check,'ok');
  }finally{db.raw.close();rmSync(dir,{recursive:true,force:true});}
});
