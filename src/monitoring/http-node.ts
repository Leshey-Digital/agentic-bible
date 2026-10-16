import {lookup} from 'node:dns/promises';
import {Agent,request,type RequestOptions} from 'node:https';
import type {ClientRequest,IncomingMessage} from 'node:http';
import {BlockList,isIP} from 'node:net';
import {officialUrl,publicAddress,type PublicAddress} from './http-policy.ts';

export type HttpFetchOptions={headers:Headers;signal:AbortSignal;redirect:'manual';address:PublicAddress};
export type ControlledFetch=(url:string,options:HttpFetchOptions)=>Promise<Response>;
type Requester=(url:URL,options:RequestOptions,listener:(response:IncomingMessage)=>void)=>ClientRequest;
export const resolveAddresses=async(hostname:string):Promise<PublicAddress[]>=>lookup(hostname,{all:true,verbatim:true}) as Promise<PublicAddress[]>;

// Separate Node transport: no proxy, pooling, second DNS lookup or automatic redirect.
// No Worker imports this module. A future Worker egress adapter needs an equivalent reviewed boundary.
export function createNodeFetch(send:Requester=request):ControlledFetch {
  return (raw,options)=>new Promise((resolve,reject)=>{
    const url=officialUrl(raw);
    if(!url||!publicAddress(options.address)||options.redirect!=='manual'||options.signal.aborted){reject(new Error('http_transport_rejected'));return;}
    const allowedHeaders=new Set(['accept','accept-encoding','user-agent','if-none-match','if-modified-since']);
    const headerBytes=Buffer.byteLength(`Host: ${url.host}\r\nConnection: close\r\n`)+[...options.headers].reduce((size,[name,value])=>size+Buffer.byteLength(`${name}: ${value}\r\n`),0);
    if([...options.headers.keys()].some(name=>!allowedHeaders.has(name))||headerBytes>1024){reject(new Error('http_transport_rejected'));return;}
    const pin={...options.address};
    const agent=new Agent({keepAlive:false,maxCachedSessions:0,maxSockets:1,proxyEnv:{}});
    const cleanup=()=>agent.destroy();
    let req:ClientRequest;
    try{req=send(url,{
      agent,method:'GET',servername:url.hostname,rejectUnauthorized:true,family:pin.family,
      signal:options.signal,maxHeaderSize:8192,headers:Object.fromEntries(options.headers),
      lookup(hostname,lookupOptions,callback){
        if(hostname!==url.hostname){callback(new Error('http_dns_target_changed'),'',pin.family);return;}
        if(lookupOptions.all)callback(null,[pin]);else callback(null,pin.address,pin.family);
      },
    },response=>{try{
      const headers=new Headers();
      for(const key of ['content-type','content-length','content-encoding','etag','last-modified','location']){
        const value=response.headers[key];if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
      }
      const status=response.statusCode??502;
      if(status>599){response.destroy();cleanup();reject(new Error('http_response_failed'));return;}
      if(status<200||status===204||status===205||status===304){response.destroy();cleanup();resolve(new Response(null,{status:status<200?502:status,headers}));return;}
      const iterator=response[Symbol.asyncIterator]();
      const stream=new ReadableStream<Uint8Array>({
        async pull(controller){try{const next=await iterator.next();if(next.done){controller.close();cleanup();}else controller.enqueue(next.value);}catch{controller.error(new Error('http_body_failed'));cleanup();}},
        cancel(){response.destroy();cleanup();},
      },{highWaterMark:0});
      resolve(new Response(stream,{status,headers}));
    }catch{response.destroy();cleanup();reject(new Error('http_response_failed'));}});
    }catch{cleanup();reject(new Error('http_network_failed'));return;}
    req.on('socket',socket=>socket.once('secureConnect',()=>{
      const address=socket.remoteAddress;const family=isIP(address??'');const expected=new BlockList();expected.addAddress(pin.address,pin.family===4?'ipv4':'ipv6');
      if(!address||!publicAddress({address,family})||!expected.check(address,family===4?'ipv4':'ipv6'))req.destroy(new Error('http_address_changed'));
    }));
    req.on('error',()=>{cleanup();reject(new Error('http_network_failed'));});req.end();
  });
}
export const nodeFetch=createNodeFetch();
