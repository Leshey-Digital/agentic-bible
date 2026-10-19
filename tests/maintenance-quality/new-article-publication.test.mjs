import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,rmSync} from 'node:fs';
import {PublicationStore} from '../../src/publishing/store.ts';
import {executeQualityPublication} from '../../src/maintenance-quality/publisher.ts';
import {quality,sample,fixture} from './helpers.mjs';

const stores=[];
const store=()=>{const value=new PublicationStore('article-publication-new-lifecycle-'+crypto.randomUUID());stores.push(value.root);return value;};
const denied=code=>error=>error.code===code;
after(async()=>{for(const root of stores)rmSync(root,{recursive:true,force:true});});

test('trusted quality admission drives a new local identity through publication, metadata, revision, rollback and replay',async()=>{
  const ledger=await fixture('new-article-lifecycle'),publisher=store(),{article,sources}=sample();
  article.id='new-lifecycle-article';article.title='A newly admitted local article';article.description='A bounded test of trusted admission and the existing local lifecycle.';article.related=['ai-agent','tool-use'];article.concerns=['editorial-review'];
  let verificationCalls=0;const trust=quality(()=>{},()=>verificationCalls++),context={db:ledger.db,quality:trust,sources,publisher};
  try{
    const rejected=quality(r=>r.checks.safe='unknown');
    await assert.rejects(executeQualityPublication({schemaVersion:1,kind:'publish',eventId:'new-denied',baseRevision:null,article},{...context,quality:rejected}),denied('quality_publication_denied'));
    assert.equal(publisher.current(),null);
    assert.equal((await ledger.db.prepare('SELECT COUNT(*) AS n FROM maintenance_quality_admissions').first()).n,1);

    const firstCommand={schemaVersion:1,kind:'publish',eventId:'new-first-revision',baseRevision:null,article};
    const first=await executeQualityPublication(firstCommand,context);
    assert.equal(first.action,'publish');assert.equal(first.quality.decision,'allow');assert.equal(first.quality.livePublished,false);
    const initial=publisher.current();assert.ok(initial);assert.equal(initial.manifest.state.articles[article.id],first.publication.revisionId);
    assert.deepEqual(initial.manifest.state.history[article.id],[first.publication.revisionId]);
    assert.ok(first.publication.flags.includes('editorial-review'));
    assert.ok(initial.manifest.files[`articles/${article.id}/index.html`]);
    assert.ok(initial.manifest.files[`history/${article.id}/${first.publication.revisionId}.html`]);
    const review=readFileSync(`${publisher.root}/releases/${initial.reference.id}/review/index.html`,'utf8');
    assert.match(review,/A newly admitted local article/);
    assert.match(review,/Editorial review requested/);

    await ledger.restart();
    context.db=ledger.db;
    assert.deepEqual(await executeQualityPublication(firstCommand,context),first);
    assert.equal(verificationCalls,1);
    assert.equal(publisher.current().manifest.state.sequence,1);

    const revisedArticle=structuredClone(article);revisedArticle.title='A revised newly admitted local article';
    revisedArticle.blocks[1].content[0].text='Silvermeadow is the unique controlled token in this later locally supplied revision, whose immutable history remains available after publication.';
    const secondCommand={schemaVersion:1,kind:'publish',eventId:'new-second-revision',baseRevision:first.publication.revisionId,article:revisedArticle};
    const second=await executeQualityPublication(secondCommand,context);
    const latest=publisher.current();assert.ok(latest);assert.equal(latest.manifest.state.articles[article.id],second.publication.revisionId);
    assert.deepEqual(latest.manifest.state.history[article.id],[first.publication.revisionId,second.publication.revisionId]);
    const beforeRollback=latest.reference.id;
    const rollbackCommand={schemaVersion:1,kind:'rollback',eventId:'new-article-rollback',expectedRelease:beforeRollback,targetRelease:initial.reference.id};
    const rollback=await executeQualityPublication(rollbackCommand,context);
    assert.equal(rollback.action,'rollback');const restored=publisher.current();assert.ok(restored);
    assert.equal(restored.manifest.state.articles[article.id],first.publication.revisionId);
    assert.deepEqual(restored.manifest.state.history[article.id],[first.publication.revisionId,second.publication.revisionId]);
    assert.equal(restored.manifest.state.receipts.length,3);
    assert.ok(restored.manifest.files[`history/${article.id}/${second.publication.revisionId}.html`]);

    const replay=await executeQualityPublication(firstCommand,context);
    assert.deepEqual(replay,first);assert.equal(publisher.current().reference.id,restored.reference.id);
    assert.equal(publisher.current().manifest.state.sequence,3);assert.equal(verificationCalls,2);
    await assert.rejects(executeQualityPublication({...firstCommand,article:{...article,title:'Changed reuse'}},context),denied('quality_event_conflict'));
    assert.equal(publisher.current().reference.id,restored.reference.id);
  }finally{await ledger.close();}
});

test('quality verifier uncertainty and malformed new identity have no publication effect',async()=>{
  const ledger=await fixture('new-article-no-effect'),publisher=store(),{article,sources}=sample();
  article.id='new-uncertain-article';article.related=['ai-agent','tool-use'];
  try{
    const uncertain={...quality(),verifier:{...quality().verifier,async verify(){throw Error('controlled uncertainty');}}};
    const context={db:ledger.db,quality:uncertain,sources,publisher};
    await assert.rejects(executeQualityPublication({schemaVersion:1,kind:'publish',eventId:'new-uncertain',baseRevision:null,article},context),denied('quality_verifier_outcome_unconfirmed_no_retry'));
    assert.equal(publisher.current(),null);
    await assert.rejects(executeQualityPublication({schemaVersion:1,kind:'publish',eventId:'new-invalid-id',baseRevision:null,article:{...article,id:'../unsafe'}},{...context,quality:quality()}),error=>error.code==='invalid_identifier');
    assert.equal(publisher.current(),null);
  }finally{await ledger.close();}
});
