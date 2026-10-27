import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {fixture,git} from './fixture.mjs';
import {canonical,digest} from '../../src/release/artifact.ts';
import {releaseTarget} from '../../src/release/public.ts';
import {qualificationSteps,validationSteps,qualificationManifestDigest} from '../../src/release/qualification.ts';
import {expectedStagingBindings} from '../../src/release/bindings.ts';
import {executeQualifiedLegacyRollback} from '../../src/release/local.ts';
import {createLegacyBaseline,baselineDigest,validateLegacyBaseline,legacyRuntimeSource} from '../../src/release/legacy-baseline.ts';
import {cloudflarePorts} from '../../src/release/cloudflare.ts';
import {controlConnectorCode} from '../../src/release/capsule.ts';

let built;
async function artifacts(){
 if(!built){const f=await fixture(),baseline=await f.revision('A pinned pre-controller legacy baseline remains an exact immutable version.'),candidate=await f.revision('A separately qualified release can restore the pinned baseline without changing its identity.');built={f,baseline,candidate};}
 return built;
}
function qualification(candidate){
 const root=mkdtempSync(join(git,'legacy-rollback-qualification-'));cpSync(candidate.root,join(root,'candidate'),{recursive:true});mkdirSync(join(root,'logs'));
 const checks=qualificationSteps.map((step,index)=>{const log='logs/'+String(index).padStart(2,'0')+'.log',bytes=Buffer.from('controlled qualification record '+step+'\n');writeFileSync(join(root,log),bytes);return {step,phase:index<validationSteps.length?'validate':'post-validate',manifestIndex:index,exit:0,log,bytes:bytes.length,sha256:digest(bytes),durationMs:1};});
 const value={schemaVersion:4,mode:'saved-coding-environment',state:'qualified',repository:'Leshey-Digital/agentic-bible',sourceCommit:candidate.candidate.sourceCommit,sourceTree:candidate.candidate.sourceTree,candidateDigest:candidate.id,validationManifestDigest:qualificationManifestDigest,node:'24.19.0',npm:'11.9.0',chromium:'154.0.8037.57',startedAt:1,completedAt:2,checks};writeFileSync(join(root,'qualification.json'),canonical(value));const id=digest(canonical(value));writeFileSync(join(root,'qualification.sha256'),id+'\n');return {root,id};
}
function legacyBaseline(baseline){
 const createdOn='2026-10-19T15:08:26.091042Z',versionId=randomUUID(),releaseManifest={schemaVersion:1,sourceCommit:legacyRuntimeSource,sourceTree:baseline.candidate.sourceTree,buildId:'',assetsHash:'d'.repeat(64),target:releaseTarget};releaseManifest.buildId=digest(canonical({sourceCommit:releaseManifest.sourceCommit,sourceTree:releaseManifest.sourceTree,assetsHash:releaseManifest.assetsHash,target:releaseManifest.target}));const manifestBytes=Buffer.from(JSON.stringify(releaseManifest)+'\n'),runtime={schemaVersion:1,sourceCommit:legacyRuntimeSource,status:200,body:{schemaVersion:1,contentAuthority:'github-build',releaseCommit:legacyRuntimeSource,releaseVerified:false,releaseManifestVerified:true,releaseManifestSha256:digest(manifestBytes),releaseBuildId:releaseManifest.buildId,releaseVerification:'compiled-worker-manifest-binding',publicIntake:false,adminVerifierConfigured:true,adminApprovalsConfigured:false,gitHubProposalsConfigured:false,hostedCanonicalWrites:false,localFixtureIdentity:false}};
 const assets=Object.fromEntries(Object.entries(baseline.candidate.assets).filter(([path])=>!['_headers','_redirects'].includes(path)).map(([path,file])=>[path,{bytes:file.bytes,sha256:file.sha256}]));
 assets['release.json']={bytes:manifestBytes.length,sha256:digest(manifestBytes)};
 return createLegacyBaseline({originalDeployment:{id:randomUUID(),createdOn,source:'api',strategy:'percentage',versionId,percentage:100},version:{versionId,number:5,createdOn,source:'api',etag:'a'.repeat(64),candidateMessage:null,bindings:expectedStagingBindings.map(x=>({...x}))},releaseManifest,assets,runtime},Date.now());
}
function portsFor(baseline,candidate,baselineCandidate,changes={}){
 const requestId=randomUUID(),activeVersion=randomUUID(),operation='ab-release:'+randomUUID()+':'+candidate.id,state={active:{versionId:activeVersion,operation},version:structuredClone(baseline.baseline.version),uploads:0,activations:0,legacyReads:0},roots=new Map([[baseline.baseline.version.versionId,baselineCandidate.root],[activeVersion,candidate.root]]);
 const ports={
  active:async()=>structuredClone(state.active),
  version:async id=>({versionId:id,candidateDigest:candidate.id}),
  legacyVersion:async id=>{state.legacyReads++;return {...structuredClone(state.version),versionId:id,...changes.version};},
  activateLegacy:async(id,op,expectedActive,pinned,digestValue)=>{assert.equal(state.active.versionId,expectedActive);assert.equal(id,pinned.versionId);assert.equal(digestValue,baseline.digest);state.activations++;state.active={versionId:id,operation:op};},
  findVersion:async()=>null,
  upload:async()=>{state.uploads++;throw Error('legacy rollback must not upload');},
  activate:async()=>{throw Error('legacy rollback must use the guarded baseline action');},
  assertSource:async()=>{},
  read:async path=>{
   const root=roots.get(state.active?.versionId);if(!root)throw Error('unknown controlled served version');
   if(path==='/api/runtime/status'){
    return Response.json(baseline.baseline.runtime.body);
   }
    const manifest=baseline.baseline.runtime.body.releaseBuildId;const {publicPath}=await import('../../src/release/controller.ts');const target=Object.keys(baseline.baseline.assets).find(key=>publicPath(key,manifest)===path);if(!target)throw Error('unexpected controlled path');
   if(target==='release.json'){const m=baseline.baseline.releaseManifest;return new Response(Buffer.from(JSON.stringify({schemaVersion:m.schemaVersion,sourceCommit:m.sourceCommit,sourceTree:m.sourceTree,buildId:m.buildId,assetsHash:m.assetsHash,target:{account:m.target.account,worker:m.target.worker,origin:m.target.origin}})+'\n'),{status:200,headers:{'X-Robots-Tag':'noindex, nofollow'}});}
   return new Response(readFileSync(join(root,'assets',target)),{status:target==='404.html'?404:200,headers:{'X-Robots-Tag':'noindex, nofollow'}});
  },
 };
 if(changes.state)Object.assign(state,changes.state);
 return {ports,state,requestId,activeVersion,operation};
}
function writeBaseline(f,baseline){const path=join(f.root,'.git','legacy-baseline-'+randomUUID()+'.json');writeFileSync(path,canonical(baseline));return path;}
function reviewFor(candidate,q,baseline){return {decision:'accepted',sourceCommit:candidate.candidate.sourceCommit,candidateDigest:candidate.id,qualificationDigest:q.id,legacyBaselineDigest:baseline.digest};}

