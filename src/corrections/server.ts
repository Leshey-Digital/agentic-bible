import {createServer,type IncomingMessage} from 'node:http';
import {readFileSync,existsSync,mkdirSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {CorrectionCoordinator} from './coordinator.ts';
import {CorrectionError,baseline,operation,reject,type ReviewInput,type Operation} from './approval.ts';
import {canonical} from '../publishing/contracts.ts';
import {projectFiles} from '../wiki-bridge/files.ts';
import {wikiServer} from '../wiki-bridge/preview.ts';
import {escape,layout} from '../editorial/views.ts';
import {localOrigin} from '../editorial/auth.ts';
import type {Session} from '../editorial/contracts.ts';
import type {BridgePhase} from '../wiki-bridge/store.ts';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'Referrer-Policy':'same-origin'};
const mime=(file:string)=>({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json'}[extname(file)]??'application/octet-stream');
export async function correctionPreview(name='local',checkpoint?:(phase:BridgePhase)=>void|Promise<void>){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))reject('unsafe_correction_store');
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),state=join(git,'corrections-'+name),marker=join(state,'owner.txt');
  if(existsSync(state)&&lstatSync(state).isSymbolicLink())reject('unsafe_correction_store');
  if(existsSync(marker)){if(lstatSync(marker).isSymbolicLink()||readFileSync(marker,'utf8')!=='local-reviewed-corrections\n')reject('unsafe_correction_store');}
  else{if(existsSync(state)&&readdirSync(state).length)reject('unsafe_correction_store');mkdirSync(state,{recursive:true});writeFileSync(marker,'local-reviewed-corrections\n');}
  const assets=async(request:Request)=>{
    const url=new URL(request.url);let path=decodeURIComponent(url.pathname);if(path.includes('\\')||path.split('/').includes('..')||!/^[a-zA-Z0-9_./-]+$/.test(path))return new Response('Not found',{status:404});
    let file=resolve('dist','.'+path);if(existsSync(file)&&lstatSync(file).isDirectory())file=join(file,'index.html');
    if(!file.startsWith(resolve('dist')+'/')||!existsSync(file)||!lstatSync(file).isFile())return new Response('Not found',{status:404});
    return new Response(readFileSync(file),{headers:{'Content-Type':mime(file)}});
  };
  const script=(await build({entryPoints:['src/editorial/worker.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})).outputFiles[0].text;
  const runtime=new Miniflare({...convertV4MiniflareOptions({name:'reviewed-corrections',modules:true,script,compatibilityDate:'2026-10-16',bindings:{LOCAL_EDITORIAL_MODE:'synthetic-only',LOCAL_CORRECTIONS_MODE:'reviewed-notes'},serviceBindings:{ASSETS:assets},d1Databases:{EDITORIAL_DB:'reviewed-corrections'},outboundService(){throw Error('live fetch forbidden');}}),cf:false,resourcePersistencePath:join(state,'d1')});
  const db=await runtime.getD1Database('EDITORIAL_DB');
  // Journal migration filenames; fresh and restarted stores use the same additive sequence.
  await db.prepare('CREATE TABLE IF NOT EXISTS correction_local_migrations(name TEXT PRIMARY KEY)').run();
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()){
    if(await db.prepare('SELECT name FROM correction_local_migrations WHERE name=?').bind(file).first())continue;
    await db.batch([...readFileSync(join('migrations',file),'utf8').replace(/--[^\n]*/g,'').split(/;(?=\s*(?:PRAGMA|CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|$))/).map(s=>s.trim()).filter(Boolean).map(sql=>db.prepare(sql)),db.prepare('INSERT INTO correction_local_migrations(name) VALUES(?)').bind(file)]);
  }
  const coordinator=new CorrectionCoordinator(db,'wiki-bridge-corrections-'+name),wiki=wikiServer(coordinator.bridge);await new Promise<void>(done=>wiki.listen(0,'127.0.0.1',done));const wikiAddress=wiki.address();const wikiOrigin='http://127.0.0.1:'+(typeof wikiAddress==='object'&&wikiAddress?wikiAddress.port:0);
  const dispatch=(path:string,request:Request)=>runtime.dispatchFetch(localOrigin+path,{redirect:'manual',headers:{cookie:request.headers.get('cookie')??''}});
  const readItem=async(id:string,request:Request)=>{const response=await dispatch('/api/admin/submissions/'+id,request);if(response.status!==200)return null;return await response.json() as {item:{id:string;version:number;kind:string;articleId:string;status:string;message:string;sourceUrl:string}};};
  const session=async(request:Request)=>{const response=await dispatch('/api/admin/session',request);return response.status===200?await response.json() as {identity:string;role:string;csrf:string}:null;};
  const page=(content:string,auth:{identity:string;csrf:string})=>new Response(layout('Review canonical correction',content,{...auth,role:'admin'} as Session),{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  async function reviewPage(id:string,request:Request,auth:{identity:string;csrf:string},notice='',draft?:{note:string;citationId:string}){
    const result=await readItem(id,request);if(!result||result.item.articleId!=='tool-use'||result.item.kind!=='correction')return new Response('Only tool-use correction notes are supported here.',{status:404,headers});
    const item=result.item,original=baseline(coordinator.bridge.repo);const ops=(await db.prepare('SELECT * FROM correction_operations WHERE submission_id=? ORDER BY created_at,id LIMIT 8').bind(id).all<Operation>()).results as Operation[];
    const pending=ops.find(o=>o.state==='approved');
    const common=`<a href="/admin/items/${id}/">Back to inbox review</a><h1>Review canonical correction</h1><p>Local synthetic workflow for tool-use. This adds a cited note to the original article; it does not enable public intake or production authentication.</p>${notice?`<p role="status">${escape(notice)}</p>`:''}<h2>Untrusted contribution</h2><p class="submitted-text">${escape(item.message)}</p><p>Contribution reference ${id} · revision ${item.version}. The supplied text and URL are unverified; URLs are never fetched here.</p>`;
    const retry=(op:Operation)=>`<form method="post"><input type="hidden" name="csrf" value="${escape(auth.csrf)}"><input type="hidden" name="requestKey" value="${op.id}"><input type="hidden" name="action" value="retry"><button>Retry approved correction ${op.id}</button></form>`;
    const history=ops.map(o=>`<section><h2>${o.kind==='apply'?'Correction approval':'Rollback approval'} ${o.id}</h2><p>${o.state==='complete'?'Completed; exact retry returns the historical receipt without reactivation.':'Approved; article/site/audit completion may still be pending. Retry this same approval.'}</p>${o.receipt_json?`<a href="/wiki-snapshots/${JSON.parse(o.receipt_json).site.id}/articles/tool-use/">Read this canonical snapshot</a> · <a href="/wiki-snapshots/${JSON.parse(o.receipt_json).site.id}/history/">Revision history</a>`:''}${retry(o)}</section>`).join('');
    const site=coordinator.bridge.current(),pub=coordinator.bridge.publisher.current();
    const fields=(kind:string)=>`<input type="hidden" name="csrf" value="${escape(auth.csrf)}"><input type="hidden" name="requestKey" value="${randomUUID()}"><input type="hidden" name="submissionId" value="${id}"><input type="hidden" name="version" value="${item.version}"><input type="hidden" name="expectedSite" value="${escape(canonical(site?.reference??null))}"><input type="hidden" name="expectedPublisher" value="${escape(canonical(pub?.reference??null))}"><input type="hidden" name="sourceTreeHash" value="${projectFiles(coordinator.bridge.repo).hash}"><input type="hidden" name="originalMarkdownHash" value="${original.hash}"><input type="hidden" name="kind" value="${kind}">`;
    const form=pending?'':!['new','follow-up'].includes(item.status)?'<p>Reopen this contribution in the inbox before approving another note.</p>':`<form method="post" class="review-form">${fields('apply')}<h2>Admin-reviewed note</h2><label for="reviewed-note">Approved correction note</label><textarea id="reviewed-note" name="note" minlength="20" maxlength="1000" required rows="5">${escape(draft?.note??'')}</textarea><label for="citation">Existing supporting citation</label><select id="citation" name="citationId">${original.sources.map(s=>`<option value="${s.id}"${s.id===draft?.citationId?' selected':''}>${escape(s.title)}</option>`).join('')}</select><p>Verify the claim against the cited original source before approval. Selection alone does not establish factual accuracy or rights.</p><label><input type="checkbox" name="confirm" value="reviewed" required> I reviewed the evidence and authorize publishing this note.</label><button>Approve and publish correction</button></form>`;
    const rollback=site?.manifest.state.articleRevision&&!pending?`<form method="post" class="review-form">${fields('rollback')}<h2>Restore original article</h2><p>Retains correction history and receipts; restores the full original article/search state in a new snapshot.</p><label><input type="checkbox" name="confirm" value="reviewed" required> I authorize restoring the original article.</label><button>Restore original article</button></form>`:'';
    return page(common+history+form+rollback,auth);
  }
  const handle=async(request:Request):Promise<Response>=>{
    const url=new URL(request.url);if(url.origin!==localOrigin)return new Response('local only',{status:403,headers});
    if(/^\/wiki-snapshots\/[a-f0-9]{64}\/contribute\/$/.test(url.pathname)&&request.method==='GET')return new Response(null,{status:302,headers:{...headers,Location:'/contribute/'+url.search}});
    const match=/^\/admin\/items\/([a-f0-9-]{36})\/publish\/$/.exec(url.pathname);
    if(match){
      const auth=await session(request);if(!auth)return new Response('Admin role required',{status:403,headers});
      if(request.method==='GET')return reviewPage(match[1],request,auth);
      if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers});
      if(request.headers.get('origin')!==localOrigin||request.headers.get('sec-fetch-site')==='cross-site')return new Response('Same-origin review required',{status:403,headers});
      if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')return new Response('Use the supplied form',{status:415,headers});
      const data=Object.fromEntries(new URLSearchParams(await request.text()));if(data.csrf!==auth.csrf)return new Response('Review CSRF rejected',{status:403,headers});
      if(data.submissionId&&data.submissionId!==match[1])return new Response('Review target mismatch',{status:409,headers});
      try{
        if(data.action==='retry'){
          const op=await operation(db,data.requestKey);if(!op||op.submission_id!==match[1])reject('approval_required');await coordinator.retry(data.requestKey,auth.identity,checkpoint);
        }else await coordinator.apply({...data,version:Number(data.version)} as ReviewInput,auth.identity,checkpoint);
        return new Response(null,{status:303,headers:{...headers,Location:url.pathname+'?completed=1'}});
      }catch(error){
        const code=error instanceof CorrectionError?error.code:typeof error==='object'&&error&&'code' in error?String(error.code):'outcome_unconfirmed';
        const result=await reviewPage(match[1],request,auth,'No new success was confirmed: '+code+'. Preserve this approval reference and retry the same operation.',data.kind==='apply'&&typeof data.note==='string'&&data.note.length<=1000?{note:data.note,citationId:data.citationId}:undefined);
        return new Response(await result.text(),{status:409,headers:result.headers});
      }
    }
    if((url.pathname==='/correction-status.json'||url.pathname==='/bridge-status.json')){
      if(!await session(request))return new Response('Admin role required',{status:403,headers});
      return new Response(JSON.stringify(coordinator.bridge.status()),{headers:{...headers,'Content-Type':'application/json'}});
    }
    if(['GET','HEAD'].includes(request.method)&&!url.pathname.startsWith('/admin')&&!url.pathname.startsWith('/api')&&url.pathname!=='/contribute/'&&url.pathname!=='/editorial.css'&&url.pathname!=='/favicon.svg'){
      if(coordinator.bridge.current()||url.pathname.startsWith('/wiki-snapshots/')){
        const response=await fetch(wikiOrigin+url.pathname+url.search,{redirect:'manual'});return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:Object.fromEntries(response.headers.entries())});
      }
    }
    const response=await runtime.dispatchFetch(request.url,{redirect:'manual',method:request.method,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer()});
    if(request.method==='GET'&&/^\/admin\/items\/[a-f0-9-]{36}\/$/.test(url.pathname)&&response.status===200){
      const id=url.pathname.split('/')[3],item=await readItem(id,request);if(item?.item.articleId==='tool-use'&&item.item.kind==='correction')return new Response((await response.text()).replace('</aside>',`<p><a class="text-link" href="${url.pathname}publish/">Review canonical correction</a></p></aside>`),{status:response.status,headers:Object.fromEntries(response.headers.entries())});
    }
    return new Response(await response.arrayBuffer(),{status:response.status,headers:Object.fromEntries(response.headers.entries())});
  };
  const server=createServer(async(req:IncomingMessage,res)=>{
    try{
      if(req.headers.host!=='127.0.0.1:8788'){res.writeHead(403,headers);res.end('local only');return;}
      let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413,headers);res.end('Review request too large');return;}chunks.push(Buffer.from(chunk));}
      const request=new Request(localOrigin+(req.url??'/'),{method:req.method,headers:req.headers as Record<string,string>,...(!['GET','HEAD'].includes(req.method??'GET')?{body:Buffer.concat(chunks)}:{})});
      const response=await handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{res.writeHead(503,headers);res.end('Local correction outcome unconfirmed. Preserve the approval and retry.');}
  });
  return {server,runtime,db,coordinator,handle,close:async()=>{if(server.listening)await new Promise<void>(done=>server.close(()=>done()));await new Promise<void>(done=>wiki.close(()=>done()));await runtime.dispose();}};
}
