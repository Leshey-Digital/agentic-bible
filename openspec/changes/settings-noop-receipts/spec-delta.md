# Changed requirements

- An unchanged save must bind actor/request reference to normalized group, values and submitted revision. A matching retry within its fixed 24-hour window returns the original private API JSON after later writes or restart; changed reuse returns 409.
- No-op receipts are separate from settings changes and value-free audit. They do not alter section revisions or audit counts. Legacy changed-write references remain replayable with their original semantics.
- Identical concurrent no-ops create one receipt and return identical JSON. A changed write racing a no-op under one reference cannot both succeed with different payloads. Faults cannot leave partial settings/audit changes or claim failed references.
- Retain at most 128 no-op receipts, at most 32 KiB UTF-8 each. Do not evict unexpired supported receipts. At capacity a new no-op returns 503; supported retries and independent change history remain usable. Only expiry frees receipt slots; retries do not extend expiry.
- Revalidate cached response shape and privacy defaults before replay. Current GET state and public policy preview always use current settings, never cached responses. Private receipt retention creates no credential path, collection, consent or advertising activation.
- The additive uniquely named `0004` migration must preserve prior settings/audit/inbox/source data and coexist with independently owned monitoring migration `0003_monitor_batch_commands.sql`.

# Acceptance scenarios

Unit/SQLite coverage exercises exact response replay, changed reuse, actor scoping, cap and exact expiry boundary, legacy data migration/reopen, corrupt/oversized snapshots, transaction failures and current public privacy state. Actual Worker/D1 browser checks lose a committed response, reload, change settings and retry; concurrent no-op/changed payloads have one winner. A dedicated real Worker/D1 test restarts the process, fills/expires local receipts, injects storage failures, preserves unrelated data and verifies current public rendering. Existing settings, editorial, monitoring, reading, build, accessibility and staging dry-run checks remain green; CI runs these tests without deploying.
