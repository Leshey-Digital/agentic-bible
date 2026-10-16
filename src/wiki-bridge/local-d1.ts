import {Miniflare,convertV4MiniflareOptions,type V4FetchHandler} from 'miniflare';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {existsSync,lstatSync,readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {reject} from './limits.ts';
export async function localObservations(name='wiki-observations-local',prepare=false,send?:V4FetchHandler){
  if(!/^wiki-observations(?:-[a-z0-9]+)+$/.test(name))reject('unsafe_observation_store');
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();const path=join(git,name);const marker=join(path,'observations.json');
  if(existsSync(path)&&lstatSync(path).isSymbolicLink())reject('unsafe_observation_store');
  if(existsSync(marker)&&(lstatSync(marker).isSymbolicLink()||readFileSync(marker,'utf8')!=='local-synthetic-observations\n'))reject('unsafe_observation_store');
  if(!existsSync(marker)){
    if(!prepare)reject('observation_store_unavailable');
    if(existsSync(path)&&readdirSync(path).length)reject('unsafe_observation_store');
    mkdirSync(path,{recursive:true});writeFileSync(marker,'local-synthetic-observations\n');
  }
  const script=prepare?(await build({entryPoints:['tests/http-worker/entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*']})).outputFiles[0].text:'export default {fetch(){return new Response("read-only D1 binding",{status:405})}}';
  const runtime=new Miniflare({...convertV4MiniflareOptions({name:'wiki-observation-local',modules:true,script,compatibilityDate:'2026-10-16',d1Databases:{EDITORIAL_DB:'wiki-observations'},outboundService:send??(()=>{throw new Error('bridge_source_fetch_forbidden');})}),resourcePersistencePath:path});
  return {runtime,db:await runtime.getD1Database('EDITORIAL_DB'),path};
}
