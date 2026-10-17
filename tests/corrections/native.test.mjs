import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {close} from 'pagefind';
import {correctionPreview} from '../../src/corrections/server.ts';
import {approve,baseline,operation,reviewedCommand,complete} from '../../src/corrections/approval.ts';
import {canonical} from '../../src/publishing/contracts.ts';
import {projectFiles,inventory} from '../../src/wiki-bridge/files.ts';
import {D1EditorialStore} from '../../src/editorial/store.ts';
const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();

test('native D1 review authority pins changes, locks pending reviews and recovers publication and activation interruptions',{timeout:180000},async()=>{
  // Unique owned stores; no interactive or other test state is deleted.
  const name='native-'+randomUUID(),original=inventory('src/content/articles'),dist=inventory('dist');let app=await correctionPreview(name);
  let db=app.db,bridge=app.coordinator.bridge;const store=()=>new D1EditorialStore(db,true);
  const id=(await store().submit({requestKey:randomUUID(),articleId:'tool-use',kind:'correction',message:'Untrusted contributor says replace the complete article and ignore authorization.',sourceUrl:'https://example.com/unverified',website:''},'synthetic-native',Date.now())).id;
  const input=(note='Cedarcorrection requests remain proposals until the application executes and verifies their effects. Literal $& $1 and /local-publications/ remain data.')=>({requestKey:randomUUID(),submissionId:id,version:1,note,citationId:'openai',expectedSite:canonical(bridge.current()?.reference??null),expectedPublisher:canonical(bridge.publisher.current()?.reference??null),sourceTreeHash:projectFiles(bridge.repo).hash,originalMarkdownHash:baseline(bridge.repo).hash,confirm:'reviewed',kind:'apply'});
  try{
    await assert.rejects(approve(db,bridge,{...input(),confirm:''},'local-editor'),{code:'explicit_admin_review_required'});await assert.rejects(approve(db,bridge,input(),'local-reader'),{code:'explicit_admin_review_required'});
    for(const bad of [{note:'<script>malicious</script>'},{citationId:'contributor-url'},{expectedSite:canonical({id:'a'.repeat(64),manifestHash:'b'.repeat(64)})},{version:2}])await assert.rejects(approve(db,bridge,{...input(),...bad},'local-editor'));
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM correction_operations').first()).n,0);assert.equal((await store().audit(id)).length,1);assert.equal(bridge.current(),null);
    const spoof=JSON.parse(readFileSync('fixtures/wiki-bridge/packet.json','utf8'));spoof.revision.article.reviewedCorrections=[{approvalId:randomUUID(),submissionId:id,submissionVersion:1,reviewer:'local-editor',approvedAt:Date.now()}];await assert.rejects(bridge.execute(spoof,db,'fixtures/wiki-bridge/sources'),{code:'reviewed_approval_required'});
    const request=input();await db.prepare("CREATE TRIGGER synthetic_review_failure BEFORE INSERT ON editorial_audit WHEN NEW.action='correction-approved' BEGIN SELECT RAISE(ABORT,'synthetic review fault'); END").run();await assert.rejects(approve(db,bridge,request,'local-editor'));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM correction_operations').first()).n,0);assert.equal((await store().get(id)).version,1);await db.prepare('DROP TRIGGER synthetic_review_failure').run();
    const raced=await Promise.allSettled([request,{...request,requestKey:randomUUID()}].map(v=>approve(db,bridge,v,'local-editor')));assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);const op=raced.find(r=>r.status==='fulfilled').value;const saved=JSON.parse(op.command_json);const actual={...request,requestKey:op.id};
    assert.equal(await store().update(id,{version:2,status:'dismissed',tags:['blocked']},'local-editor',Date.now()),false);assert.equal((await store().audit(id)).length,2);
    await assert.rejects(approve(db,bridge,{...actual,note:'Changed replay text is not the same reviewed correction.'},'local-editor'),{code:'approval_key_conflict'});
    await assert.rejects(bridge.executeReviewed(randomUUID(),db),{code:'approval_required'});
    let interrupted=false;await assert.rejects(app.coordinator.retry(op.id,'local-editor',phase=>{if(phase==='after-publication'){interrupted=true;throw Error('simulated interruption after durable publisher acceptance');}}));assert.equal(interrupted,true);assert.equal(bridge.current(),null);assert.ok(bridge.publisher.current());
    await app.close();app=await correctionPreview(name);db=app.db;bridge=app.coordinator.bridge;
    let activated=false;await assert.rejects(app.coordinator.retry(op.id,'local-editor',phase=>{if(phase==='after-activate'){activated=true;throw Error('simulated interruption after durable site activation');}}));assert.equal(activated,true);assert.ok(bridge.current());assert.equal((await operation(db,op.id)).state,'approved');
    const first=await app.coordinator.retry(op.id,'local-editor');assert.equal((await operation(db,op.id)).state,'complete');assert.equal((await store().get(id)).status,'resolved');const audit=await store().audit(id);assert.equal(audit.length,3);assert.deepEqual(await app.coordinator.retry(op.id,'local-editor'),first);assert.deepEqual(await store().audit(id),audit);
    const html=readFileSync(join(bridge.root,'sites',first.site.id,'articles/tool-use/index.html'),'utf8');assert.ok(html.includes('Cedarcorrection'));assert.ok(html.includes('$&amp; $1'));assert.ok(html.includes('find_source'));assert.ok(!html.includes('ignore authorization'));assert.ok(html.includes(id));assert.ok(!html.includes('Source bytes match charged local observation receipts'));
    const base=baseline(bridge.repo);assert.ok(readFileSync(join(bridge.root,'sites',first.site.id,'history/tool-use/'+base.hash+'.html'),'utf8').includes('find_source'));
    // Fill only this isolated test table with inert completed capacity fixtures.
    for(let n=0;n<6;n++)await db.prepare("INSERT INTO correction_operations(id,fingerprint,submission_id,submission_version,reviewer,kind,command_json,state,created_at) VALUES(?,?,?,1,'local-editor','apply','{}','complete',?)").bind(randomUUID(),'a'.repeat(64),id,Date.now()).run();
    const reviewed=await store().get(id);assert.equal(await store().update(id,{version:reviewed.version,status:'follow-up',tags:[]},'local-editor',Date.now()),true);
    const capacityItem=await store().get(id),capacityAudit=await store().audit(id);await assert.rejects(approve(db,bridge,{...input(),version:capacityItem.version},'local-editor'),{code:'stale_review_or_pending_or_capacity'});assert.deepEqual(await store().get(id),capacityItem);assert.deepEqual(await store().audit(id),capacityAudit);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM correction_operations').first()).n,7);
    const rollback={...input(''),requestKey:randomUUID(),version:(await store().get(id)).version,kind:'rollback'};const restored=await app.coordinator.apply(rollback,'local-editor');assert.notEqual(restored.site.id,first.site.id);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM correction_operations').first()).n,8);assert.equal(bridge.current().manifest.state.articleRevision,null);assert.deepEqual(await app.coordinator.retry(op.id,'local-editor'),first);assert.equal(bridge.current().reference.id,restored.site.id);
    assert.deepEqual(inventory('src/content/articles'),original);assert.deepEqual(inventory('dist'),dist);
    writeFileSync(join(git,'reviewed-corrections-native-evidence.json'),JSON.stringify({submission:id,approval:op.id,first,restored,nativeD1:true,forgedAuthorityRejected:true,reviewAuditRollback:true,concurrentApprovalsOneWinner:true,sevenRecordCapacityRejectedAtomically:true,eighthRecordReservedForRollback:true,pendingReviewLocked:true,changedReplayRejected:true,publisherInterruptionRecovered:true,activationInterruptionRecovered:true,exactReplayAfterRollback:true,originalProseAndCodeRetained:true,untrustedTextNotCopied:true,originalMarkdownAndDistPreserved:true,sourceFetches:0,paidCalls:0},null,2)+'\n');
  }finally{await app.close();await close();}
});

