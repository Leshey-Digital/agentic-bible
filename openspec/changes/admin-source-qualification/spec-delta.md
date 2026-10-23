# Source-only admin contract

- POST /api/admin/drafts/source requires the existing signed admin, same-origin, private-inbox gate and explicit admin header; GET never fetches a source.
- Exact article/source/citation/key validation precedes acquisition. Only the distinct registered OpenAI source is accepted.
- Successful response contains full bounded raw bytes, hashes, exact evidence spans, canonical URL and verified D1 receipt, with aiInvoked=false and published=false.
- No model adapter, currency reservation, inbox write, approval or publication is reachable from this action.
- Reusing a request key must not refetch. Errors preserve failed accounting; no retry occurs automatically.
- Draft generation retains its original monetary policy and uncertainty rules.

- The signed admin drafts page exposes “Check OpenAI source only” as a separate non-submit button, pinned to the registered OpenAI/Tool use selection. It cannot select MCP or invoke generation.
- Both action controls lock after either action starts, without automatic retry. Source status and provenance render as text, excluding raw byte arrays, with request ID retained on failures. No page-view acquisition occurs.
