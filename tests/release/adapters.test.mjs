import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import {cloudflarePorts} from '../../src/release/cloudflare.ts';import {githubReleaseReader} from '../../src/release/github.ts';import {releaseTarget} from '../../src/release/public.ts';
test('Cloudflare adapter binds GET/activation to one account/Worker, omits force and rejects split traffic',async()=>{
 const version=randomUUID(),id='a'.repeat(64),request=randomUUID(),calls=[];let split=false,active=null,unexpectedBinding=false;
 const ports=cloudflarePorts('controlled-cloudflare-token',async()=>{}, {send:async req=>{const url=new URL(req.url);assert.equal(url.origin,'https://api.cloudflare.com');assert.ok(url.pathname.startsWith('/client/v4/accounts/'+releaseTarget.account+'/workers/scripts/'+releaseTarget.worker+'/'));assert.equal(req.redirect,'manual');assert.equal(req.headers.get('authorization'),'Bearer controlled-cloudflare-token');assert.equal(url.searchParams.has('force'),false);calls.push(req.method);let result;
  if(req.method==='POST'){const body=await req.json();assert.equal(body.strategy,'percentage');assert.deepEqual(body.versions,[{version_id:version,percentage:100}]);active={versions:body.versions,strategy:body.strategy,annotations:body.annotations};result=active;}
  else if(url.pathname.endsWith('/deployments'))result={deployments:active?[split?{...active,versions:[...active.versions,...active.versions]}:active]:[]};
  else if(url.pathname.endsWith('/versions'))result={items:[{id:version,annotations:{'workers/message':'ab-candidate:'+id+':'+request}}]};
  else result={id:version,resources:{bindings:unexpectedBinding?[{name:'UNREVIEWED',type:'secret_text'}]:[{name:'ASSETS',type:'assets'}]},annotations:{'workers/message':'ab-candidate:'+id+':'+request}};return Response.json({success:true,result});}});
 assert.equal(await ports.active(),null);assert.equal(await ports.findVersion(id,request),version);assert.equal((await ports.version(version)).candidateDigest,id);await ports.activate(version,'ab-release:'+request+':'+id);assert.equal((await ports.active()).versionId,version);split=true;await assert.rejects(ports.active(),/split_traffic/);assert.equal(calls.filter(v=>v==='POST').length,1);unexpectedBinding=true;await assert.rejects(ports.version(version),/unreviewed_bindings/);
});
test('GitHub release reads require successful main-push CI, exact workflow and one immutable artifact',async()=>{
 let event='push',branch='main',conclusion='success',path='.github/workflows/validate.yml',duplicate=false;const reader=githubReleaseReader('controlled-read-token',async req=>{assert.equal(req.method,'GET');assert.equal(req.redirect,'manual');assert.ok(req.url.startsWith('https://api.github.com/repos/Leshey-Digital/agentic-bible/'));if(req.url.includes('/artifacts')){const row={id:1,name:'release-candidate',expired:false,digest:'sha256:'+'b'.repeat(64)};return Response.json({artifacts:duplicate?[row,row]:[row]});}return Response.json({repository:{full_name:'Leshey-Digital/agentic-bible'},path,event,head_branch:branch,conclusion,status:'completed',head_sha:'a'.repeat(40)});});
 assert.equal((await reader.ci(1)).head_sha,'a'.repeat(40));assert.equal((await reader.artifact(1,'release-candidate')).id,1);event='pull_request';await assert.rejects(reader.ci(1));event='push';branch='feature';await assert.rejects(reader.ci(1));branch='main';conclusion='failure';await assert.rejects(reader.ci(1));conclusion='success';path='.github/workflows/other.yml';await assert.rejects(reader.ci(1));duplicate=true;await assert.rejects(reader.artifact(1,'release-candidate'));
});
test('live workflow entrypoint remains closed without owner enablement and exact main workflow context',()=>{
 const result=spawnSync(process.execPath,['scripts/release-workflow.mjs'],{encoding:'utf8',env:{PATH:process.env.PATH,GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Leshey-Digital/agentic-bible',GITHUB_REF:'refs/heads/main',RELEASE_OWNER_ENABLED:'false'}});assert.notEqual(result.status,0);assert.match(result.stderr,/release_disabled_outside_owner_enabled_main_workflow/);assert.ok(!result.stderr.includes('controlled-read-token'));
});
test('version reconciliation validates all matches, respects durable selection and stays bounded',async()=>{
 const id='a'.repeat(64),request=randomUUID(),marker='ab-candidate:'+id+':'+request,ids=Array.from({length:6},(_,i)=>'00000000-0000-4000-a000-00000000000'+i);
 async function lookup({listed=ids,selected,detail={},markerOverride=marker}={}){
  const calls=[],ports=cloudflarePorts('controlled-cloudflare-token',async()=>{}, {send:async req=>{
   calls.push(req.url);assert.equal(req.method,'GET');assert.ok(req.url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+releaseTarget.account+'/workers/scripts/'+releaseTarget.worker+'/versions'));
   const path=new URL(req.url).pathname,version=path.split('/').at(-1),result=path.endsWith('/versions')?{items:listed.map(version=>({id:version,annotations:{'workers/message':marker}}))}:{id:version,resources:{bindings:[{name:'ASSETS',type:'assets'}]},annotations:{'workers/message':markerOverride},...detail};return Response.json({success:true,result});
  }});return {result:await ports.findVersion(id,request,selected),calls};
 }
 const bounded=await lookup({listed:[...ids].reverse()});assert.equal(bounded.result,ids[0]);assert.equal(bounded.calls.length,7);
 assert.equal((await lookup({selected:ids[5]})).result,ids[5]);
 assert.equal((await lookup({listed:[]})).result,null);
 await assert.rejects(lookup({listed:[],selected:ids[0]}),/selection_missing/);
 await assert.rejects(lookup({selected:randomUUID()}),/selection_missing/);
 await assert.rejects(lookup({listed:[...ids,randomUUID()]}),/duplicate_version_limit/);
 await assert.rejects(lookup({listed:Array(100).fill(ids[0])}),/history_boundary/);
 await assert.rejects(lookup({listed:[ids[0],ids[0]]}),/history_conflict/);
 await assert.rejects(lookup({listed:['../wrong-target']}),/history_conflict/);
 await assert.rejects(lookup({detail:{id:randomUUID()}}),/foreign_version/);
 await assert.rejects(lookup({markerOverride:'ab-candidate:'+id+':'+randomUUID()}),/marker_conflict/);
});
