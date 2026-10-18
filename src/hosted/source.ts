import {hostedTarget,sourceCitations} from './targets.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {contentPath,gitSha,hash,limits,reject,repository,type Ports} from './contracts.ts';
export async function sourcePreview(db:SqlDatabase,send:NonNullable<Ports['sendGitHub']>,articleId?:unknown){
  const target=articleId===undefined?null:hostedTarget(articleId);if(articleId!==undefined&&!target)reject('invalid_hosted_article');const path=target?.contentPath??contentPath;
  const day=Math.floor(Date.now()/86400000),reserved=await db.prepare('INSERT INTO hosted_source_budget(id,day,requests) VALUES(1,?,4) ON CONFLICT(id) DO UPDATE SET day=excluded.day,requests=CASE WHEN day=excluded.day THEN requests+4 ELSE 4 END WHERE day<excluded.day OR (day=excluded.day AND requests<=8)').bind(day).run();if(reserved.meta.changes!==1)reject('hosted_source_daily_budget');
  async function get(path:string){
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([(async()=>{
      const response=await send(new Request('https://api.github.com/repos/'+repository+path,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'Agentic-Bible-Content-Proposals'},redirect:'manual',credentials:'omit',signal:controller.signal}));
      if(response.status!==200||response.redirected||!response.headers.get('content-type')?.includes('application/json')||Number(response.headers.get('content-length'))>limits.responseBytes){void response.body?.cancel();reject('github_source_response_rejected');}
      const reader=response.body?.getReader();if(!reader)reject('github_source_response_rejected');let size=0;const chunks:Uint8Array[]=[];
      try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limits.responseBytes){void reader.cancel();reject('github_source_response_rejected');}chunks.push(next.value);}}finally{reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    })(),new Promise<never>((_done,failed)=>{timer=setTimeout(()=>{controller.abort();failed(Error('bounded source request'));},limits.requestMs);})]);}finally{clearTimeout(timer);}
  }
  const ref=await get('/git/ref/heads/main'),baseCommit=ref?.object?.sha;if(!gitSha(baseCommit))reject('github_source_rejected');
  const commit=await get('/git/commits/'+baseCommit);if(commit?.sha!==baseCommit||!gitSha(commit?.tree?.sha))reject('github_source_rejected');
  const tree=await get('/git/trees/'+commit.tree.sha+'?recursive=1');if(tree?.sha!==commit.tree.sha||tree.truncated!==false||!Array.isArray(tree.tree)||tree.tree.length>1024)reject('github_source_tree_rejected');const entries=tree.tree.filter((x:any)=>x.path===path);if(entries.length!==1||entries[0].type!=='blob'||entries[0].mode!=='100644'||!gitSha(entries[0].sha))reject('github_source_tree_rejected');
  const file=await get('/contents/'+path+'?ref='+baseCommit);if(file?.type!=='file'||file.sha!==entries[0].sha||file.path!==path||file.encoding!=='base64'||typeof file.content!=='string'||file.content.length>limits.markdownBytes*2||!Number.isSafeInteger(file.size)||file.size<1||file.size>limits.markdownBytes||'target'in file)reject('github_source_rejected');
  const bytes=Uint8Array.from(atob(file.content.replaceAll('\n','')),c=>c.charCodeAt(0));if(bytes.length!==file.size)reject('github_source_rejected');const markdown=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  let citations:string[]=[];if(target){try{citations=sourceCitations(markdown);}catch{return reject('unsupported_github_baseline');}}
  return {baseCommit,baseMarkdownSha256:await hash(markdown),markdown,...(target?{articleId:target.articleId,contentPath:target.contentPath,citations}:{})};
}
