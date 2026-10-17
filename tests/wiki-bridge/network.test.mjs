import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {git} from './helpers.mjs';
test('framework metadata attempts are measured independently and disabled under blocked external networking',()=>{
  const result=join(git,'wiki-runtime-network-isolation.json'),child=spawnSync(process.execPath,['tests/wiki-bridge/network-probe.mjs',result],{timeout:30000,stdio:'ignore'});assert.equal(child.status,0,'network-blocked Miniflare probe must complete without a retry');
  const data=JSON.parse(readFileSync(result,'utf8'));assert.ok(data.controlBlockedMetadataAttempts>=1);assert.equal(data.legacyEnvironmentExternalAttempts,0);assert.equal(data.currentFactoryExternalAttempts,0);assert.equal(data.applicationFetches,0);assert.equal(data.actualD1Value,7);
});
