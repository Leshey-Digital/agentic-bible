import {createServer} from 'node:http';
import {join} from 'node:path';
import {bounded} from './files.ts';
import {WikiBridge} from './store.ts';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const mime=(path:string)=>path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
export function wikiServer(bridge:WikiBridge){
  const server=createServer((request,response)=>{
    const address=server.address();const port=typeof address==='object'&&address?address.port:0;
    const send=(code:number,data:string|Buffer,content='text/plain',extra={})=>{response.writeHead(code,{...headers,'Content-Type':content,...extra});response.end(request.method==='HEAD'?undefined:data);};
    if(request.headers.host!==`127.0.0.1:${port}`){send(403,'local_wiki_only');return;}if(!['GET','HEAD'].includes(request.method??'')){send(405,'read_only_wiki');return;}
    try{
      const url=new URL(request.url??'/','http://127.0.0.1');const path=decodeURIComponent(url.pathname);
      if(path==='/bridge-status.json'){send(200,JSON.stringify(bridge.status()),'application/json');return;}
      if(path.includes('\\')||!/^\/[a-zA-Z0-9_./-]*$/.test(path)||path.split('/').some(p=>p==='..')){send(404,'wiki_route_not_found');return;}
      const current=bridge.current();const match=/^\/wiki-snapshots\/([a-f0-9]{64})\/(.*)$/.exec(path);
      if(!match){if(!current){send(503,bridge.status().pending[0]?.phase??'no_active_wiki');return;}send(302,'','text/plain',{Location:`/wiki-snapshots/${current.reference.id}${path}${url.search}`});return;}
      const reference=current?.reference.id===match[1]?current.reference:current?.manifest.state.ancestors.find(ref=>ref.id===match[1]);if(!reference){send(404,'site_not_activated');return;}
      const manifest=bridge.load(reference);const file=match[2]===''?'index.html':match[2].endsWith('/')?match[2]+'index.html':match[2];
      if(file!=='manifest.json'&&!Object.hasOwn(manifest.files,file)){send(404,'wiki_route_not_found');return;}
      send(200,bounded(join(bridge.root,'sites',reference.id,file),16*1024*1024),mime(file));
    }catch{send(503,'wiki_integrity_failure');}
  });return server;
}
