import {createHttpPass,HttpError,type WebFetch} from './http-core.ts';
import {officialUrl} from './http-registry.ts';

// Native Workers fetch has NO caller-controlled DNS pin or connected-peer inspection.
// Only fixed official HTTPS URLs. No deployment route/schedule imports this library.
export function createWorkersHttpPass(send:WebFetch=(url,options)=>fetch(url,{...options,method:'GET',credentials:'omit',cache:'no-store'}),clock:()=>number=Date.now) {
  return createHttpPass({clock,fetch:async(raw,options)=>{
    if(!officialUrl(raw)||options.signal.aborted)throw new HttpError('http_transport_rejected');
    const allowed=new Set(['accept','accept-encoding','user-agent','if-none-match','if-modified-since']);
    if([...options.headers.keys()].some(key=>!allowed.has(key)))throw new HttpError('http_transport_rejected');
    // Build new options: never forward caller bindings, cf overrides, cookies or credentials.
    const response=await send(raw,{headers:new Headers(options.headers),signal:options.signal,redirect:'manual'});
    const bytes=new TextEncoder().encode([...response.headers].map(([key,value])=>`${key}:${value}\r\n`).join('')).length;
    if(bytes>8192){void response.body?.cancel().catch(()=>{});throw new HttpError('headers_too_large');}
    return response;
  }});
}
