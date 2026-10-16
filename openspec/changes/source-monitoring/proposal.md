# Deterministic local source monitoring

Stack on immutable PR #3 at efa15e6. Implement metadata-driven, bounded fixture HTTP checks, conditional requests, content hashes, deduplicated change events, persisted retry/lease/budget state, a publication candidate queue and reversible local revision/review-flag transitions.

Use the existing article/source metadata as a build-time catalog. No arbitrary URL input, global/network fetch fallback, live cron, model call, provider credential or deployment is enabled. Publication in this slice means a clearly labelled local source-observation metadata ledger; it does not alter article claims, Markdown, the static index or public releases. Eligible candidates automatically enter that ledger with a post-publication review flag. Missing evidence or malformed payloads block explicitly; human preapproval is not a universal state.

Integrate a focused source-check/queue view behind existing local admin authorization. Keep changes narrow, preserve interactive local data, and prove persistence, retries, concurrency, duplicates, budget stops and reversibility without outside HTTP or paid inference.
