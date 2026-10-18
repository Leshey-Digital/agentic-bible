import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cloudflarePorts} from '../../../src/release/cloudflare.ts';
import {executeRelease} from '../../../src/release/controller.ts';
import {releaseTarget} from '../../../src/release/public.ts';
export function controlledPorts(origin,evidence,{interrupt=false,allowUpload=false}={}){
 return cloudflarePorts('controlled-cloudflare-token',async()=>{}, {
  send:req=>{const url=new URL(req.url);if(url.origin==='https://api.cloudflare.com'&&url.pathname.startsWith('/client/v4/accounts/'+releaseTarget.account+'/workers/scripts/'+releaseTarget.worker+'/'))return fetch(new Request(origin+url.pathname.slice('/client/v4'.length)+url.search,req));if(url.origin===releaseTarget.origin)return fetch(new Request(origin+'/public'+url.pathname,req));throw Error('unexpected adapter target');},
  uploadCommand:(executable,args,options)=>{
   if(!allowUpload)throw Error('unexpected reupload');
   const result=execFileSync(executable,args,{...options,env:{...options.env,CLOUDFLARE_API_BASE_URL:origin,NODE_OPTIONS:'--import '+pathToFileURL(resolve('tests/release/support/deny-external.mjs')).href,AB_RELEASE_NETWORK_EVIDENCE:evidence}});
   // The provider and CLI completed. Kill before executeRelease can save the version ID.
   if(interrupt)process.kill(process.pid,'SIGKILL');return result;
  }
 });
}
if(process.argv[1]===new URL(import.meta.url).pathname){const plan=JSON.parse(readFileSync(process.argv[2]));await executeRelease(plan.root,plan.permit,controlledPorts(plan.origin,plan.evidence,{interrupt:true,allowUpload:true}),plan.journal);}
