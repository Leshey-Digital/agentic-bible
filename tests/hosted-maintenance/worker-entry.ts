import {createHostedMaintenanceAction} from '../../src/hosted-maintenance/scheduled.ts';
import {cloudflareProseModel} from '../../src/maintenance-adapters/cloudflare-prose.ts';
import {demonstrationPolicy} from '../../src/wiki-bridge/maintenance-provider.ts';
import type {SqlDatabase} from '../../src/editorial/contracts.ts';
const at=Date.UTC(2026,9,30,12);
export default {async fetch(request:Request,env:{EDITORIAL_DB:SqlDatabase;ARTICLE:string;BASE:string;MARKDOWN_HASH:string}){
 if(new URL(request.url).pathname!=='/controlled-scheduled-tick')return new Response(null,{status:404});
 const article=JSON.parse(env.ARTICLE),action=createHostedMaintenanceAction({enabled:true,db:env.EDITORIAL_DB,clock:()=>at,cron:'0 * * * *',selection:{article,baseRevision:null,sources:[{citationId:'mcp-tools',sourceId:'s-bfba858067cc3eb54024f532'}]},policy:demonstrationPolicy,
 source:{kind:'bounded-official-http-source-v2',send:(url,init)=>fetch(url,init)},
 completeCandidate:{enabled:true,currency:{enabled:true,policy:{schemaVersion:1,unit:'MICRO_USD',account:'controlled-native-workers',runLimit:100000,dayLimit:500000,monthLimit:10000000,dayBaseline:166667,monthBaseline:5000000,price:{id:'controlled-workers-rate-v1',provider:'cloudflare-workers-ai',model:cloudflareProseModel,tokenizer:'cloudflare-reported-token-usage-v1',basis:'input-output-tokens',inputPerMillion:27000,outputPerMillion:201000,requestFee:0,validFrom:at-86400000,validUntil:at+86400000}}},ai:{async run(model,input){const result=await fetch('https://controlled-ai.invalid/complete',{method:'POST',body:JSON.stringify({model,input})});return result.json();}}},
 quality:{profile:'quality-gated-v1',minimumIndependentOrigins:1,verifier:{kind:'trusted-semantic-quality-adapter-v1',id:'controlled-worker-verifier',revision:'controlled-native-v1',environment:'controlled-test',verify:(value,signal)=>fetch('https://controlled-quality.invalid/assess',{method:'POST',body:JSON.stringify(value),signal})}},
 canonical:{enabled:true,expectedBaseCommit:env.BASE,expectedMarkdownHash:env.MARKDOWN_HASH,transport:{kind:'expected-head-maintenance-http-v1',send:request=>fetch(request)}}});
 try{return Response.json(await action.scheduled({scheduledTime:at,cron:'0 * * * *'}));}catch(error){return Response.json({error:(error as {code?:string}).code??'controlled_worker_failed'},{status:503});}
}};
