# Proposed delta

- Collection requires explicit runtime opt-in and a supplied controlled transport. Source selection is a fixed registry ID and UUID key, never a contributed URL or credentials.
- Existing D1 HTTP reservation precedes one bounded request. Collection accepts only original, nonempty, safe UTF-8 plain text at the existing producer's 2-KiB bound; invalid or ambiguous results cannot create eligible evidence.
- A sixteen-key durable ledger and at most two 2-KiB filesystem entries per key bound local retention. Paths are owned, regular, nonsymlink files. Body publication is immutable and atomic; no overwrite, pruning or refund endpoint.
- Persist body and a validated prepared journal before completing HTTP authority. Replays verify current charged D1 receipt and original hash/length; recover known completion loss without fetching again. Pre-journal ambiguity and stale leases remain explicit, with no automatic redispatch.
- A 304-only receipt cannot stand in for charged original 200 bytes. HTML normalization, real source authenticity/factual validation and live transport are not claimed.
- Returned evidence feeds the existing budgeted fake producer and automatic local publication with human review flags afterward. Community approvals, GitHub canonical source and release gates remain unchanged.
