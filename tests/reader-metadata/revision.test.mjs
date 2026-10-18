import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {articleRevision} from '../../src/lib/article-revision.ts';

function git(repo,args,env={}) {
  return execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...env}}).trim();
}

test('source revision follows actual Markdown commits and respects an historical source pin',t=>{
  const repo=mkdtempSync(join(tmpdir(),'reader-metadata-git-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  git(repo,['init','-q']);git(repo,['config','user.name','Metadata Test']);git(repo,['config','user.email','metadata@example.invalid']);
  const article=join(repo,'src/content/articles/tool-use.md');mkdirSync(join(repo,'src/content/articles'),{recursive:true});
  writeFileSync(article,'first source version\n');git(repo,['add','src/content/articles/tool-use.md']);
  git(repo,['commit','-q','-m','Initial article source'],{GIT_AUTHOR_DATE:'2021-02-03T04:05:06Z',GIT_COMMITTER_DATE:'2021-02-03T04:05:06Z'});
  const historicalPin=git(repo,['rev-parse','HEAD']);
  writeFileSync(article,'revised article text\n');git(repo,['add','src/content/articles/tool-use.md']);
  git(repo,['commit','-q','-m','Clarify actual source behavior'],{GIT_AUTHOR_DATE:'2024-05-06T07:08:09Z',GIT_COMMITTER_DATE:'2024-05-06T07:08:09Z'});

  const current=articleRevision('tool-use',{repo});
  assert.deepEqual(current,{date:'2024-05-06',commit:git(repo,['rev-parse','HEAD']),subject:'Clarify actual source behavior'});
  assert.notEqual(current.date,'2026-10-17','source-check date must not become a content-change date');
  assert.deepEqual(articleRevision('tool-use',{repo,sourceCommit:historicalPin}),{date:'2021-02-03',commit:historicalPin,subject:'Initial article source'});
});

test('revision metadata falls back to unknown when the pin or lineage is unavailable',()=>{
  assert.equal(articleRevision('tool-use',{repo:join(tmpdir(),'not-a-git-repository')}),null);
  assert.equal(articleRevision('tool-use',{repo:process.cwd(),sourceCommit:'not-a-commit'}),null);
  assert.equal(articleRevision('../unsafe',{repo:process.cwd()}),null);
});

test('shallow Git history and an explicit missing source pin never claim a latest source change',t=>{
  const repo=mkdtempSync(join(tmpdir(),'reader-metadata-shallow-source-'));
  const shallow=mkdtempSync(join(tmpdir(),'reader-metadata-shallow-clone-'));
  t.after(()=>{rmSync(repo,{recursive:true,force:true});rmSync(shallow,{recursive:true,force:true});});
  git(repo,['init','-q']);git(repo,['config','user.name','Metadata Test']);git(repo,['config','user.email','metadata@example.invalid']);
  mkdirSync(join(repo,'src/content/articles'),{recursive:true});
  writeFileSync(join(repo,'src/content/articles/tool-use.md'),'actual source text\n');git(repo,['add','src/content/articles/tool-use.md']);
  git(repo,['commit','-q','-m','Actual source edit'],{GIT_AUTHOR_DATE:'2020-01-02T03:04:05Z',GIT_COMMITTER_DATE:'2020-01-02T03:04:05Z'});
  const actualSourceCommit=git(repo,['rev-parse','HEAD']);
  writeFileSync(join(repo,'README.md'),'later documentation-only commit\n');git(repo,['add','README.md']);
  git(repo,['commit','-q','-m','Unrelated documentation only'],{GIT_AUTHOR_DATE:'2025-06-07T08:09:10Z',GIT_COMMITTER_DATE:'2025-06-07T08:09:10Z'});

  git(repo,['clone','--quiet','--depth','1',`file://${repo}`,shallow]);
  assert.equal(git(shallow,['rev-parse','--is-shallow-repository']),'true');
  assert.deepEqual(articleRevision('tool-use',{repo}),{date:'2020-01-02',commit:actualSourceCommit,subject:'Actual source edit'});
  assert.equal(articleRevision('tool-use',{repo:shallow}),null,'a README-only shallow HEAD cannot prove the earlier Markdown edit is latest');
  assert.equal(articleRevision('tool-use',{repo,sourceCommit:null}),null,'an explicit null source pin must not fall back to HEAD');
  assert.deepEqual(articleRevision('tool-use',{repo,sourceCommit:actualSourceCommit}),{date:'2020-01-02',commit:actualSourceCommit,subject:'Actual source edit'});
});