test('guarded legacy rollback restores the exact reviewed baseline without upload and replays its separate journal',{timeout:30000},async()=>{
 const {f,baseline:candidateBaseline,candidate}=await artifacts(),baseline=legacyBaseline(candidateBaseline),q=qualification(candidate),baselinePath=writeBaseline(f,baseline.baseline),{ports,state,requestId,activeVersion}=portsFor(baseline,candidate,candidateBaseline),journal=join(f.root,'.git','legacy-rollback-'+randomUUID()+'.json');
 const record=await executeQualifiedLegacyRollback(f.root,q.root,baselinePath,reviewFor(candidate,q,baseline),{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,journal);
 assert.equal(record.state,'legacy-baseline-restored');assert.equal(record.versionId,baseline.baseline.version.versionId);assert.equal(record.legacyBaselineDigest,baseline.digest);assert.ok(record.verifiedAssets>0);assert.equal(state.uploads,0);assert.equal(state.activations,1);assert.equal(JSON.parse(readFileSync(journal,'utf8')).kind,'legacy-baseline-rollback');assert.equal(JSON.parse(readFileSync(journal,'utf8')).state,'verified');
 const replay=await executeQualifiedLegacyRollback(f.root,q.root,baselinePath,reviewFor(candidate,q,baseline),{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,journal);assert.deepEqual(replay,record);assert.equal(state.activations,1);
});

test('legacy baseline record rejects candidate markers, altered bindings and non-canonical evidence',async()=>{
 const {baseline}=await artifacts(),valid=legacyBaseline(baseline).baseline;
 const marked=structuredClone(valid);marked.version.candidateMessage='ab-candidate:'+'b'.repeat(64)+':'+randomUUID();assert.throws(()=>validateLegacyBaseline(marked),/baseline/);
 const secret=structuredClone(valid);secret.version.bindings.find(x=>x.type==='secret_text').text='never read or store secret values';assert.throws(()=>baselineDigest(secret),/baseline_version/);
 const wrongD1=structuredClone(valid);wrongD1.version.bindings.find(x=>x.type==='d1').id='f'.repeat(36);assert.throws(()=>baselineDigest(wrongD1),/baseline_version/);
 const objectName=structuredClone(valid);objectName.version.bindings.find(x=>x.name==='ASSETS').name=['ASSETS'];assert.throws(()=>baselineDigest(objectName),/baseline_version/);
 const objectType=structuredClone(valid);objectType.version.bindings.find(x=>x.name==='ASSETS').type=['assets'];assert.throws(()=>baselineDigest(objectType),/baseline_version/);
 const objectD1Id=structuredClone(valid);objectD1Id.version.bindings.find(x=>x.type==='d1').id=[expectedStagingBindings.find(x=>x.type==='d1').id];assert.throws(()=>baselineDigest(objectD1Id),/baseline_version/);
});

test('legacy runtime acceptance is exact, versioned and pinned to the real b41a422 source shape',async()=>{
 const {baseline}=await artifacts(),valid=legacyBaseline(baseline).baseline;
 assert.equal(valid.runtime.schemaVersion,1);assert.equal(valid.runtime.sourceCommit,'b41a422881921638833f92b2361a70eb1647d01f');
 assert.notEqual(valid.runtime.body.releaseBuildId,baseline.candidate.buildId,'the observed legacy build pin is independent of a local candidate reconstruction');
 assert.deepEqual(Object.keys(valid.runtime.body).sort(),['adminApprovalsConfigured','adminVerifierConfigured','contentAuthority','gitHubProposalsConfigured','hostedCanonicalWrites','localFixtureIdentity','publicIntake','releaseBuildId','releaseCommit','releaseManifestSha256','releaseManifestVerified','releaseVerification','releaseVerified','schemaVersion'].sort());
 for(const change of [
  value=>{value.runtime.sourceCommit='c'.repeat(40);},
  value=>{value.runtime.body.releaseCommit='c'.repeat(40);},
  value=>{value.runtime.body.integrationSettingsConfigured=true;},
  value=>{delete value.runtime.body.releaseVerification;},
  value=>{value.runtime.body.adminApprovalsConfigured=true;},
 ]){
  const altered=structuredClone(valid);change(altered);assert.throws(()=>validateLegacyBaseline(altered),/release_legacy_baseline_runtime/);
 }
 const alteredManifest=structuredClone(valid);alteredManifest.assets['release.json'].sha256='f'.repeat(64);assert.throws(()=>validateLegacyBaseline(alteredManifest),/release_legacy_baseline_manifest/);
});

test('tampering with a legacy runtime build pin breaks its observed manifest binding before provider reads',async()=>{
 const {f,baseline:candidateBaseline,candidate}=await artifacts(),baseline=legacyBaseline(candidateBaseline),tampered=structuredClone(baseline.baseline);tampered.runtime.body.releaseBuildId='c'.repeat(64);
 const q=qualification(candidate),path=writeBaseline(f,tampered),{ports,state,requestId,activeVersion}=portsFor(baseline,candidate,candidateBaseline);
 await assert.rejects(executeQualifiedLegacyRollback(f.root,q.root,path,reviewFor(candidate,q,baseline),{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,join(f.root,'.git','legacy-runtime-tamper-'+randomUUID()+'.json')),/release_legacy_baseline_manifest/);
 assert.equal(state.legacyReads,0);assert.equal(state.activations,0);
});

test('stale expected-active and provider version ETag, creation, number or binding changes stop before activation',{timeout:30000},async()=>{
 const {f,baseline:candidateBaseline,candidate}=await artifacts(),baseline=legacyBaseline(candidateBaseline),q=qualification(candidate),baselinePath=writeBaseline(f,baseline.baseline);
 for(const change of [
  {version:{etag:'f'.repeat(64)}},
  {version:{createdOn:'2026-10-19T15:08:27.000000Z'}},
  {version:{number:6}},
  {version:{bindings:baseline.baseline.version.bindings.map(x=>x.name==='EDITORIAL_DB'?{...x,id:'f'.repeat(36)}:x)}},
  {version:{bindings:[...baseline.baseline.version.bindings,{name:'EXTRA',type:'secret_text'}]}},
 ]){
  const {ports,state,requestId,activeVersion}=portsFor(baseline,candidate,candidateBaseline,change),journal=join(f.root,'.git','legacy-tamper-'+randomUUID()+'.json');
  await assert.rejects(executeQualifiedLegacyRollback(f.root,q.root,baselinePath,reviewFor(candidate,q,baseline),{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,journal),/legacy_baseline_version_changed/);assert.equal(state.activations,0);assert.equal(state.uploads,0);
 }
 const stale=portsFor(baseline,candidate,candidateBaseline);stale.state.active={versionId:randomUUID(),operation:'foreign'};
 await assert.rejects(executeQualifiedLegacyRollback(f.root,q.root,baselinePath,reviewFor(candidate,q,baseline),{ownerEnabled:true,exclusiveWriter:true,requestId:stale.requestId,expectedActive:stale.activeVersion},stale.ports,join(f.root,'.git','legacy-stale-'+randomUUID()+'.json')),/active_changed/);assert.equal(stale.state.activations,0);
});

test('changed restored asset bytes or runtime policy leaves the legacy rollback journal unverified',{timeout:30000},async()=>{
 const {f,baseline:candidateBaseline,candidate}=await artifacts(),baseline=legacyBaseline(candidateBaseline),q=qualification(candidate),baselinePath=writeBaseline(f,baseline.baseline);
 for(const mode of ['asset','runtime']){
  const {ports,state,requestId,activeVersion}=portsFor(baseline,candidate,candidateBaseline),journal=join(f.root,'.git','legacy-served-change-'+randomUUID()+'.json'),read=ports.read;
  ports.read=async path=>{
   if(mode==='asset'&&path==='/')return new Response('changed baseline bytes',{status:200,headers:{'X-Robots-Tag':'noindex, nofollow'}});
   if(mode==='runtime'&&path==='/api/runtime/status'){return Response.json({...baseline.baseline.runtime.body,publicIntake:true});}
   return read(path);
  };
  await assert.rejects(executeQualifiedLegacyRollback(f.root,q.root,baselinePath,reviewFor(candidate,q,baseline),{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,journal),mode==='asset'?/legacy_served_bytes_changed/:/legacy_runtime_changed/);
  const saved=JSON.parse(readFileSync(journal,'utf8'));assert.equal(saved.state,'verifying');assert.equal(saved.record,undefined);assert.equal(state.uploads,0);
 }
});

test('legacy baseline digest, reviewer pin and owner guards reject before provider reads',{timeout:30000},async()=>{
 const {f,baseline:candidateBaseline,candidate}=await artifacts(),baseline=legacyBaseline(candidateBaseline),q=qualification(candidate),baselinePath=writeBaseline(f,baseline.baseline),{ports,state,requestId,activeVersion}=portsFor(baseline,candidate,candidateBaseline);
 await assert.rejects(executeQualifiedLegacyRollback(f.root,q.root,baselinePath,{...reviewFor(candidate,q,baseline),legacyBaselineDigest:'f'.repeat(64)},{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,join(f.root,'.git','legacy-bad-digest-'+randomUUID()+'.json')),/baseline_digest_mismatch/);assert.equal(state.legacyReads,0);assert.equal(state.activations,0);
 await assert.rejects(executeQualifiedLegacyRollback(f.root,q.root,baselinePath,reviewFor(candidate,q,baseline),{ownerEnabled:false,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,join(f.root,'.git','legacy-no-owner-'+randomUUID()+'.json')),/independent_review/);assert.equal(state.legacyReads,0);
 await assert.rejects(executeQualifiedLegacyRollback(f.root,q.root,baselinePath,{...reviewFor(candidate,q,baseline),decision:'pending'},{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive:activeVersion},ports,join(f.root,'.git','legacy-no-review-'+randomUUID()+'.json')),/independent_review/);assert.equal(state.legacyReads,0);
});

test('Cloudflare connector and control capsule re-fetch exact legacy identity and bindings before deployment',{timeout:15000},async()=>{
 const versionId=randomUUID(),expectedActive=randomUUID(),requestId=randomUUID(),baseline={versionId,number:5,createdOn:'2026-10-19T15:08:26.091042Z',source:'api',etag:'a'.repeat(64),candidateMessage:null,bindings:expectedStagingBindings.map(x=>({...x}))},body={strategy:'percentage',versions:[{version_id:versionId,percentage:100}],annotations:{'workers/message':'ab-legacy-rollback:'+requestId+':'+digest('baseline')}},baselineDigest=body.annotations['workers/message'].split(':')[2],legacyGuard={baselineDigest,version:baseline};
 let active={strategy:'percentage',versions:[{version_id:expectedActive,percentage:100}],annotations:{'workers/message':'ab-release:'+randomUUID()+':'+'b'.repeat(64)}},versionOverride={},posts=0;
 const send=async req=>{const url=new URL(req.url),method=req.method;let result;if(url.pathname.endsWith('/deployments')&&method==='GET')result={deployments:[active]};else if(url.pathname.endsWith('/versions/'+versionId))result={id:versionId,number:5,metadata:{created_on:baseline.createdOn,source:'api'},resources:{script:{etag:versionOverride.etag??baseline.etag},bindings:versionOverride.bindings??baseline.bindings},annotations:versionOverride.annotations??{}};else if(url.pathname.endsWith('/deployments')&&method==='POST'){posts++;active={strategy:'percentage',versions:[{version_id:versionId,percentage:100}],annotations:body.annotations};result=active;}else throw Error('unexpected test route');return Response.json({success:true,result});};
 const ports=cloudflarePorts('controlled-cloudflare-token',async()=>{},{send});
 assert.deepEqual(await ports.legacyVersion(versionId),baseline);await ports.activateLegacy(versionId,body.annotations['workers/message'],expectedActive,baseline,baselineDigest);assert.equal(posts,1);
 for(const override of [{etag:'f'.repeat(64)},{bindings:baseline.bindings.slice(1)},{annotations:{'workers/message':'ab-candidate:'+'c'.repeat(64)+':'+randomUUID()}}]){active={strategy:'percentage',versions:[{version_id:expectedActive,percentage:100}],annotations:{'workers/message':'ab-release:'+randomUUID()+':'+'b'.repeat(64)}};versionOverride=override;await assert.rejects(ports.activateLegacy(versionId,body.annotations['workers/message'],expectedActive,baseline,baselineDigest),/baseline_version_changed|legacy_version_unreviewed/);assert.equal(posts,1);}
 const capsuleCall=async(override)=>{
  let activations=0;const code=controlConnectorCode('/deployments',body,expectedActive,legacyGuard),version={id:versionId,number:5,metadata:{created_on:baseline.createdOn,source:'api'},resources:{script:{etag:override.etag??baseline.etag},bindings:override.bindings??baseline.bindings},annotations:override.annotations??{}};
  const cloudflare={request:async req=>{if(req.path.endsWith('/deployments')&&req.method==='GET')return {status:200,success:true,result:{deployments:[active]}};if(req.path.endsWith('/versions/'+versionId))return {status:200,success:true,result:version};if(req.path.endsWith('/deployments')&&req.method==='POST'){activations++;return {status:200,success:true,result:{}};}throw Error('unexpected capsule call');}};
  let result;try{result=await runInNewContext(code,{cloudflare})();}catch(error){return {error:error.message,activations};}return {result,activations};
 };
 active={strategy:'percentage',versions:[{version_id:expectedActive,percentage:100}],annotations:{'workers/message':'ab-release:'+randomUUID()+':'+'b'.repeat(64)}};
 const ok=await capsuleCall({});assert.equal(ok.activations,1);assert.equal(ok.result.status,200);
 for(const override of [{etag:'d'.repeat(64)},{bindings:baseline.bindings.slice(1)}]){const rejected=await capsuleCall(override);assert.equal(rejected.activations,0);assert.match(rejected.error,/baseline_version_changed|version_binding/);}
});
