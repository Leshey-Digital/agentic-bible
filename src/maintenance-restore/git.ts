import {execFileSync} from 'node:child_process';import {realpathSync} from 'node:fs';
import {stop} from './contracts.ts';
export function ownedGit(repo:string){const root=realpathSync(repo);return (args:string[],max=262144)=>{try{return execFileSync('git',['--no-pager','--no-optional-locks','-c','core.hooksPath=/dev/null','-C',root,...args],{env:{...process.env,GIT_NO_LAZY_FETCH:'1',GIT_ALLOW_PROTOCOL:'',GIT_TERMINAL_PROMPT:'0'},timeout:2000,maxBuffer:max,stdio:['ignore','pipe','pipe']});}catch{return stop('restore_git_unavailable');}};}
