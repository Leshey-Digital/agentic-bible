import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixture,git} from './fixture.mjs';
import {controlledPorts} from './support/operation.mjs';
import {executeRelease} from '../../src/release/controller.ts';
import {verifyCandidate} from '../../src/release/artifact.ts';
const providerScript=resolve('tests/release/support/provider.mjs'),runner=resolve('tests/release/support/operation.mjs');
const permit=a=>({ownerEnabled:true,environment:'staging',repository:'Leshey-Digital/agentic-bible',sourceCommit:a.candidate.sourceCommit,qualificationDigest:'b'.repeat(64),reviewedQualificationDigest:'b'.repeat(64),exclusiveWriter:true,candidateDigest:a.id,requestId:randomUUID(),expectedActive:null,action:'deploy'});
async function provider(root,fault){
 const directory=mkdtempSync(join(git,'release-cli-recovery-')),statePath=join(directory,'provider.json'),evidence=join(directory,'network.jsonl');
 writeFileSync(statePath,JSON.stringify({fault,versions:[],calls:[],active:null,activations:0}));
 const child=fork(providerScript,[statePath,root],{stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',b=>errors+=b);
 const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('controlled provider startup deadline'));},5000);child.once('message',({port})=>{clearTimeout(timer);resolve('http://127.0.0.1:'+port);});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',()=>{clearTimeout(timer);reject(Error(errors));});});
 const read=()=>JSON.parse(readFileSync(statePath)),write=value=>writeFileSync(statePath,JSON.stringify(value));
 return {directory,statePath,evidence,origin,read,write,close:async()=>{const exited=new Promise(done=>child.once('exit',done));child.kill();await exited;assert.equal(errors,'');}};
}
test('pinned Wrangler retries ambiguous creates; SIGKILL and same-UUID replay reconcile duplicates safely',{timeout:120000},async t=>{
 const f=await fixture(),a=await f.revision(),proof=[];
 for(const fault of ['drop','500']){await t.test(fault,async()=>{
  const remote=await provider(a.root,fault);try{
   const p=permit(a),journal=join(remote.directory,'journal.json'),plan={root:a.root,permit:p,origin:remote.origin,evidence:remote.evidence,journal},planPath=join(remote.directory,'plan.json');writeFileSync(planPath,JSON.stringify(plan));
   const killed=spawnSync(process.execPath,[runner,planPath],{encoding:'utf8',timeout:30000});assert.equal(killed.signal,'SIGKILL',killed.stderr);
   const state=remote.read();assert.equal(state.versions.length,2,'actual pinned CLI must create two versions');assert.equal(state.activations,0);assert.equal(JSON.parse(readFileSync(journal)).state,'upload-pending');assert.equal(JSON.parse(readFileSync(journal)).versionId,null);
   for(const row of state.versions){assert.equal(row.workerSha256,a.candidate.workerSha256);assert.equal(row.annotations['workers/message'],'ab-candidate:'+a.id+':'+p.requestId);assert.deepEqual(row.resources.bindings,[{name:'ASSETS',type:'assets'}]);}
   const blocked=existsSync(remote.evidence)?readFileSync(remote.evidence,'utf8').trim().split('\n').map(JSON.parse):[];assert.ok(blocked.every(row=>row.blocked&&row.host==='registry.npmjs.org'&&row.method==='GET'),'only blocked package-update reads are permitted');assert.equal(verifyCandidate(a.root).id,a.id);
   const ports=controlledPorts(remote.origin,remote.evidence),selected=state.versions.map(v=>v.id).sort()[0],sibling=state.versions.find(v=>v.id!==selected).id;
   assert.equal(await controlledPorts(remote.origin,remote.evidence).findVersion(a.id,p.requestId),selected);
   remote.write({...state,reverse:true});assert.equal(await controlledPorts(remote.origin,remote.evidence).findVersion(a.id,p.requestId),selected);
   for(const [override,error]of [
    [{resources:{bindings:[{name:'UNREVIEWED',type:'secret_text'}]}},/unreviewed_bindings/],
    [{annotations:{'workers/message':'ab-candidate:'+a.id+':'+randomUUID()}},/marker_conflict/],
    [{annotations:{'workers/message':'ab-candidate:'+'f'.repeat(64)+':'+p.requestId}},/marker_conflict/],
    [{id:randomUUID()},/foreign_version/]
   ]){
    remote.write({...state,detailOverrides:{[sibling]:override}});
    await assert.rejects(executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence),journal),error);
    assert.equal(remote.read().activations,0);assert.equal(remote.read().versions.length,2);
   }
   remote.write(state);
   const changedSource=controlledPorts(remote.origin,remote.evidence);changedSource.assertSource=async()=>{throw Error('controlled source changed');};
   await assert.rejects(executeRelease(a.root,p,changedSource,journal),/source changed/);assert.equal(remote.read().activations,0);
   // The selected ID is now journaled, but every sibling must still validate on replay.
   remote.write({...state,detailOverrides:{[sibling]:{resources:{bindings:[]}}}});
   await assert.rejects(executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence),journal),/unreviewed_bindings/);assert.equal(remote.read().activations,0);
   remote.write({...state,active:{strategy:'percentage',versions:[{version_id:randomUUID(),percentage:100}],annotations:{'workers/message':'external writer'}}});
   await assert.rejects(executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence),journal),/active_changed/);assert.equal(remote.read().activations,0);
   remote.write({...state,versions:state.versions.filter(v=>v.id!==selected)});
   await assert.rejects(executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence),journal),/selection_missing/);assert.equal(remote.read().activations,0);assert.equal(remote.read().versions.length,1);
   remote.write({...state,active:{strategy:'percentage',versions:[{version_id:sibling,percentage:100}],annotations:{'workers/message':'ab-release:'+p.requestId+':'+a.id}}});
   await assert.rejects(executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence),journal),/selection_conflict/);assert.equal(remote.read().activations,0);
   remote.write(state);
   const competing=controlledPorts(remote.origin,remote.evidence),version=competing.version;
   competing.version=async id=>{const value=await version(id);remote.write({...remote.read(),active:{strategy:'percentage',versions:[{version_id:randomUUID(),percentage:100}],annotations:{'workers/message':'external writer'}}});return value;};
   await assert.rejects(executeRelease(a.root,p,competing,journal),/active_changed/);assert.equal(remote.read().activations,0);
   remote.write(state);
   const receipt=await executeRelease(a.root,p,ports,journal);assert.equal(receipt.versionId,selected);assert.equal(remote.read().versions.length,2);assert.equal(remote.read().activations,1);
   assert.deepEqual(await executeRelease(a.root,p,ports,journal),receipt);assert.equal(remote.read().activations,1);
   // Lost workspace after activation: retain the operation's active version even when it is not the lowest UUID.
   const activeState=remote.read();remote.write({...activeState,active:{strategy:'percentage',versions:[{version_id:sibling,percentage:100}],annotations:{'workers/message':'ab-release:'+p.requestId+':'+a.id}}});
   const resumed=await executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence),join(remote.directory,'lost-workspace.json'));
   assert.equal(resumed.versionId,sibling);assert.equal(remote.read().activations,1);
   // Serving remains an independent byte check after version reconciliation.
   remote.write({...remote.read(),wrongBytes:true});
   await assert.rejects(executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence),join(remote.directory,'bad-serving.json')),/bytes_changed|capacity/);
   assert.equal(remote.read().activations,1);assert.equal(verifyCandidate(a.root).id,a.id);
   proof.push({fault,actualWrangler:JSON.parse(readFileSync('node_modules/wrangler/package.json')).version,createdVersions:2,interruption:'SIGKILL after ports.upload returns, before uploaded journal',selectedVersion:selected,verifiedAssets:receipt.verifiedAssets,reupload:false,conflictingSiblingRejected:true,sourceAndWriterChangesRejected:true,activeSelectionRetained:true,servedCorruptionRejected:true,externalConnections:0,blockedPackageUpdateReads:blocked.length,liveDeployment:false});
  }finally{await remote.close();}
 });await t.test(fault+' successful CLI return',async()=>{
  const remote=await provider(a.root,fault);try{
   const p=permit(a),receipt=await executeRelease(a.root,p,controlledPorts(remote.origin,remote.evidence,{allowUpload:true}),join(remote.directory,'journal.json'));
   const state=remote.read();assert.equal(state.versions.length,2);assert.equal(state.activations,1);assert.equal(receipt.versionId,state.versions[1].id);
   for(const row of state.versions)assert.ok(state.calls.some(call=>call.method==='GET'&&call.path.endsWith('/versions/'+row.id)),'every sibling checked after successful CLI return');
   assert.equal(verifyCandidate(a.root).id,a.id);
   proof.push({fault,successfulCliReturn:true,createdVersions:2,allSiblingsVerified:true,verifiedAssets:receipt.verifiedAssets,liveDeployment:false});
  }finally{await remote.close();}
 });}
 writeFileSync(join(git,'release-cli-recovery-proof.json'),JSON.stringify(proof,null,2)+'\n');
});
