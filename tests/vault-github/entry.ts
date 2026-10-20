// Disposable local harness only; never included in a deployment config.
import worker from '../../src/hosted/worker.ts';
import {configuredPorts} from '../../src/hosted/configuration.ts';
import type {Ports,RuntimeEnv} from '../../src/hosted/contracts.ts';
let retained:Ports['sendGitHub'];
export default {async fetch(request:Request,env:RuntimeEnv){
 const path=new URL(request.url).pathname;
 if(path.startsWith('/__probe/'))try{
  const body=await request.json() as {path?:string;method?:string;deny?:boolean;aborted?:boolean};
  if(path==='/__probe/open')retained=(await configuredPorts(env,request)).sendGitHub;
  if(!retained)return Response.json({error:'closed'},{status:503});
  const abort=new AbortController();if(body.aborted)abort.abort();
  const response=await retained(new Request('https://api.github.com/repos/Leshey-Digital/agentic-bible'+(body.path??'/git/ref/heads/main'),{method:body.method??'GET',redirect:'manual',credentials:'omit',signal:abort.signal}),async()=>{if(body.deny)throw Error('revoked');});
  await response.arrayBuffer();return Response.json({ok:true});
 }catch{return Response.json({error:'unavailable'},{status:503});}
 return worker.fetch(request,env);
}};
