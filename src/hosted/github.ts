import type {SqlDatabase} from '../editorial/contracts.ts';
import {approved,baseRef,canonical,contentPath,gitSha,hash,limits,reject,repository,type Ports,type ProposalReceipt,type VerifiedAdmin} from './contracts.ts';
import {projectNote} from './markdown.ts';
import {claim,reserve,complete,release} from './outbox.ts';
const base='/repos/'+repository;
function sha(value:unknown){if(!gitSha(value))reject('github_invalid_object');return value;}
function commit(value:any,expected:string,tree?:string,parent?:string){if(value?.sha!==expected||!gitSha(value?.tree?.sha))reject('github_invalid_commit');if(tree&&(value.tree.sha!==tree||value.parents?.length!==1||value.parents[0].sha!==parent))reject('github_foreign_branch');return value;}
export async function proposeGitHubCorrection(id:string,principal:VerifiedAdmin,db:SqlDatabase,ports:Ports):Promise<ProposalReceipt>{
  if(!ports.approvedNote||!ports.sendGitHub)reject('github_proposal_unconfigured');
  const note=approved(await ports.approvedNote(id,principal),id,Date.now()),fingerprint=await hash(canonical(note)),owned=await claim(db,id,fingerprint,Date.now(),note.schemaVersion===2?limits.submissionRows:limits.rows);
  const targetPath=note.schemaVersion===2?note.contentPath:contentPath;
  const branch='content-corrections/'+id,title='Reviewed '+(note.schemaVersion===2?note.articleId:'tool-use')+' correction '+id,message=title+'\n\nApproval fingerprint: '+fingerprint;
  const marker='<!-- agentic-bible-approved:'+id+':'+fingerprint+' -->';
  const receipt=(pr:any,head:string,markdownSha256:string):ProposalReceipt=>{
    if(!Number.isSafeInteger(pr?.number)||pr.number<1||pr.html_url!==`https://github.com/${repository}/pull/${pr.number}`||pr.head?.ref!==branch||pr.head?.sha!==head||pr.base?.ref!==baseRef||pr.base?.sha!==note.baseCommit||pr.state!=='open'||pr.draft!==true||pr.title!==title||typeof pr.body!=='string'||!pr.body.includes(marker))reject('github_proposal_conflict');
    const common={state:'draft-proposed' as const,published:false as const,approvalId:id,baseCommit:note.baseCommit,headCommit:head,branch,pullRequest:pr.number,url:pr.html_url,markdownSha256};return note.schemaVersion===2?{...common,schemaVersion:2,articleId:note.articleId,contentPath:note.contentPath}:{...common,schemaVersion:1};
  };
  if(owned.receipt){const saved=owned.receipt;if(saved.schemaVersion!==note.schemaVersion||(note.schemaVersion===2&&(saved.schemaVersion!==2||saved.articleId!==note.articleId||saved.contentPath!==note.contentPath))||saved.state!=='draft-proposed'||saved.published!==false||saved.approvalId!==id||saved.baseCommit!==note.baseCommit||saved.branch!==branch||!gitSha(saved.headCommit)||!Number.isSafeInteger(saved.pullRequest)||saved.url!==`https://github.com/${repository}/pull/${saved.pullRequest}`||!/^[a-f0-9]{64}$/.test(saved.markdownSha256))reject('github_receipt_corrupt');return saved;}
  const recheckApproval=async()=>{const current=approved(await ports.approvedNote!(id,principal),id,Date.now());if(await hash(canonical(current))!==fingerprint)reject('github_approval_conflict');};
  let calls=0;const started=Date.now();
  async function request(path:string,body?:unknown,notFound=false):Promise<any>{
    if(++calls>limits.invocationRequests||Date.now()-started>=limits.invocationMs)reject('github_invocation_budget');await reserve(db,id,owned.token,Date.now());
    // A durable reservation response can be delayed across revocation, inbox
    // revision changes or assertion expiry. Re-read authority after that await.
    if(body!==undefined)await recheckApproval();
    if(principal.expiresAt<=Date.now())reject('verified_admin_required');
    if(Date.now()-started>=limits.invocationMs)reject('github_invocation_budget');
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([(async()=>{
      const response=await ports.sendGitHub!(new Request('https://api.github.com'+base+path,{method:body===undefined?'GET':'POST',headers:{Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Agentic-Bible-Content-Proposals','X-GitHub-Api-Version':'2026-03-10'},body:body===undefined?undefined:canonical(body),redirect:'manual',credentials:'omit',signal:controller.signal}),body===undefined?undefined:recheckApproval);
      if(notFound&&response.status===404){void response.body?.cancel();return null;}
      if(response.redirected||![200,201].includes(response.status)||!response.headers.get('content-type')?.includes('application/json')){void response.body?.cancel();reject('github_response_rejected');}
      if(Number(response.headers.get('content-length'))>limits.responseBytes){void response.body?.cancel();reject('github_response_capacity');}
      const reader=response.body?.getReader();if(!reader)reject('github_response_rejected');let bytes=0;const chunks:Uint8Array[]=[];
      try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>limits.responseBytes){void reader.cancel();reject('github_response_capacity');}chunks.push(part.value);}}finally{reader.releaseLock();}
      const joined=new Uint8Array(bytes);let offset=0;for(const part of chunks){joined.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined));
    })(),new Promise<never>((_done,failed)=>{timer=setTimeout(()=>{controller.abort();failed(new Error('bounded GitHub request outcome unconfirmed'));},Math.min(limits.requestMs,limits.invocationMs-(Date.now()-started)));})]);}
    finally{clearTimeout(timer);}
  }
  try{
    const current=await request('/git/ref/heads/'+baseRef);if(current?.object?.sha!==note.baseCommit)reject('stale_github_base');
    const sourceCommit=commit(await request('/git/commits/'+note.baseCommit),note.baseCommit);
    const baseTree=await request('/git/trees/'+sourceCommit.tree.sha+'?recursive=1');if(baseTree?.sha!==sourceCommit.tree.sha||baseTree.truncated!==false||!Array.isArray(baseTree.tree)||baseTree.tree.length>1024)reject('github_source_tree_rejected');const sourceEntries=baseTree.tree.filter((entry:any)=>entry.path===targetPath);if(sourceEntries.length!==1||sourceEntries[0].type!=='blob'||sourceEntries[0].mode!=='100644'||!gitSha(sourceEntries[0].sha))reject('github_source_tree_rejected');
    const file=await request('/contents/'+targetPath+'?ref='+note.baseCommit);if(file?.sha!==sourceEntries[0].sha||file?.type!=='file'||file.path!==targetPath||file.encoding!=='base64'||!Number.isSafeInteger(file.size)||file.size<1||file.size>limits.markdownBytes||'target' in file||typeof file.content!=='string'||file.content.length>limits.markdownBytes*2)reject('github_source_rejected');
    let bytes:Uint8Array;try{const binary=atob(file.content.replace(/\n/g,''));bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));}catch{return reject('github_source_rejected');}if(bytes.length!==file.size)reject('github_source_rejected');
    const markdown=await projectNote(new TextDecoder('utf-8',{fatal:true}).decode(bytes),note),markdownSha256=await hash(markdown);
    const existing=await request('/git/ref/heads/'+branch,undefined,true);
    // One explicit entry on the pinned base tree preserves every unrelated Git file.
    const tree=sha((await request('/git/trees',{base_tree:sourceCommit.tree.sha,tree:[{path:targetPath,mode:'100644',type:'blob',content:markdown}]}))?.sha);
    let head:string;
    if(existing){head=sha(existing.object?.sha);const found=commit(await request('/git/commits/'+head),head,tree,note.baseCommit);if(found.message?.trimEnd()!==message)reject('github_foreign_branch');}
    else{
      const created=await request('/git/commits',{message,tree,parents:[note.baseCommit]});head=sha(created?.sha);commit(created,head,tree,note.baseCommit);if(created.message?.trimEnd()!==message)reject('github_commit_unconfirmed');
      await recheckApproval();
      const ref=await request('/git/refs',{ref:'refs/heads/'+branch,sha:head});if(ref?.ref!=='refs/heads/'+branch||ref.object?.sha!==head)reject('github_ref_unconfirmed');
    }
    if((await request('/git/ref/heads/'+baseRef))?.object?.sha!==note.baseCommit)reject('stale_github_base');
    const list=await request('/pulls?state=all&head=Leshey-Digital%3A'+encodeURIComponent(branch)+'&base='+baseRef+'&per_page=2');if(!Array.isArray(list)||list.length>1)reject('github_proposal_conflict');
    await recheckApproval();
    const pr=list[0]??await request('/pulls',{title,head:branch,base:baseRef,draft:true,body:marker+'\n\nApproved correction proposal only. Not merged, built, deployed or indexed.\n\nPinned base: '+note.baseCommit+'\nApproval: '+id+'\nContribution: '+note.submissionId+' / revision '+note.submissionRevision+'\nReviewer reference: '+note.reviewerRef+'\n\nOnly '+targetPath+' changes. Existing technical/source checks and release gates still apply.'});
    const result=receipt(pr,head,markdownSha256);
    if((await request('/git/ref/heads/'+baseRef))?.object?.sha!==note.baseCommit)reject('stale_github_base_after_proposal');
    await recheckApproval();
    await complete(db,id,owned.token,result,Date.now());return result;
  }finally{await release(db,id,owned.token);}
}
