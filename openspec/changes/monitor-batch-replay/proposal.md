# Durable local batch-command replay

Base: immutable PR #5 head `9ac36c2e11dd8fb2316ddecb1e497cafafdfbd9a`. Independent review reproduced identical schedule keys creating four additional jobs and identical process keys reserving four additional attempts. Fix this on a separate branch; keep PR #5 and PR #6 unchanged.

Persist schedule/process command receipts, action fingerprints, frozen work plans and exact JSON results. Use leased ownership and atomic attempt-ordinal claims so recovery cannot select another batch or retry an already charged attempt. Freeze publication candidate IDs before publishing. Completed API retries return the saved snapshot even after later work or a Worker restart. Native forms retain the same reference when pending work must be retried.

Retain up to 128 receipts for a fixed 24-hour retry window, with 128 KiB per result. Purge only expired, inactive receipts. At capacity, fail closed rather than evict any supported replay. Different actions conflict under the same key; unsupported payload fields are rejected. Outside the window, clients must use a fresh reference; an expired/removed key is no longer protected against re-execution.

This adds one local migration and bounded storage, not a monetary budget or infrastructure resource. Existing source/job/day limits, fixture transport, remote gates, publication scope and authentication remain unchanged. No live fetch, cron, paid call, merge or deployment is enabled. Preserve local SQLite; rollback requires reverting code and preserving/exporting state before deliberately reverting migration 0003. Independent review is required before integration.
