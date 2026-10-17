import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {sourceId,validateCatalog,catalogSourceLimit} from '../../src/monitoring/catalog.ts';

test('actual Worker/D1 catalog admission is atomic at partial capacity, faults, restart and competing seeds',{timeout:180000},async()=>{
  const path=resolve('.git/catalog-seed-worker-state');rmSync(path,{recursive:true,force:true});mkdirSync(path,{recursive:true});
  const script=(await build({entryPoints:['tests/monitoring-worker/catalog-entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})).outputFiles[0].text;
  const base=await validateCatalog(JSON.parse(readFileSync('dist/source-catalog.json','utf8')));assert.equal(base.sources.length,51);
  const extra=async n=>{const url=`https://docs.langchain.com/fixture-atomic-catalog/${n}`;return {id:await sourceId(url),url,title:`Supplied atomic catalog fixture ${n}`,articleIds:['ai-agent']};};
  const initial=structuredClone(base);for(let n=0;initial.sources.length<catalogSourceLimit-1;n++)initial.sources.push(await extra(n));await validateCatalog(initial);
  const incoming=structuredClone(base);incoming.sources=incoming.sources.slice(0,base.sources.length-2);incoming.sources[0].title='Rejected title update must roll back';incoming.sources[0].articleIds=['ai-agent'];incoming.sources.push(await extra(100),await extra(101));await validateCatalog(incoming);
  let runtime,db,fetches=0;
  async function start(){runtime=new Miniflare({...convertV4MiniflareOptions({name:'catalog-seed-test',modules:true,script,compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'catalog-seed-test'},outboundService(){fetches++;throw Error('external fetch forbidden');}}),cf:false,resourcePersistencePath:path});db=await runtime.getD1Database('EDITORIAL_DB');}
  async function restart(){await runtime.dispose();await start();}
  const seed=async catalog=>{const response=await runtime.dispatchFetch('http://localhost/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(catalog)});return {http:response.status,...await response.json()};};
  const rows=async()=>({sources:(await db.prepare('SELECT * FROM monitor_sources ORDER BY id').all()).results,heads:(await db.prepare('SELECT * FROM publication_heads ORDER BY article_id').all()).results});
  async function reset(catalog){await db.batch([db.prepare('DELETE FROM monitor_sources'),db.prepare('DELETE FROM publication_heads')]);assert.equal((await seed(catalog)).http,200);}
  await start();try{
    for(const file of ['0001_editorial.sql','0002_source_monitoring.sql'])for(const sql of readFileSync('migrations/'+file,'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
    assert.equal((await seed(initial)).http,200);await db.prepare('UPDATE monitor_sources SET version=7,body_hash=?,etag=?,checked_at=123 WHERE id=?').bind('a'.repeat(64),'"preserved-fixture"',initial.sources[0].id).run();const before=await rows();assert.equal(before.sources.length,catalogSourceLimit-1);
    assert.deepEqual(await seed(incoming),{http:409,error:'catalog_capacity'});assert.deepEqual(await rows(),before,'Limit minus one rows + two new IDs must reject all inserts/title/article-ID updates');
    await restart();assert.deepEqual(await rows(),before);assert.deepEqual(await seed(incoming),{http:409,error:'catalog_capacity'});assert.deepEqual(await rows(),before);
    await db.prepare('DELETE FROM publication_heads WHERE article_id=?').bind(base.articles.at(-1).id).run();const missingHead=await rows();assert.equal(missingHead.heads.length,base.articles.length-1);assert.deepEqual(await seed(incoming),{http:409,error:'catalog_capacity'});assert.deepEqual(await rows(),missingHead,'capacity rejection must not fill a missing publication head');
    assert.equal((await seed(initial)).http,200);assert.deepEqual(await rows(),before,'admitted reseed restores the head and preserves observation state');assert.equal((await seed(initial)).http,200);assert.deepEqual(await rows(),before);
    const one=structuredClone(incoming);one.sources.pop();one.sources[0].title='Admitted title update';assert.equal((await seed(one)).http,200);const full=await rows();assert.equal(full.sources.length,catalogSourceLimit);assert.equal(full.sources.find(s=>s.id===one.sources[0].id).title,'Admitted title update');assert.equal((await seed(one)).http,200);assert.deepEqual(await rows(),full);await restart();assert.equal((await seed(one)).http,200);assert.deepEqual(await rows(),full);
    await reset(initial);const faultBefore=await rows();await db.prepare("CREATE TRIGGER synthetic_catalog_head_failure BEFORE INSERT ON publication_heads BEGIN SELECT RAISE(ABORT,'synthetic head failure'); END").run();assert.deepEqual(await seed(one),{http:409,error:'storage_failure'});assert.deepEqual(await rows(),faultBefore,'later head failure rolls source inserts/updates back');await db.prepare('DROP TRIGGER synthetic_catalog_head_failure').run();
    const contender=structuredClone(one);contender.sources[contender.sources.length-1]=await extra(102);contender.sources[0].title='Competing title update';const raced=await Promise.all([seed(one),seed(contender)]);assert.equal(raced.filter(r=>r.http===200).length,1);assert.equal(raced.filter(r=>r.error==='catalog_capacity').length,1);const winner=raced[0].http===200?one:contender,loser=raced[0].http===200?contender:one;const afterRace=await rows();assert.equal(afterRace.sources.length,catalogSourceLimit);assert.equal(afterRace.sources.find(s=>s.id===winner.sources[0].id).title,winner.sources[0].title);assert.equal(afterRace.sources.some(s=>s.id===loser.sources.at(-1).id),false);await restart();assert.deepEqual(await rows(),afterRace);assert.equal((await seed(winner)).http,200);assert.deepEqual(await rows(),afterRace);
    const initialBelowTwo={...initial,sources:initial.sources.slice(0,catalogSourceLimit-2)};await reset(initialBelowTwo);const identical=await Promise.all([seed(incoming),seed(incoming)]);assert.deepEqual(identical,[{http:200,status:'seeded'},{http:200,status:'seeded'}]);
    const identicalRows=await rows();assert.equal(identicalRows.sources.length,catalogSourceLimit);await restart();assert.deepEqual(await rows(),identicalRows);assert.equal(fetches,0);
    writeFileSync(resolve('.git/catalog-seed-worker-evidence.json'),JSON.stringify({initialRows:catalogSourceLimit-1,incomingSources:incoming.sources.length,newIds:2,rejectedWithoutPartialChanges:true,missingHeadNotInsertedOnRejection:true,restartPreserved:true,exactBoundary:catalogSourceLimit,idempotentReseed:true,lateFaultRollback:true,competingSeedsOneWinner:true,identicalSeedsBothAdmitted:true,sourceFetches:fetches},null,2)+'\n');
  }finally{await runtime.dispose();}
});
