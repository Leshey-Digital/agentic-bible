# Proposed added behavior

- Monitoring accepts only catalog source IDs. Fixture HTTP requests use catalog HTTPS URLs, conditional validators, manual redirects, a response byte ceiling and a deadline. No outside URL is fetched.
- Baseline/304/unchanged responses do not invent source changes. Changed hashes produce one event per source content version and one candidate per affected article, transactionally with the source/job state.
- Jobs have persisted dedupe keys, short leases, bounded retries/backoff, daily request reservations, bounded queues and an explicit fixture-only/zero-paid-call policy. Old workers cannot commit after lease loss.
- Valid evidence-backed candidates automatically publish local metadata revisions and receive post-publication review flags. Missing evidence and malformed payloads have explicit blocked states, not silent publication or universal human preapproval.
- Published local revisions can be reverted/restored with optimistic concurrency, audit history and idempotency keys. These operations never claim a public article release or change article text.
- Existing admin/session/CSRF gates protect local controls. No live scheduled handler, credentials, production auth, external fetching or paid inference is enabled.
