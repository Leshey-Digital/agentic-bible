import {createServer,type IncomingMessage} from 'node:http';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {PublicationStore} from './store.ts';
import {PublicationError} from './contracts.ts';

const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const mime=(path:string)=>path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':path.endsWith('.json')?'application/json':path.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
export function publicationServer(store:PublicationStore,port=8790){
  const server=createServer((request:IncomingMessage,response)=>{
    const send=(status:number,data:string|Uint8Array,type='text/plain; charset=utf-8',extra={})=>{response.writeHead(status,{...headers,'Content-Type':type,...extra});response.end(request.method==='HEAD'?undefined:data);};
    const address=server.address();const actualPort=typeof address==='object'&&address?address.port:port;
    if(request.headers.host!==`127.0.0.1:${actualPort}`){send(403,'loopback_preview_required');return;}
    if(!['GET','HEAD'].includes(request.method??'')){send(405,'read_only_preview');return;}
    try{
      const url=new URL(request.url??'/','http://127.0.0.1:'+port);const path=decodeURIComponent(url.pathname);
      const pagefindCacheBust=/\/pagefind\/pagefind-entry\.json$/.test(path)&&url.searchParams.size===1&&/^\d{1,20}$/.test(url.searchParams.get('ts')??'');
      if((url.search&&!pagefindCacheBust)||path.includes('\\')||path.includes('\0')||path.split('/').some(x=>x==='..')||!/^\/[a-zA-Z0-9_./-]*$/.test(path)){send(404,'route_not_found');return;}
      if(path==='/'||path==='/local-publications') {send(302,'','text/plain',{Location:'/local-publications/'});return;}
      const current=store.current();
      if(path==='/search/'&&current){send(302,'','text/plain',{Location:`/local-publications/releases/${current.reference.id}/search/`});return;}
      if(path==='/local-publications/'){
        if(!current){send(503,'no_active_local_publication');return;}
        send(302,'','text/plain',{Location:`/local-publications/releases/${current.reference.id}/`});return;
      }
      const match=/^\/local-publications\/releases\/([a-f0-9]{64})\/(.*)$/.exec(path);
      if(match){
        const reference=current?.reference.id===match[1]?current.reference:current?.manifest.state.ancestors.find(r=>r.id===match[1]);
        if(!reference){send(404,'snapshot_not_committed');return;}
        const manifest=reference.id===current!.reference.id?current!.manifest:store.load(reference);
        const file=match[2]===''?'index.html':match[2].endsWith('/')?match[2]+'index.html':match[2];
        if(file!=='manifest.json'&&!Object.hasOwn(manifest.files,file)){send(404,'route_not_found');return;}
        send(200,readFileSync(join(store.root,'releases',reference.id,file)),mime(file));return;
      }
      // Existing three reference drafts/assets are read-only crosslink destinations, never publication outputs.
      if(/^\/articles\/(?:ai-agent|tool-use|model-context-protocol)\/$/.test(path)||/^\/topics\/(?:foundations\/|capabilities\/|protocols\/)?$/.test(path)||path==='/about/'||/^\/_astro\/[a-zA-Z0-9_.-]+\.(?:js|css)$/.test(path)||path==='/favicon.svg'){
        const file=resolve('dist','.'+path+(path.endsWith('/')?'index.html':''));send(200,readFileSync(file),mime(file));return;
      }
      send(404,'route_not_found');
    }catch(error){send(error instanceof PublicationError?503:404,error instanceof PublicationError?error.code:'route_not_found');}
  });return server;
}
