import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {buildWiki} from '../../src/wiki-bridge/build.ts';
import {safeFailure} from '../../src/wiki-bridge/diagnostics.ts';
import {git} from './helpers.mjs';
const secret='PRIVATE_PAYLOAD Cookie=hidden https://example.org/?token=hidden';
async function fixture(script,started){const root=mkdtempSync(join(git,'wiki-bridge-test-child-diagnostic-')),jobId='a'.repeat(64),captureRoot=join(root,'captures'),output=join(root,'output');mkdirSync(output);const publisher={root,load(){return {state:{articles:{},history:{}},files:{}}}};
  try{let error;await assert.rejects(buildWiki({repo:process.cwd(),captureRoot,capture:{eventId:'diagnostic-fixture',jobId,attempt:1},project:{'scripts/wiki-bridge-build.mjs':Buffer.from(script)},output,siteId:'b'.repeat(64),publisher,reference:{id:'c'.repeat(64),manifestHash:'d'.repeat(64)},bindings:[],proofs:[],started}),e=>{error=e;return e.code==='full_wiki_build_failed'});const raw=readFileSync(join(root,'jobs',jobId,'build-1-diagnostics.json'),'utf8');assert.ok(!raw.includes('PRIVATE_PAYLOAD'));assert.ok(!raw.includes('Cookie'));assert.ok(!raw.includes('https:'));assert.ok(Buffer.byteLength(raw)<=8192);return {summary:JSON.parse(raw),error:safeFailure(error)};}finally{rmSync(root,{recursive:true,force:true});}
}
test('failed child diagnostics retain safe phases and exit reason without raw stderr or error messages',async()=>{
  const result=await fixture(`process.stderr.write(${JSON.stringify(secret+'\n')});process.stderr.write('AB_WIKI_CHILD '+JSON.stringify({phase:'failure',elapsedMs:1,error:{type:'TypeError',code:'UND_ERR_SOCKET',message:${JSON.stringify(secret)},body:${JSON.stringify(secret)}}})+'\\n');process.exit(2);`);
  assert.equal(result.summary.exitCode,2);assert.equal(result.summary.lastPhase,'failure');assert.equal(result.summary.phases[0].error.code,'UND_ERR_SOCKET');assert.equal(result.error.stop,'child-exit');
});
test('a synchronous startup checkpoint failure terminates its owned child and keeps the original failure category',async()=>{
  const result=await fixture('setInterval(()=>{},1000);',()=>{throw Error(secret)});assert.equal(result.summary.stop,'checkpoint');assert.equal(result.error.stop,'checkpoint');
});
