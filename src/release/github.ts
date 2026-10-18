import {responseJson} from './network.ts';
const repository='Leshey-Digital/agentic-bible';
export function githubReleaseReader(token:string,send:typeof fetch=fetch){
 if(!token||/\s/.test(token))throw Error('release_github_read_token_required');let calls=0;
 async function get(path:string){if(++calls>16)throw Error('release_github_read_budget');const response=await send(new Request('https://api.github.com/repos/'+repository+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},redirect:'manual',signal:AbortSignal.timeout(5000)}));if(response.status!==200||response.redirected)throw Error('release_github_read_failed');return responseJson(response);}
 return {
  main:async()=>{const value=await get('/git/ref/heads/main');if(!/^[a-f0-9]{40}$/.test(value?.object?.sha))throw Error('release_github_main');return value.object.sha as string;},
  ci:async(runId:number)=>{if(!Number.isSafeInteger(runId)||runId<1)throw Error('release_ci_id');const run=await get('/actions/runs/'+runId);if(run.repository?.full_name!==repository||run.path!=='.github/workflows/validate.yml'||run.event!=='push'||run.head_branch!=='main'||run.status!=='completed'||run.conclusion!=='success'||!/^[a-f0-9]{40}$/.test(run.head_sha))throw Error('release_successful_main_ci_required');return run;},
  receiptRun:async(runId:number)=>{if(!Number.isSafeInteger(runId)||runId<1)throw Error('release_receipt_run');const run=await get('/actions/runs/'+runId);if(run.repository?.full_name!==repository||run.path!=='.github/workflows/release-staging.yml'||run.event!=='workflow_dispatch'||run.head_branch!=='main'||run.status!=='completed'||run.conclusion!=='success')throw Error('release_prior_receipt_run_required');return run;},
  artifact:async(runId:number,name:string)=>{if(!['release-candidate','release-receipt'].includes(name))throw Error('release_artifact_name');const value=await get('/actions/runs/'+runId+'/artifacts?per_page=100');if(!Array.isArray(value.artifacts)||value.artifacts.length>=100)throw Error('release_artifact_list');const list=value.artifacts.filter((v:any)=>v.name===name&&!v.expired);if(list.length!==1||!/^sha256:[a-f0-9]{64}$/.test(list[0].digest))throw Error('release_immutable_artifact_required');return list[0];},
 };
}
