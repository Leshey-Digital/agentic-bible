export const openai='s-90f2bf11e4fb71c8f42ae128';
export const mcp='s-bfba858067cc3eb54024f532';
export const urls={
 [openai]:'https://developers.openai.com/api/docs/guides/function-calling',
 [mcp]:'https://modelcontextprotocol.io/specification/2025-11-25/server/tools',
};
export const titles={[openai]:'Function calling | OpenAI API',[mcp]:'Tools - Model Context Protocol'};
// Entirely original small HTTP-shaped documents, not captured provider pages.
export function document(source=mcp,paragraph='Maple agents validate a requested action before reading a source catalog.'){
 return `<!doctype html><html><head><title>${titles[source]}</title><link rel="canonical" href="${urls[source]}"></head><body><nav><p>Navigation is not evidence.</p></nav><main><h1>Controlled documentation example</h1><p>${paragraph}</p><script>const untrusted = '<p>Script text is not evidence.</p>';</script><aside><p>Sidebar is not evidence.</p></aside></main><footer><p>Footer is not evidence.</p></footer></body></html>`;
}
export const bytes=value=>new TextEncoder().encode(value);
export const serialized=packet=>({...packet,source:{...packet.source,raw:{...packet.source.raw,bytes:[...packet.source.raw.bytes]}}});
export const restored=packet=>({...packet,source:{...packet.source,raw:{...packet.source.raw,bytes:Uint8Array.from(packet.source.raw.bytes)}}});
