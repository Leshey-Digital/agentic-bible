export function makeServer(files,headerRules) {
 const rules=headerRules.map(([pattern,headers])=>[new RegExp('^'+pattern.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$'),headers]);
 const headersFor=path=>{const h=new Headers();for(const [match,headers]of rules)if(match.test(path))for(const [key,value]of Object.entries(headers))h.set(key,value);return h;};
 return {fetch(request){
  const url=new URL(request.url);let path;try{if(/%(?:2f|5c|00)/i.test(url.pathname))throw Error();path=decodeURIComponent(url.pathname);if(/[\x00-\x1f\x7f\\]/.test(path))throw Error();}catch{return new Response('Bad Request',{status:400,headers:headersFor(url.pathname)});}
  let h=headersFor(path);if(request.method!=='GET'&&request.method!=='HEAD'){h.set('Allow','GET, HEAD');h.set('Cache-Control','no-store');return new Response(null,{status:405,headers:h});}
  const redirect=destination=>{const u=new URL(request.url);u.pathname=destination;h.set('Location',u.pathname+u.search);h.set('Cache-Control','public, max-age=0, must-revalidate');return new Response(null,{status:301,headers:h});};
  const normalized=path.replace(/\/{2,}/g,'/');if(normalized!==path)return redirect(normalized);
  if(path.endsWith('/index.html'))return redirect(path.slice(0,-10));
  if(path.endsWith('.html')&&path!=='/404.html'&&Object.hasOwn(files,path))return redirect(path.slice(0,-5)+'/');
  let key=path.endsWith('/')?path+'index.html':path;
  if(!Object.hasOwn(files,key)&&!path.endsWith('/')&&Object.hasOwn(files,path+'/index.html'))return redirect(path+'/');
  if(!Object.hasOwn(files,key)&&path.endsWith('/')&&Object.hasOwn(files,path.slice(0,-1)+'.html'))key=path.slice(0,-1)+'.html';
  let status=200;if(!Object.hasOwn(files,key)){key='/404.html';status=404;h.set('X-Robots-Tag','noindex, nofollow');}
  const f=files[key];if(!f)return new Response(null,{status:404,headers:h});
  h.set('Content-Type',f.type);h.set('Cache-Control','public, max-age=0, must-revalidate');h.set('ETag',f.etag);h.set('Accept-Ranges','bytes');h.set('Content-Length',String(f.bytes.byteLength));
  const none=request.headers.get('If-None-Match');if(status===200&&none?.split(',').some(x=>x.trim()==='*'||x.trim().replace(/^W\//,'')===f.etag)){h.delete('Content-Length');return new Response(null,{status:304,headers:h});}
  let body=f.bytes;const range=request.headers.get('Range'),ifRange=request.headers.get('If-Range');if(status===200&&range&&(!ifRange||ifRange===f.etag)){
   const m=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=body.byteLength-1;
   if(m&&(m[1]||m[2])){if(!m[1])start=Math.max(0,body.byteLength-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}}
   if(!m||(!m[1]&&!m[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=body.byteLength||(!m[1]&&Number(m[2])===0)){h.set('Content-Range','bytes */'+body.byteLength);h.set('Content-Length','0');return new Response(null,{status:416,headers:h});}
   h.set('Content-Range',`bytes ${start}-${end}/${body.byteLength}`);body=body.slice(start,end+1);h.set('Content-Length',String(body.byteLength));status=206;
  }
  return new Response(request.method==='HEAD'?null:body,{status,headers:h});
 }};
}
