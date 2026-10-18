// Safe structural diagnostics only. Never retain messages, stacks, paths, URLs or payloads.
const names=new Set(['Error','TypeError','SyntaxError','RangeError','AssertionError','BridgeError','PublicationError','SocketError','ConnectTimeoutError','HeadersTimeoutError','BodyTimeoutError','AbortError']);
const codes=new Set(['UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_ABORTED','ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT','EACCES','ENOENT','ABORT_ERR','ERR_ASSERTION','full_wiki_build_failed','bridge_busy','bridge_storage_capacity','bridge_build_attempts_exhausted','build_source_changed','bridge_outcome_unconfirmed_retry_same_event']);
export const childPhases=['owner-checked','imports-ready','plan-read','astro-complete','history-complete','index-complete','complete','failure','owner-lost','deadline'] as const;
export function safeFailure(error:unknown,depth=0):Record<string,unknown>{
  try{
    if(!error||typeof error!=='object')return {type:'UnknownError',code:'unclassified'};
    const e=error as {name?:unknown;type?:unknown;code?:unknown;cause?:unknown;diagnostics?:{stop?:unknown;lastPhase?:unknown}};
    const candidate=typeof e.name==='string'?e.name:e.type;const type=typeof candidate==='string'&&names.has(candidate)?candidate:'UnknownError';
    const code=typeof e.code==='string'&&codes.has(e.code)?e.code:'unclassified';
    const result:Record<string,unknown>={type,code};if(depth<2&&e.cause)result.cause=safeFailure(e.cause,depth+1);
    if(e.diagnostics){if(typeof e.diagnostics.stop==='string'&&['child-exit','deadline','spawn','capture-capacity','capture-accounting','checkpoint','parent-build'].includes(e.diagnostics.stop))result.stop=e.diagnostics.stop;if(typeof e.diagnostics.lastPhase==='string'&&(childPhases as readonly string[]).includes(e.diagnostics.lastPhase))result.lastPhase=e.diagnostics.lastPhase;}
    return result;
  }catch{return {type:'UnknownError',code:'unclassified'};}
}
