import {gitSha,hash,limits,type Ports} from './contracts.ts';
import {hostedTarget,sourceCitations} from './targets.ts';
export type BuildReviewSnapshot={commit:string;articles:Record<string,{markdown:string;sha256:string}>};
/** Trusted build input only. Never supplied by a request, binding or remote fetch. */
export function buildReviewSource(snapshot:BuildReviewSnapshot):NonNullable<Ports['reviewSource']>{
 return async articleId=>{
  const target=hostedTarget(articleId),entry=Object.hasOwn(snapshot.articles,articleId)?snapshot.articles[articleId]:null;
  if(!gitSha(snapshot.commit)||!target||!entry||new TextEncoder().encode(entry.markdown).byteLength>limits.markdownBytes||await hash(entry.markdown)!==entry.sha256)throw Error('build_review_source_invalid');
  return {...target,baseCommit:snapshot.commit,baseMarkdownSha256:entry.sha256,markdown:entry.markdown,citations:sourceCitations(entry.markdown),sourceAuthority:'immutable-build' as const,gitHubDraftAvailable:false};
 };
}
