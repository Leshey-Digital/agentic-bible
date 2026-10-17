import {hash,limits,reject,type ApprovedNote} from './contracts.ts';
const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\`*_[\]{}()#+.!|>~-]/g,'\\$&');
export async function projectNote(markdown:string,note:ApprovedNote){
  if(new TextEncoder().encode(markdown).length>limits.markdownBytes||await hash(markdown)!==note.baseMarkdownSha256)reject('stale_github_content');
  const front=/^---\n([^]*?)\n---\n/.exec(markdown)?.[1];if(!front||!/^title: Tool use$/m.test(front)||[...front.matchAll(/^  - id: (.+)$/gm)].map(m=>m[1]).join(',')!=='openai,claude,mcp-tools')reject('unsupported_github_baseline');
  const markers=[...markdown.matchAll(/<!-- agentic-bible-correction:([a-f0-9-]{36}) -->/g)];if(markers.length>=6||markers.some(m=>m[1]===note.approvalId))reject('github_correction_capacity_or_duplicate');
  const ordinal=['openai','claude','mcp-tools'].indexOf(note.citationId)+1;
  const result=markdown+'\n\n<!-- agentic-bible-correction:'+note.approvalId+' -->\n## Reviewed correction\n\n'+escape(note.note)+' ['+ordinal+'](#source-'+note.citationId+')\n\nContribution reference: `'+note.submissionId+'` · submission revision '+note.submissionRevision+' · reviewer reference `'+note.reviewerRef+'` · approval `'+note.approvalId+'`.\n';
  if(new TextEncoder().encode(result).length>limits.markdownBytes)reject('github_markdown_capacity');return result;
}
