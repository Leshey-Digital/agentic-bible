import {repository,type Ports,type RuntimeEnv} from './contracts.ts';
import {adminTrust,verifySignedAdmin} from './identity.ts';
import {historyBindingConfigured} from '../maintenance-history/review.ts';
import {lookupApproval} from './approvals.ts';
export function credentialTransport(token:unknown,send:typeof fetch=fetch):Ports['sendGitHub']|undefined{
  if(typeof token!=='string'||token.length<16||token.length>512||/\s|[\u0000-\u001f\u007f]/.test(token))return undefined;
  return request=>{
    const url=new URL(request.url),prefix='/repos/'+repository;
    if(url.origin!=='https://api.github.com'||url.username||url.password||url.hash||!url.pathname.startsWith(prefix+'/')||request.redirect!=='manual'||(request.credentials!==undefined&&request.credentials!=='omit')||[...request.headers.keys()].some(name=>!['accept','content-type','user-agent','x-github-api-version'].includes(name)))throw Error('restricted GitHub transport');
    const path=url.pathname.slice(prefix.length),get=request.method==='GET'&&(/^\/git\/ref\/heads\/(main|content-corrections\/[a-f0-9-]{36})$/.test(path)||/^\/git\/(commits|trees)\/[a-f0-9]{40}$/.test(path)||path==='/contents/src/content/articles/tool-use.md'||path==='/pulls'),post=request.method==='POST'&&['/git/trees','/git/commits','/git/refs','/pulls'].includes(path);
    if(!get&&!post)throw Error('restricted GitHub transport');
    const headers=new Headers(request.headers);headers.set('Authorization','Bearer '+token);return send(new Request(request,{headers,redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer'}));
  };
}
export function configuredPorts(env:RuntimeEnv):Ports{
  const trust=adminTrust(env.HOSTED_ADMIN_TRUST),send=credentialTransport(env.GITHUB_CONTENT_TOKEN);if(!trust||!env.EDITORIAL_DB)return {};
  const review=historyBindingConfigured()?{maintenanceReview:true as const}:{};
  if(!send)return review.maintenanceReview?{verifyAdmin:request=>verifySignedAdmin(request,trust),...review}:{};
  return {...review,verifyAdmin:request=>verifySignedAdmin(request,trust),approvedNote:(id,admin)=>lookupApproval(env.EDITORIAL_DB!,id,admin),sendGitHub:send,hostedApprovals:true};
}
