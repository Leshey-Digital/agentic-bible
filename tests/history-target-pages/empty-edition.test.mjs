import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('an edition with no maintenance receipts renders an explicit empty History and review state',()=>{
  execFileSync('npm',['run','build'],{stdio:'pipe',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
  const history=readFileSync(join('dist','history','index.html'),'utf8');
  const review=readFileSync(join('dist','review','index.html'),'utf8');
  assert.match(history,/<h2>No maintenance revisions in this edition<\/h2>/);
  assert.match(history,/An empty maintenance history does not mean the articles have never changed/);
  assert.doesNotMatch(history,/href="\/history\/tool-use\/[^/]+\//);
  assert.match(history,/<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(history,/<link rel="canonical"/);
  assert.match(review,/<h2>Current article flags<\/h2>/);
  assert.match(review,/No maintenance review flags are recorded in this edition/);
  assert.match(review,/<meta name="robots" content="noindex, nofollow">/);
  assert.equal(existsSync(join('dist','history','tool-use')),false);
});
