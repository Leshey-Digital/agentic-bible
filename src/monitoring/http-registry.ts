// Reviewed document URLs only. The fixture catalog is intentionally broader.
export const httpSources=Object.freeze([
  {id:'s-82747c62f33e4f204a358a0f',url:'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview',title:'Tool use with Claude'},
  {id:'s-90f2bf11e4fb71c8f42ae128',url:'https://developers.openai.com/api/docs/guides/function-calling',title:'OpenAI function calling'},
  {id:'s-419540fd82a47b8d858d89e6',url:'https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices',title:'MCP security best practices'},
  {id:'s-937fae6437b3fc365812829a',url:'https://modelcontextprotocol.io/specification/2025-11-25/basic/transports',title:'MCP transports'},
  {id:'s-bfba858067cc3eb54024f532',url:'https://modelcontextprotocol.io/specification/2025-11-25/server/tools',title:'MCP tools'},
  {id:'s-d4b8988f42afd69d3b72da14',url:'https://modelcontextprotocol.io/specification/2025-11-25/architecture',title:'MCP architecture'},
].map(source=>Object.freeze(source)));
export const httpLimits=Object.freeze({requests:4,bodyBytes:32768,timeoutMs:2000,dnsAnswers:8});
export function officialSource(id:unknown) {
  return typeof id==='string'?httpSources.find(source=>source.id===id):undefined;
}
export function officialUrl(raw:unknown):URL|null {
  if(typeof raw!=='string'||!httpSources.some(source=>source.url===raw))return null;
  const url=new URL(raw);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&url.href===raw?url:null;
}

// Compiled document transport envelope, not an evidence or model-token allowance.
// Only this registered HTML document receives the larger finite envelope.
export const openaiDownloadProfile=Object.freeze({id:'openai-html-envelope-v1',sourceId:'s-90f2bf11e4fb71c8f42ae128',bodyBytes:1048576});
export function sourceBodyLimit(id:unknown){return id===openaiDownloadProfile.sourceId?openaiDownloadProfile.bodyBytes:httpLimits.bodyBytes;}
