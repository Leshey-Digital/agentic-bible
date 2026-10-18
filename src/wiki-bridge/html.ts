/** Rebase actual internal URL attributes while preserving text, comments and raw-text bodies. */
function rewriteUrlAttributes(html:string,rewrite:(value:string)=>string,names:string[]){
  const startTag=/<[a-z](?:[^"'<>]|"[^"]*"|'[^']*')*>/i;
  const attributes=(tag:string)=>tag.replace(/(\s+)([^\s"'<>/=]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g,(whole,space,name,equals,raw)=>{
    if(!names.includes(name.toLowerCase()))return whole;
    const quote=raw[0]==='"'||raw[0]==="'"?raw[0]:'';const value=quote?raw.slice(1,-1):raw;
    const next=rewrite(value);return next!==value?`${space}${name}${equals}${quote}${next}${quote}`:whole;
  });
  return html.replace(/<!--[\s\S]*?-->|<(script|style|textarea|title)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<[a-z](?:[^"'<>]|"[^"]*"|'[^']*')*>/gi,(token,rawText)=>{
    if(token.startsWith('<!--'))return token;
    if(rawText){const opening=startTag.exec(token)![0];return attributes(opening)+token.slice(opening.length);}
    return attributes(token);
  });
}
export function rebasePublisherLinks(html:string,publisherBase:string){return rewriteUrlAttributes(html,value=>{const prefix=value.startsWith(publisherBase)?publisherBase:value.startsWith('/local-publications/')?'/local-publications/':null;return prefix?'/'+value.slice(prefix.length):value;},['href','src']);}
export function pinWikiLinks(html:string,snapshotBase:string){return rewriteUrlAttributes(html,value=>value.startsWith('/')&&!value.startsWith('//')?snapshotBase+value.slice(1):value,['href','src','action']);}
