import assert from 'node:assert/strict';
import {hostedHistoryFixture,origin} from '../maintenance-history/hosted-fixture.mjs';
import {verifySignedAdmin} from '../../src/hosted/identity.ts';
export async function restorationFixture(site){
 site.remote.rollback(site.writerReceipts[0].commit);Object.assign(site.remote.state,{beforeMutation:null,afterMutation:null,mutateFiles:null,override:null,lost:false,hold:null});const app=await hostedHistoryFixture(site,{restoration:true});
 const signedRequest=async(path,body,options={})=>app.dispatch('/api/admin/maintenance/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':options.token??await app.token(),...options.headers},body:body===undefined?undefined:JSON.stringify(body)});
 const admin=async()=>{const value=await verifySignedAdmin(new Request(origin+'/api/admin/maintenance/restore-approval',{method:'POST',headers:{Origin:origin,'X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':await app.token()}}),app.trust);assert.ok(value);return value;};
 const context=async(overrides={})=>({enabled:true,admin:await admin(),db:app.db,repo:process.cwd(),canonicalRepo:site.remote.state.root,transport:site.remote.port,...overrides});
 const requestInput=app.input({decision:'revert-requested',targetCommit:site.writerReceipts[1].commit,note:'Controlled review requests restoration of the earlier retained source after reading both exact revision records.'});assert.equal((await app.request(requestInput)).status,200);
 const approvalId=crypto.randomUUID(),selection={approvalId},approve=()=>signedRequest('restore-approval',{approvalId,requestId:requestInput.requestId,confirm:'approve-canonical-restoration'});
 return {site,app,signedRequest,admin,context,requestInput,approvalId,selection,approve,close:()=>app.close()};
}
