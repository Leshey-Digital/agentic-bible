# Requirements

- Signed editors may combine disposition, canonical article and exact case-sensitive tag filters. Unknown articles, invalid tags, duplicate/unknown query keys fail closed. Public/unauthenticated requests remain closed.
- Apply SQL predicates before the 20-item page limit; use parameter binding and JSON array membership, never substring or wildcard matching. Existing order/cursor remain compatible.
- Next page uses the last successfully applied filter set; applying new filters starts from the first page. Empty/error/loading states are explicit. Filtering does not discard an open suggestion draft.
- Local real D1 API checks and keyboard/mobile browser journey prove filtering, pagination, invalid input and no external calls. No live provider acceptance is implied.
