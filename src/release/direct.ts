import {readFileSync} from 'node:fs';import {join,extname} from 'node:path';
import {verifyCandidate,digest} from './artifact.ts';
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
const mime=(p:string)=>({'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.txt':'text/plain','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'}[extname(p)]??'application/octet-stream');
export function directUploadPlan(root:string,id:string,requestId:string){
 const {candidate}=verifyCandidate(root,id);if(!uuid(requestId))throw Error('release_request_id');
 const manifest:Record<string,{hash:string;size:number}>={},files:Record<string,{content:string;contentType:string}>={},modules=[{name:'worker.js',content_type:'application/javascript+module',content_base64:readFileSync(join(root,'worker/worker.js')).toString('base64')}];
 for(const [path,file]of Object.entries(candidate.assets)){
  const data=readFileSync(join(root,'assets',path));if(data.length!==file.bytes||digest(data)!==file.sha256)throw Error('release_asset_changed');
  if(['_headers','_redirects'].includes(path)){modules.push({name:path,content_type:'text/plain',content_base64:data.toString('base64')});continue;}
  const content=data.toString('base64'),hash=digest(content+extname(path).slice(1)).slice(0,32),contentType=mime(path);
  if(files[hash]&&(files[hash].content!==content||files[hash].contentType!==contentType))throw Error('release_asset_hash_collision');
  files[hash]={content,contentType};manifest['/'+path]={hash,size:data.length};
 }
 const config=JSON.parse(readFileSync(join(root,'wrangler.json'),'utf8'));
 return {manifest,files,version:{main_module:'worker.js',modules,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags,bindings:[{type:'assets',name:'ASSETS'}],annotations:{'workers/message':'ab-candidate:'+id+':'+requestId,'workers/tag':id.slice(0,32)},assets:{config:{html_handling:config.assets.html_handling,not_found_handling:config.assets.not_found_handling,run_worker_first:config.assets.run_worker_first}}}};
}
