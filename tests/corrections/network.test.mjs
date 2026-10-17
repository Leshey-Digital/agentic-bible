import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
test('correction coordinator starts actual migrated D1 under denied external networking and contrary metadata settings',()=>{
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),file=join(git,'reviewed-corrections-network-isolation.json');
  const child=spawnSync(process.execPath,['tests/corrections/network-probe.mjs',file],{timeout:30000,stdio:'ignore'});assert.equal(child.status,0,'network-blocked correction runtime must start without retry');
  assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),{externalFrameworkAttempts:0,actualD1Table:'correction_operations',initialOperations:0,constructorIsolation:true});
});
