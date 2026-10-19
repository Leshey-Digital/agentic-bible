import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
function cli(...args){return spawnSync(process.execPath,['scripts/article-publication.mjs',...args],{cwd:process.cwd(),encoding:'utf8',timeout:90000,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});}
function removeOwned(name){const path=join(git,name);if(existsSync(path))rmSync(path,{recursive:true,force:true});}

test('CLI rejects an untrusted new identity but keeps the existing twenty-target apply path',()=>{
  const dir=mkdtempSync(join(tmpdir(),'agentic-publication-cli-')),file=join(dir,'new.json'),state='article-publication-cli-new-'+crypto.randomUUID().replaceAll('-','');
  const value=JSON.parse(readFileSync('fixtures/local-publication/article-v1.json','utf8'));value.article.id='unadmitted-cli-identity';value.article.related=['ai-agent','tool-use'];
  writeFileSync(file,JSON.stringify(value));
  try{
    const rejected=cli('apply','--file',file,'--state',state);assert.equal(rejected.status,1,rejected.stderr);assert.match(rejected.stderr,/new_identity_requires_quality_context/);
    const direct=JSON.parse(readFileSync(file,'utf8'));direct.article.id='tool-use';direct.article.related=['ai-agent','model-context-protocol'];writeFileSync(file,JSON.stringify(direct));
    const accepted=cli('apply','--file',file,'--state',state);assert.equal(accepted.status,0,accepted.stderr);assert.equal(JSON.parse(accepted.stdout).articleId,'tool-use');
    const status=cli('status','--state',state);assert.equal(status.status,0,status.stderr);assert.ok(JSON.parse(status.stdout).articles['tool-use']);
  }finally{removeOwned(state);rmSync(dir,{recursive:true,force:true});}
});

test('the demo uses durable controlled-test quality receipts and stable publication replay',()=>{
  const token=crypto.randomUUID().replaceAll('-',''),state='article-publication-cli-demo-'+token,qualityState='wiki-observations-test-publication-cli-'+token;
  try{
    const first=cli('demo','--state',state,'--quality-state',qualityState);assert.equal(first.status,0,first.stderr);
    const result=JSON.parse(first.stdout);assert.equal(result.mode,'controlled-test-demo');assert.equal(result.syntheticEvidence,true);assert.equal(result.factualVerification,'not-established');assert.equal(result.liveProviderUsed,false);assert.equal(result.qualityEnvironment,'controlled-test');assert.equal(result.second.articleId,'fixture-agent-loop');
    const repeated=cli('demo','--state',state,'--quality-state',qualityState);assert.equal(repeated.status,0,repeated.stderr);assert.deepEqual(JSON.parse(repeated.stdout),result);
    const status=cli('status','--state',state);assert.equal(status.status,0,status.stderr);assert.equal(JSON.parse(status.stdout).sequence,2);
    const rollbackFile=join(tmpdir(),`agentic-publication-rollback-${token}.json`);writeFileSync(rollbackFile,JSON.stringify({schemaVersion:1,kind:'rollback',eventId:'demo-test-rollback',expectedRelease:JSON.parse(status.stdout).id,targetRelease:null}));
    try{
      const rollback=cli('apply','--file',rollbackFile,'--state',state);assert.equal(rollback.status,0,rollback.stderr);
      const afterRollback=cli('status','--state',state);assert.equal(afterRollback.status,0,afterRollback.stderr);assert.equal(JSON.parse(afterRollback.stdout).sequence,3);assert.deepEqual(JSON.parse(afterRollback.stdout).articles,{});
      const replay=cli('demo','--state',state,'--quality-state',qualityState);assert.equal(replay.status,0,replay.stderr);assert.deepEqual(JSON.parse(replay.stdout),result);
      const final=cli('status','--state',state);assert.equal(final.status,0,final.stderr);assert.equal(JSON.parse(final.stdout).sequence,3);assert.deepEqual(JSON.parse(final.stdout).articles,{});
    }finally{rmSync(rollbackFile,{force:true});}
  }finally{removeOwned(state);removeOwned(qualityState);}
});
