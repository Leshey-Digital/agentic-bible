import {hash} from '../publishing/contracts.ts';
export type CanonicalQualityContext={commit:string;markdownSha256:string;markdown:string};
export function canonicalQualityContext(value:CanonicalQualityContext){
 if(!value||Object.keys(value).sort().join(',')!=='commit,markdown,markdownSha256'||!/^[a-f0-9]{40}$/.test(value.commit)||!/^[a-f0-9]{64}$/.test(value.markdownSha256)||typeof value.markdown!=='string'||Buffer.byteLength(value.markdown)>65536||hash(value.markdown)!==value.markdownSha256)throw Object.assign(Error('quality_canonical_context'),{code:'quality_canonical_context'});
 const match=/^---\n[^]*?\n---\n([^]*)$/.exec(value.markdown);if(!match||!match[1].trim())throw Object.assign(Error('quality_canonical_context'),{code:'quality_canonical_context'});
 // Preserve the entire substantive Markdown body. Frontmatter is metadata, not
 // an arbitrary/truncated excerpt; the full original file hash stays pinned.
 return {profile:'complete-markdown-body-v1' as const,commit:value.commit,markdownSha256:value.markdownSha256,bodyHash:hash(match[1]),body:match[1],untrusted:true as const};
}
