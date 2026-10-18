// Linear, bounded context diff; no HTML parsing or quadratic edit matrix.
export type ChangeLine={kind:'context'|'removed'|'added';text:string};
function readable(text:string){
 // One pass preserves literal source entities/backslashes; decoded punctuation is
 // displayed as escaped text by Astro, never interpreted as HTML or Markdown.
 return text.replace(/&#([0-9]{1,3});|&(amp|lt|gt|quot);|\\([!-/:-@\[-`{-~])/g,(original,number,named,escaped)=>{
  if(escaped!==undefined)return escaped;
  if(named)return ({amp:'&',lt:'<',gt:'>',quot:'"'} as Record<string,string>)[named];
  const char=String.fromCharCode(Number(number));return /[!-/:-@\[-`{-~]/.test(char)?char:original;
 });
}
export function readableDiff(before:string,after:string):ChangeLine[]{
 const body=(text:string)=>readable(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').replace(/\r\n/g,'\n')).split('\n');
 const old=body(before),next=body(after);let start=0,end=0;
 while(start<old.length&&start<next.length&&old[start]===next[start])start++;
 while(end<old.length-start&&end<next.length-start&&old[old.length-1-end]===next[next.length-1-end])end++;
 if(start===old.length&&start===next.length)return [];
 return [...old.slice(Math.max(0,start-3),start).map(text=>({kind:'context' as const,text})),...old.slice(start,old.length-end).map(text=>({kind:'removed' as const,text})),...next.slice(start,next.length-end).map(text=>({kind:'added' as const,text})),...next.slice(next.length-end,next.length-end+3).map(text=>({kind:'context' as const,text}))];
}
