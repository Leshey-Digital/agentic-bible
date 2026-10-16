import type { FixtureTransport } from './contracts.ts';

// No global fetch call exists here. All payloads are small, original synthetic fixtures.
export const fixtureTransport:FixtureTransport={
  mode:'fixture',
  async fetch(url,options) {
    if(options.scenario==='timeout')return new Promise<Response>(()=>{});
    if(options.scenario==='redirect')return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});
    if(options.scenario==='malformed')return new Response('{broken',{headers:{'Content-Type':'application/json'}});
    if(options.scenario==='not-modified')return new Response(null,{status:304});
    if(options.scenario==='transient'&&options.attempt<3)return new Response('Synthetic temporary failure',{status:503});
    const previous=options.headers.get('If-None-Match');
    const version=options.scenario==='change'||options.scenario==='transient'?2:options.scenario==='unchanged'&&previous==='"fixture-v2"'?2:1;
    const etag=`"fixture-v${version}"`;
    if(previous===etag)return new Response(null,{status:304});
    return new Response(`Synthetic fixture version ${version} for ${url}. No source page was fetched.`,{headers:{'Content-Type':'text/plain; charset=utf-8',ETag:etag,'Last-Modified':version===1?'Thu, 01 Oct 2026 00:00:00 GMT':'Fri, 02 Oct 2026 00:00:00 GMT'}});
  },
};