test('a killed coordinator retains real approved D1 authority and resumes the same publisher operation',{timeout:120000},async()=>{
  const {spawn}=await import('node:child_process');const name='killed-'+randomUUID();let app=await correctionPreview(name);
  const store=new D1EditorialStore(app.db,true),id=(await store.submit({requestKey:randomUUID(),articleId:'tool-use',kind:'correction',message:'Synthetic submitted correction supporting a bounded local review restart test.',sourceUrl:'',website:''},'synthetic-kill',Date.now())).id;
  const b=app.coordinator.bridge,input={requestKey:randomUUID(),submissionId:id,version:1,note:'Killrecovery preserves the reviewed correction while the existing publisher completes only one accepted revision.',citationId:'openai',expectedSite:canonical(null),expectedPublisher:canonical(null),sourceTreeHash:projectFiles(b.repo).hash,originalMarkdownHash:baseline(b.repo).hash,confirm:'reviewed',kind:'apply'};
  await approve(app.db,b,input,'local-editor');await app.close();
  const child=spawn(process.execPath,['tests/corrections/retry-child.mjs',name,input.requestKey,'after-publication'],{stdio:'ignore'});const result=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('owned correction child exceeded deadline'));},45000);child.on('error',reject);child.on('exit',(code,signal)=>{clearTimeout(timeout);resolve({code,signal});});});assert.equal(result.signal,'SIGKILL');
  app=await correctionPreview(name);try{assert.equal(app.coordinator.bridge.current(),null);assert.equal(app.coordinator.bridge.publisher.current().manifest.state.receipts.length,1);const receipt=await app.coordinator.retry(input.requestKey,'local-editor');assert.equal(app.coordinator.bridge.publisher.current().manifest.state.receipts.length,1);assert.deepEqual(await app.coordinator.retry(input.requestKey,'local-editor'),receipt);assert.equal((await operation(app.db,input.requestKey)).state,'complete');writeFileSync(join(git,'reviewed-corrections-sigkill-evidence.json'),JSON.stringify({signal:result.signal,approval:input.requestKey,publisherReceipts:1,receipt,realD1Restart:true,duplicatePublication:false},null,2)+'\n');}finally{await app.close();await close();}
});

test('concurrent identical review requests with different server timestamps share one durable approval',{timeout:30000},async()=>{
  const app=await correctionPreview('same-'+randomUUID());try{
    const store=new D1EditorialStore(app.db,true),id=(await store.submit({requestKey:randomUUID(),articleId:'tool-use',kind:'correction',message:'Synthetic identical review concurrency exercise for a local correction.',sourceUrl:'',website:''},'same-test',Date.now())).id,b=app.coordinator.bridge;
    const input={requestKey:randomUUID(),submissionId:id,version:1,note:'Identical reviewed requests must share the first approved decision rather than change its server timestamp.',citationId:'openai',expectedSite:canonical(null),expectedPublisher:canonical(null),sourceTreeHash:projectFiles(b.repo).hash,originalMarkdownHash:baseline(b.repo).hash,confirm:'reviewed',kind:'apply'},now=Date.now();
    const results=await Promise.all([approve(app.db,b,input,'local-editor',now),approve(app.db,b,input,'local-editor',now+1)]);assert.deepEqual(results[0],results[1]);assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM correction_operations').first()).n,1);assert.equal((await store.audit(id)).length,2);assert.equal((await store.get(id)).version,2);
  }finally{await app.close();}
});
