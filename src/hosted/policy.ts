// Shared server/browser guard: one leading slash and bounded plain path segments.
// Protocol-relative links and normalization aliases cannot nominate policy pages.
export function policyPath(value:unknown):value is string{return typeof value==='string'&&value.length<=200&&/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/){1,8}$/.test(value);}
