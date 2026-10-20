# Added: bounded contribution review provenance

An authenticated editor can read their existing bound reviews for a suggestion with revision, source pin, note/citation and approval current/stale/revoked status. Each review distinguishes no recorded draft attempt, an uncertain attempt, and a validated historical draft receipt. Only the fixed repository's exact PR URL can become a link.

Acceptance: submit synthetic suggestion, move to follow-up, review pinned source, explicitly create a controlled draft, restart D1 and see the same receipt from the suggestion. A stale or revoked approval preserves recorded draft history without making it executable. Another owner sees none of these records. Corrupt note/binding/fingerprint/receipt fails closed. History GET causes zero provider calls, outbox writes or new records and rechecks identity expiry. Existing public and paid gates stay unchanged.
