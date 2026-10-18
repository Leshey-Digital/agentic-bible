import {readCanonicalMaintenance} from '../maintenance-history/canonical.ts';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,copyFileSync,existsSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {join,resolve,dirname,relative} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {articleSource} from './source.ts';
import {releaseTarget} from './public.ts';
export const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value)+'\n';
export const digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
export const limits={files:256,bytes:16*1024*1024,fileBytes:4*1024*1024};
export const pathSafe=(p:string)=>p.length<240&&/^[a-zA-Z0-9_./-]+$/.test(p)&&p.split('/').every(s=>s!==''&&s!=='.'&&s!=='..'&&!s.startsWith('.'));
export type Inventory=Record<string,{sha256:string;bytes:number}>;
export function inventory(root:string):Inventory{
  const files:Inventory={};let bytes=0;
  function walk(dir:string){for(const name of readdirSync(dir).sort()){const path=join(dir,name),stat=lstatSync(path);if(stat.isSymbolicLink())throw Error('release_symlink');if(stat.isDirectory()){walk(path);continue;}const key=relative(root,path);if(!stat.isFile()||!pathSafe(key)||stat.size>limits.fileBytes)throw Error('release_file_rejected');bytes+=stat.size;if(bytes>limits.bytes||Object.keys(files).length>=limits.files)throw Error('release_capacity');const data=readFileSync(path);if(data.length!==stat.size)throw Error('release_file_changed');files[key]={sha256:digest(data),bytes:data.length};}}
  walk(root);return files;
}
export function runtimeConfig(){return {name:releaseTarget.worker,account_id:releaseTarget.account,main:'./worker/worker.js',compatibility_date:'2026-10-16',workers_dev:false,preview_urls:false,send_metrics:false,assets:{directory:'./assets',binding:'ASSETS',run_worker_first:['/api/*','/admin','/admin/*'],html_handling:'force-trailing-slash',not_found_handling:'404-page'},observability:{enabled:false}};}
export type Candidate={schemaVersion:1;repository:string;sourceCommit:string;sourceTree:string;buildId:string;target:typeof releaseTarget;assets:Inventory;workerSha256:string;configSha256:string;manifestSha256:string};
export async function prepareCandidate(root:string,output:string){
  root=resolve(root);output=resolve(output);if(existsSync(output))throw Error('release_output_exists');
  if(execFileSync('git',['-C',root,'status','--porcelain=v1','--untracked-files=all'],{encoding:'utf8'}).trim())throw Error('release_clean_source_required');
  const source=articleSource(root,{});if(!source.commit||!source.tree)throw Error('release_git_source_required');
  const stamp=JSON.parse(readFileSync(join(root,'dist/release-source.json'),'utf8'));if(canonical(stamp)!==canonical(source))throw Error('release_dist_source_mismatch');
  const discovery=JSON.parse(readFileSync(join(root,'dist/indexing-manifest.json'),'utf8'));if(discovery.mode!=='staging'||discovery.origin!==releaseTarget.origin||discovery.entries.length||existsSync(join(root,'dist/sitemap.xml'))||!readFileSync(join(root,'dist/_headers'),'utf8').startsWith('/*\n  X-Robots-Tag: noindex, nofollow\n'))throw Error('release_staging_required');
  const history=readCanonicalMaintenance({mode:'controlled-static-preview',repo:root,sourceCommit:source.commit}),catalog=JSON.parse(readFileSync(join(root,'dist/maintenance-history.json'),'utf8'));
  const expectedCatalog={schemaVersion:1,mode:'controlled-static-preview',enabled:catalog.enabled===true,sourceCommit:catalog.enabled===true?source.commit:null,noindex:true,history:catalog.enabled===true?history.history.map(({receipt,current})=>({receipt,current})):[]};
  if(history.history.length&&catalog.enabled!==true||canonical(catalog)!==canonical(expectedCatalog))throw Error('release_canonical_history_required');
  const original=inventory(join(root,'dist'));if(original['release.json'])throw Error('release_foreign_manifest');
  const buildId=digest(canonical({sourceCommit:source.commit,sourceTree:source.tree,assetsHash:digest(canonical(original)),target:releaseTarget}));
  mkdirSync(join(output,'assets'),{recursive:true});mkdirSync(join(output,'worker'));
  for(const path of Object.keys(original)){const to=join(output,'assets',path);mkdirSync(dirname(to),{recursive:true});copyFileSync(join(root,'dist',path),to);}
  const manifest={schemaVersion:1,sourceCommit:source.commit,sourceTree:source.tree,buildId,assetsHash:digest(canonical(original)),target:releaseTarget},manifestBytes=JSON.stringify(manifest)+'\n',manifestSha256=digest(manifestBytes);writeFileSync(join(output,'assets/release.json'),manifestBytes);
  const bundled=await build({absWorkingDir:root,entryPoints:['src/hosted/worker.ts'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',minify:false,define:{__AGENTIC_RELEASE_MANIFEST_SHA256__:JSON.stringify(manifestSha256),__AGENTIC_MAINTENANCE_CATALOG_SHA256__:JSON.stringify(original['maintenance-history.json']?.sha256??null)}});if(bundled.outputFiles.length!==1||bundled.outputFiles[0].contents.length>262144)throw Error('release_worker_capacity');writeFileSync(join(output,'worker/worker.js'),bundled.outputFiles[0].contents);
  const config=JSON.stringify(runtimeConfig(),null,2)+'\n';writeFileSync(join(output,'wrangler.json'),config);
  const candidate:Candidate={schemaVersion:1,repository:'Leshey-Digital/agentic-bible',sourceCommit:source.commit,sourceTree:source.tree,buildId,target:releaseTarget,assets:inventory(join(output,'assets')),workerSha256:digest(bundled.outputFiles[0].contents),configSha256:digest(config),manifestSha256};
  writeFileSync(join(output,'candidate.json'),canonical(candidate));writeFileSync(join(output,'candidate.sha256'),digest(canonical(candidate))+'\n');
  verifyCandidate(output);
  return candidate;
}
export function verifyCandidate(root:string,expected?:string){
  if(lstatSync(root).isSymbolicLink()||!lstatSync(root).isDirectory())throw Error('release_root_rejected');inventory(root);
  const raw=readFileSync(join(root,'candidate.json'),'utf8');if(Buffer.byteLength(raw)>65536)throw Error('release_candidate_capacity');const candidate=JSON.parse(raw) as Candidate,id=digest(raw);
  if(raw!==canonical(candidate)||readFileSync(join(root,'candidate.sha256'),'utf8').trim()!==id||(expected&&id!==expected)||candidate.schemaVersion!==1||candidate.repository!=='Leshey-Digital/agentic-bible'||!/^[a-f0-9]{40}$/.test(candidate.sourceCommit)||!/^[a-f0-9]{40}$/.test(candidate.sourceTree)||!/^[a-f0-9]{64}$/.test(candidate.buildId)||canonical(candidate.target)!==canonical(releaseTarget))throw Error('release_candidate_rejected');
  if(canonical(inventory(join(root,'assets')))!==canonical(candidate.assets)||digest(readFileSync(join(root,'worker/worker.js')))!==candidate.workerSha256||digest(readFileSync(join(root,'wrangler.json')))!==candidate.configSha256||canonical(JSON.parse(readFileSync(join(root,'wrangler.json'),'utf8')))!==canonical(runtimeConfig())||digest(readFileSync(join(root,'assets/release.json')))!==candidate.manifestSha256)throw Error('release_artifact_changed');
  for(const name of readdirSync(root))if(!['assets','worker','wrangler.json','candidate.json','candidate.sha256'].includes(name))throw Error('release_extra_file');if(readdirSync(join(root,'worker')).join(',')!=='worker.js')throw Error('release_extra_worker');
  const manifest=JSON.parse(readFileSync(join(root,'assets/release.json'),'utf8'));if(manifest.sourceCommit!==candidate.sourceCommit||manifest.sourceTree!==candidate.sourceTree||manifest.buildId!==candidate.buildId||canonical(manifest.target)!==canonical(releaseTarget))throw Error('release_manifest_changed');
  const source=JSON.parse(readFileSync(join(root,'assets/release-source.json'),'utf8'));if(source.commit!==candidate.sourceCommit||source.tree!==candidate.sourceTree||Object.keys(source.articleHashes).length!==20)throw Error('release_source_changed');
  return {candidate,id};
}
export async function dryRunCandidate(root:string){
  verifyCandidate(root);const require=createRequire(import.meta.url),cli=join(dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
  const scratch=mkdtempSync(join(resolve(root),'..','release-dry-run-'));try{const copy=join(scratch,'candidate');cpSync(root,copy,{recursive:true});execFileSync(process.execPath,[cli,'versions','upload','--dry-run','--config',join(copy,'wrangler.json'),'--no-bundle'],{timeout:30000,maxBuffer:262144,env:{PATH:process.env.PATH,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',XDG_CONFIG_HOME:join(scratch,'config'),XDG_CACHE_HOME:join(scratch,'cache')},stdio:['ignore','pipe','pipe']});}finally{rmSync(scratch,{recursive:true,force:true});}verifyCandidate(root);
}
