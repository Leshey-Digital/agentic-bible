# Requirements

- Authenticated editors can page through existing audit snapshots newest first, thirty per page, with deterministic timestamp/ID cursors and exact submission scoping. Unknown/duplicate query fields and invalid cursors fail closed.
- Timeline exposes event ID/action/status/tags/time, not stored actor identity identifiers. The legacy detail response remains compatible.
- UI distinguishes recent versus complete history, supports reload/older events, shows historical tags safely as text, and refreshes after successful disposition/tag or review saves. Stale responses cannot overwrite another suggestion's history. Errors do not relabel a confirmed edit as failed or erase unsaved review text.
- Verify actual local D1 with more than thirty events and desktop/mobile browser behavior. No provider calls, runtime data changes or live acceptance claims.
