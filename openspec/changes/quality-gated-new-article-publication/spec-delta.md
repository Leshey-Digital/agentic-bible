# Added requirements

- Given a technically valid new article slug, the complete candidate-quality request may bind that identity, but publication must remain closed until a durable trusted verifier returns an allow decision for the exact candidate and source bytes.
- Given a denied, uncertain, or unavailable quality decision, the local publication pointer, revision inventory, search metadata, review status and history remain unchanged.
- Given an allowed new article, the bounded isolated publisher records its current revision and readable/searchable/history metadata, retains post-publication review flags, and preserves existing finite article/operation/revision/storage limits.
- Given an identical event retry, return the original quality and publication receipts without new verifier dispatch or publication operation. Reuse of an event with changed candidate or sources conflicts.
- Given a rollback, restore only the expected active ancestor snapshot while retaining immutable publication history and event receipts. Replaying an already completed publication after rollback returns its original receipt and does not reactivate it.
- Canonical maintenance file targets remain limited to the existing `readingArticleIds`; this local publication admission does not expand canonical Git write authority.
- Given an `apply` CLI publish command for an ID outside the compiled twenty, reject any new event or changed candidate before publication even if that ID appears in retained history; only an exact previously recorded event replay may return its original receipt, without reactivation or other state change.
- The fixed demo may exercise the coordinator only with a deterministic `controlled-test` verifier, clearly identified synthetic evidence, and durable isolated local D1 receipts; it must not represent this assessment as factual verification or live provider evidence.

# Acceptance scenarios

Use controlled local verifier output and actual local D1 plus the isolated publisher. Exercise new identity allow/deny, replay after restart, event conflicts, visible current/review/history metadata, a later revision, rollback to the prior snapshot, and replay without reactivation. Confirm no repository article Markdown or canonical Git file changes. Keep all live provider, source-fetch, hosting, credential and deployment paths disabled.
