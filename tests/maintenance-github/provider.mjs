import {maintenanceTarget} from '../../src/maintenance-quality/target.ts';
// Controlled GitHub-shaped transport backed by real, owned local Git objects/ref CAS.
import {execFileSync} from 'node:child_process';import {mkdirSync,rmSync,existsSync,readFileSync} from 'node:fs';import {join} from 'node:path';
import {projectFiles} from '../../src/wiki-bridge/files.ts';import {repository,branch,commitMutation,articlePath,pointerPath,historyPath} from '../../src/maintenance-github/contracts.ts';
import assert from 'node:assert/strict';import {git} from '../wiki-bridge/helpers.mjs';
export function controlledGitHub(label,options={}){
 assert.match(label,/^[a-z0-9-]+$/);const root=join(git,'maintenance-github-provider-test-'+label);rmSync(root,{recursive:true,force:true});mkdirSync(root);execFileSync('git',['init','--bare','--object-format=sha1',root],{stdio:'ignore'});
 const env={...process.env,GIT_INDEX_FILE:join(root,'fixture-index'),GIT_AUTHOR_NAME:'Controlled fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Controlled fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',GIT_AUTHOR_DATE:'2026-10-18T00:00:00Z',GIT_COMMITTER_DATE:'2026-10-18T00:00:00Z'};
 const run=(args,input)=>execFileSync('git',['-c','core.hooksPath=/dev/null','--git-dir='+root,...args],{env,input,maxBuffer:2*1024*1024,stdio:['pipe','pipe','pipe']});
 const text=(args,input)=>run(args,input).toString('utf8').trim();
 const object=bytes=>text(['hash-object','-w','--stdin'],bytes);
 function tree(parent,files){run(parent?['read-tree',parent]:['read-tree','--empty']);const lines=Object.entries(files).map(([path,body])=>'100644 '+object(body)+'\t'+path+'\0').join('');run(['update-index','-z','--index-info'],lines);return text(['write-tree']);}
 const files={...projectFiles(process.cwd()).files,'.gitignore':readFileSync('.gitignore'),'unrelated.txt':Buffer.from('Unrelated canonical bytes must survive.\n')};const initialTree=tree(null,files),ancestor=text(['commit-tree',initialTree],Buffer.from('Controlled ancestor\n')),base=text(['commit-tree',initialTree,'-p',ancestor],Buffer.from('Controlled maintenance baseline\n'));run(['update-ref','refs/heads/'+branch,base]);
 const tip=()=>text(['rev-parse','refs/heads/'+branch]);
 const commit=oid=>{const raw=run(['cat-file','-p',oid]).toString('utf8'),[header,...body]=raw.split('\n\n');return {sha:oid,tree:{sha:header.match(/^tree ([a-f0-9]{40})$/m)[1]},parents:[...header.matchAll(/^parent ([a-f0-9]{40})$/gm)].map(m=>({sha:m[1]})),message:body.join('\n\n')};};
 function append(changes,message='Unrelated competing canonical commit',expected=tip()){const treeId=tree(expected,changes),oid=text(['commit-tree',treeId,'-p',expected],Buffer.from(message+'\n'));run(['update-ref','refs/heads/'+branch,oid,expected]);return oid;}
 const state={base,ancestor,root,calls:[],dispatches:0,mutations:0,lost:false,beforeMutation:null,afterMutation:null,hold:null,override:null,mutateFiles:null};
 const send=async request=>{
  const url=new URL(request.url);assert.equal(url.origin,'https://api.github.com');assert.equal(request.headers.has('Authorization'),false);assert.equal(request.redirect,'manual');state.calls.push({method:request.method,path:url.pathname,search:url.search});
  if(state.override){const hook=state.override;state.override=null;return hook(request);}
  if(state.hold){const held=state.hold;state.hold=null;held.enter();await held.wait;}
  if(request.method==='POST'){
   assert.equal(url.pathname,'/graphql');state.dispatches++;const body=await request.json();assert.equal(body.operationName,'CanonicalMaintenanceCommit');assert.equal(body.query,commitMutation);const input=body.variables.input;assert.deepEqual(input.branch,{repositoryNameWithOwner:repository,branchName:branch});assert.equal(input.fileChanges.deletions,undefined);assert.equal(input.fileChanges.additions.length,3);
   const added=Object.fromEntries(input.fileChanges.additions.map(entry=>[entry.path,Buffer.from(entry.contents,'base64')]));if(options.generalized){const paths=Object.keys(added).filter(path=>path.startsWith('src/content/articles/'));assert.equal(paths.length,1);const id=paths[0].slice('src/content/articles/'.length,-3),target=maintenanceTarget(id);assert.equal(paths[0],target.articlePath);assert.ok(added[target.pointerPath]);}else{assert.ok(added[articlePath]);assert.ok(added[pointerPath]);}assert.equal(Object.keys(added).filter(path=>/^src\/content\/maintenance\/history\/[a-f0-9]{64}\.json$/.test(path)).length,1);
   if(input.expectedHeadOid!==tip())return Response.json({errors:[{type:'STALE_DATA'}]});state.mutateFiles?.(added);const treeId=tree(input.expectedHeadOid,added),oid=text(['commit-tree',treeId,'-p',input.expectedHeadOid],Buffer.from(input.message.headline+'\n\n'+input.message.body));
   await state.beforeMutation?.();try{run(['update-ref','refs/heads/'+branch,oid,input.expectedHeadOid]);}catch{return Response.json({errors:[{type:'STALE_DATA'}]});}state.mutations++;await state.afterMutation?.();if(state.lost){state.lost=false;throw Error('controlled lost GraphQL response after real Git commit');}
   return Response.json({data:{createCommitOnBranch:{clientMutationId:input.clientMutationId,commit:{oid}}}});
  }
  assert.equal(request.method,'GET');const prefix='/repos/'+repository;assert.ok(url.pathname.startsWith(prefix));const path=url.pathname.slice(prefix.length);let data;
  if(path==='/git/ref/heads/'+branch)data={object:{sha:tip()}};
  else if(path.startsWith('/git/commits/'))data=commit(path.slice('/git/commits/'.length));
  else if(path.startsWith('/git/trees/')){assert.equal(url.searchParams.get('recursive'),'1');const sha=path.slice('/git/trees/'.length);data={sha,truncated:false,tree:run(['ls-tree','-r','-t','-z',sha]).toString('utf8').split('\0').filter(Boolean).map(line=>{const [meta,path]=line.split('\t'),[mode,type,sha]=meta.split(' ');return {mode,type,sha,path};})};}
  else if(path.startsWith('/git/blobs/')){const sha=path.slice('/git/blobs/'.length),bytes=run(['cat-file','blob',sha]);data={sha,encoding:'base64',size:bytes.length,content:bytes.toString('base64')};}
  else if(path==='/commits'){assert.equal(url.searchParams.get('per_page'),'2');const sha=url.searchParams.get('sha'),path=url.searchParams.get('path');assert.match(path,/^src\/content\/maintenance\/history\/[a-f0-9]{64}\.json$/);data=text(['log','--format=%H','--max-count=2',sha,'--',path]).split('\n').filter(Boolean).map(sha=>({sha}));}
  else throw Error('unexpected controlled GitHub route');return Response.json(data);
 };
 return {state,port:{kind:'controlled-github-maintenance-fixture',send},tip,append,rollback(oid){run(['update-ref','refs/heads/'+branch,oid,tip()]);},read(path,oid=tip()){return run(['show',oid+':'+path]);},commit,paths(oid=tip()){return text(['ls-tree','-r','--name-only',oid]).split('\n');},diff(base,head=tip()){return text(['diff-tree','--no-commit-id','--name-only','-r',base,head]).split('\n').filter(Boolean);}};
}
