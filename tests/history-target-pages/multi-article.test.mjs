import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,symlinkSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {generalizedFixture} from '../maintenance-quality/generalized-helpers.mjs';
import {maintenanceTarget} from '../../src/maintenance-quality/target.ts';

const titleOf=id=>readFileSync(maintenanceTarget(id).articlePath,'utf8').match(/^title: ['"]?(.+?)['"]?\s*$/m)?.[1];

test('two native article heads build into article-aware history, review, and noindex detail routes',async()=>{
  const fixture=await generalizedFixture('history-pages');let project;
  try{
    const toolUse=await fixture.run('tool-use','first');
    const protocol=await fixture.run('model-context-protocol','second');
    project=mkdtempSync(join('.git','history-target-build-'));
    execFileSync('git',['clone','--local','--no-hardlinks','-b','main',fixture.remote.state.root,project],{stdio:'pipe'});
    symlinkSync(resolve('node_modules'),join(project,'node_modules'),'dir');
    execFileSync('npm',['run','build'],{cwd:project,stdio:'pipe',timeout:60000,maxBuffer:262144,env:{...process.env,PATH:process.env.PATH,ASTRO_TELEMETRY_DISABLED:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false',AGENTIC_BIBLE_DISCOVERY_MODE:'staging',AGENTIC_BIBLE_MAINTENANCE_HISTORY_MODE:'controlled-static-preview',AGENTIC_BIBLE_SOURCE_COMMIT:protocol.canonical.commit}});
    const out=join(project,'dist'),history=readFileSync(join(out,'history','index.html'),'utf8'),review=readFileSync(join(out,'review','index.html'),'utf8');
    const toolTitle=titleOf('tool-use'),protocolTitle=titleOf('model-context-protocol');
    assert.ok(history.includes(protocolTitle));assert.ok(history.includes(toolTitle));
    assert.ok(history.indexOf(protocolTitle)<history.indexOf(toolTitle),'history remains globally newest first');
    assert.equal(history.match(/Current for this article/g)?.length,4,'both current article heads appear in review and global history sections');
    assert.ok(history.includes(`/history/model-context-protocol/${protocol.canonical.eventId}/`));
    assert.ok(history.includes(`/history/tool-use/${toolUse.canonical.eventId}/`));
    assert.ok(history.includes(`/articles/model-context-protocol/`));assert.ok(history.includes(`/articles/tool-use/`));
    assert.ok(review.includes(protocolTitle));assert.ok(review.includes(toolTitle));
    assert.ok(review.includes(`/history/model-context-protocol/${protocol.canonical.eventId}/`));
    assert.ok(review.includes(`/history/tool-use/${toolUse.canonical.eventId}/`));
    for(const [id,event] of [['tool-use',toolUse],['model-context-protocol',protocol]]){
      const detail=readFileSync(join(out,'history',id,event.canonical.eventId,'index.html'),'utf8');
      assert.ok(detail.includes(titleOf(id)));
      assert.match(detail,/<meta name="robots" content="noindex, nofollow">/);
      assert.doesNotMatch(detail,/<link rel="canonical"/);
    }
    assert.match(history,/<meta name="robots" content="noindex, nofollow">/);
    assert.doesNotMatch(history,/<link rel="canonical"/);
    const catalog=JSON.parse(readFileSync(join(out,'maintenance-history.json'),'utf8'));
    assert.equal(catalog.schemaVersion,2);
    assert.deepEqual(catalog.history.map(entry=>[entry.articleId,entry.current]),[['model-context-protocol',true],['tool-use',true]]);
  }finally{await fixture.close();if(project)rmSync(project,{recursive:true,force:true});}
});
