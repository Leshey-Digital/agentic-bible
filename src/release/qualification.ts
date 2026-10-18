import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,writeSync,mkdirSync,lstatSync,readdirSync,openSync,closeSync,fsyncSync,fstatSync,constants} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {canonical,digest,verifyCandidate,inventory} from './artifact.ts';

// Deliberately mirrors every retained validation/native/browser command, without Actions.
export const qualificationSteps=['validate','staging:check','runtime:check','test:browser','test:editorial:browser','test:integration:browser','test:monitoring:worker','test:settings:worker','test:publication:browser','test:combined:browser','test:wiki-bridge:browser','test:wiki-seo:browser','test:corrections:browser','test:hosted:browser','test:hosted-admin:browser','test:maintenance:browser','test:maintenance-collection:browser','test:maintenance-history:browser','test:maintenance-restore:browser','release:prepare'] as const;
const repository='Leshey-Digital/agentic-bible',hex=(v:unknown,n:number)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v);
const git=(root:string,...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:10000,maxBuffer:65536}).trim();
export function cleanSource(root:string){
 if(git(root,'status','--porcelain=v1','--untracked-files=all'))throw Error('release_clean_source_required');
 return {commit:git(root,'rev-parse','HEAD'),tree:git(root,'rev-parse','HEAD^{tree}')};
}
export function durableJson(path:string,value:unknown){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,canonical(value));fsyncSync(fd);}finally{closeSync(fd);}}
export function lockReleaseWriter(root:string){
 const directory=git(root,'rev-parse','--absolute-git-dir'),path=join(directory,'release-exclusive-writer.lock');
 const fd=openSync(path,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.uid!==process.getuid?.())throw Error('release_unsafe_writer_lock');
 // Linux flock attaches to the shared open file description. This process retains
 // the descriptor; close/SIGKILL releases it, with no stale PID-file deletion race.
 execFileSync('flock',['--exclusive','--nonblock','3'],{stdio:['ignore','pipe','pipe',fd],timeout:5000,maxBuffer:4096});
 }catch{closeSync(fd);throw Error('release_exclusive_writer_unavailable');}
 return ()=>closeSync(fd);
}
type Check={step:string;exit:0;log:string;sha256:string;bytes:number;durationMs:number};
export type Qualification={schemaVersion:1;mode:'saved-coding-environment';state:'qualified';repository:string;sourceCommit:string;sourceTree:string;candidateDigest:string;node:string;npm:string;chromium:string;startedAt:number;completedAt:number;checks:Check[]};
export function verifyQualification(root:string,expected:string,expectedCandidate?:string){
 if(!hex(expected,64)||lstatSync(root).isSymbolicLink()||!lstatSync(root).isDirectory())throw Error('release_qualification_required');
 inventory(root);const raw=readFileSync(join(root,'qualification.json'),'utf8');if(Buffer.byteLength(raw)>65536)throw Error('release_qualification_capacity');
 const id=digest(raw);if(id!==expected)throw Error('release_qualification_invalid');let q:Qualification;try{q=JSON.parse(raw);}catch{throw Error('release_qualification_invalid');}
 if(raw!==canonical(q)||id!==expected||readFileSync(join(root,'qualification.sha256'),'utf8')!==id+'\n'||q.schemaVersion!==1||q.mode!=='saved-coding-environment'||q.state!=='qualified'||q.repository!==repository||!hex(q.sourceCommit,40)||!hex(q.sourceTree,40)||!hex(q.candidateDigest,64)||q.node!=='24.19.0'||q.npm!=='11.9.0'||!/^\d+\.\d+\.\d+\.\d+$/.test(q.chromium)||!Number.isSafeInteger(q.startedAt)||!Number.isSafeInteger(q.completedAt)||q.completedAt<q.startedAt||q.checks?.length!==qualificationSteps.length)throw Error('release_qualification_invalid');
 const {candidate}=verifyCandidate(join(root,'candidate'),expectedCandidate??q.candidateDigest);
 if(q.candidateDigest!==digest(readFileSync(join(root,'candidate/candidate.json')))||candidate.sourceCommit!==q.sourceCommit||candidate.sourceTree!==q.sourceTree)throw Error('release_qualification_candidate_mismatch');
 for(let i=0;i<qualificationSteps.length;i++){const c=q.checks[i],path='logs/'+String(i).padStart(2,'0')+'.log';if(c.step!==qualificationSteps[i]||c.exit!==0||c.log!==path||!Number.isSafeInteger(c.durationMs)||c.durationMs<0||c.bytes>1048576)throw Error('release_qualification_checks');const log=readFileSync(join(root,path));if(log.length!==c.bytes||digest(log)!==c.sha256)throw Error('release_qualification_log_changed');}
 if(readdirSync(join(root,'logs')).sort().join(',')!==q.checks.map(c=>c.log.slice(5)).sort().join(',')||readdirSync(root).sort().join(',')!==['candidate','logs','qualification.json','qualification.sha256'].join(','))throw Error('release_qualification_extra_file');
 return {qualification:q,id,candidate,candidateRoot:join(root,'candidate')};
}
export async function runQualification(root:string,output:string,chromium:{path:string;version:string}){
 root=resolve(root);output=resolve(output);if(process.env.GITHUB_ACTIONS==='true')throw Error('release_saved_environment_required');
 const source=cleanSource(root);if(process.versions.node!=='24.19.0'||execFileSync('node',['-p','process.versions.node'],{encoding:'utf8'}).trim()!=='24.19.0'||execFileSync('npm',['--version'],{encoding:'utf8'}).trim()!=='11.9.0')throw Error('release_toolchain_required');
 const gitdir=git(root,'rev-parse','--absolute-git-dir');if(!output.startsWith(gitdir+'/'))throw Error('release_qualification_owned_output_required');
 let parent=dirname(output);while(parent!==gitdir){const stat=lstatSync(parent);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('release_qualification_owned_output_required');parent=dirname(parent);}
 const unlock=lockReleaseWriter(root);try{
 mkdirSync(output,{mode:0o700});mkdirSync(join(output,'logs'),{mode:0o700});const startedAt=Date.now(),checks:Check[]=[];
 const env={PATH:process.env.PATH,HOME:process.env.HOME,CI:'1',CHROMIUM_PATH:chromium.path,PLAYWRIGHT_BROWSERS_PATH:join(gitdir,'playwright'),ASTRO_TELEMETRY_DISABLED:'1',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'};
 for(let i=0;i<qualificationSteps.length;i++){
  if(canonical(cleanSource(root))!==canonical(source))throw Error('release_qualification_source_changed');
  const step=qualificationSteps[i],args=['run',step,...(step==='release:prepare'?['--',join(output,'candidate')]:[])],log='logs/'+String(i).padStart(2,'0')+'.log',chunks:Buffer[]=[];let size=0,overflow=false;const began=performance.now();
  console.log('START '+step);
  const remaining=2700000-(Date.now()-startedAt);if(remaining<=0)throw Error('release_qualification_deadline');
  const logFd=openSync(join(output,log),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);let exit:number|null;
  try{exit=await new Promise<number|null>((done,reject)=>{const child=spawn('npm',args,{cwd:root,env,detached:true,stdio:['ignore','pipe','pipe']});const kill=()=>{if(child.pid)try{process.kill(-child.pid,'SIGKILL');}catch{/* already exited */}};const abort=()=>{overflow=true;kill();};process.once('SIGTERM',abort);process.once('SIGINT',abort);const timer=setTimeout(abort,Math.min(remaining,step==='validate'?1500000:300000));const cleanup=()=>{clearTimeout(timer);process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort);};const collect=(part:Buffer)=>{size+=part.length;if(size>1048576){overflow=true;kill();}else try{writeSync(logFd,part);chunks.push(part);}catch{overflow=true;kill();}};child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',error=>{cleanup();reject(error);});child.once('close',code=>{cleanup();done(code);});});fsyncSync(logFd);}finally{closeSync(logFd);}
  const bytes=Buffer.concat(chunks);
  if(exit!==0||overflow)throw Error('release_qualification_command_failed:'+step);
  if(canonical(cleanSource(root))!==canonical(source))throw Error('release_qualification_source_changed');
  checks.push({step,exit:0,log,sha256:digest(bytes),bytes:bytes.length,durationMs:Math.round(performance.now()-began)});console.log('PASS '+step);
 }
 const {id:candidateDigest}=verifyCandidate(join(output,'candidate'));
 const qualification:Qualification={schemaVersion:1,mode:'saved-coding-environment',state:'qualified',repository,sourceCommit:source.commit,sourceTree:source.tree,candidateDigest,node:process.versions.node,npm:'11.9.0',chromium:chromium.version,startedAt,completedAt:Date.now(),checks};
 for(const path of Object.keys(inventory(output))){const fd=openSync(join(output,path),constants.O_RDONLY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}}
 durableJson(join(output,'qualification.json'),qualification);const id=digest(canonical(qualification));writeFileSync(join(output,'qualification.sha256'),id+'\n',{flag:'wx',mode:0o600});verifyQualification(output,id);return {output,qualificationDigest:id,candidateDigest,sourceCommit:source.commit};
 }finally{unlock();}
}
