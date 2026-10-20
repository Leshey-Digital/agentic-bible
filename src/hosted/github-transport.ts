import {hostedTarget} from './targets.ts';
import {repository,type Ports} from './contracts.ts';
export function credentialTransport(token:unknown,send:(request:Request)=>Promise<Response>=fetch):Ports['sendGitHub']|undefined{
  if(typeof token!=='string'||token.length<16||token.length>512||/\s|[\u0000-\u001f\u007f]/.test(token))return undefined;
  return request=>{
    const url=new URL(request.url),prefix='/repos/'+repository;
    if(url.origin!=='https://api.github.com'||url.username||url.password||url.hash||!url.pathname.startsWith(prefix+'/')||request.redirect!=='manual'||(request.credentials!==undefined&&request.credentials!=='omit')||[...request.headers.keys()].some(name=>!['accept','content-type','user-agent','x-github-api-version'].includes(name)))throw Error('restricted GitHub transport');
    const path=url.pathname.slice(prefix.length),get=request.method==='GET'&&(/^\/git\/ref\/heads\/(main|content-corrections\/[a-f0-9-]{36})$/.test(path)||/^\/git\/(commits|trees)\/[a-f0-9]{40}$/.test(path)||(/^\/contents\/src\/content\/articles\/([a-z0-9-]+)\.md$/.test(path)&&!!hostedTarget(/^\/contents\/src\/content\/articles\/([a-z0-9-]+)\.md$/.exec(path)![1]))||path==='/pulls'),post=request.method==='POST'&&['/git/trees','/git/commits','/git/refs','/pulls'].includes(path);
    if(!get&&!post)throw Error('restricted GitHub transport');
    const headers=new Headers(request.headers);headers.set('Authorization','Bearer '+token);return send(new Request(request,{headers,redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer'}));
  };
}
