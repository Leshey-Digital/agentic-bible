# Preserve unchanged-save request references

PR #7 returns early for unchanged settings, so a successful request reference can later bind a changed payload and an identical retry becomes stale after later edits. Preserve the original private no-op response without inventing a settings change or consuming change audit.

Scope: actor-scoped normalized payload fingerprints, a separate bounded receipt table, exact retry responses, cross-table concurrency guards, restart/retention/failure coverage and unchanged production/privacy gates. Changed-write replay semantics remain compatible. No live tracking, secret storage, identity, public intake, deployment or paid calls are added.

Base: exact PR #7 `2254699fe4828f6ad11724a7f10c75e899609506`. This branch owns `0004_measurement_request_receipts.sql`, dependent on PR #7's `0003_measurement_settings.sql`. PR #8 owns the independent `0003_monitor_batch_commands.sql`; keep both filenames and run both `0003` migrations before `0004` when integrating. PR #7 and PR #8 stay immutable.

Receipt limits are 128 rows, 32 KiB UTF-8 per response and 24 hours from first success. New no-ops fail closed at capacity; supported retries are not evicted. Changed writes retain their independent 1,000-event limit. Snapshots retain non-secret historical settings and existing value-free audit summaries in the private local database; they never control public rendering or overwrite current state. Only expired receipts are deleted. This adds at most 4 MiB of response payload plus metadata/indexes, no remote resource or operating cost.

Alternative: putting no-ops in audit would falsely record changes and exhaust the existing history budget. Recomputing replies from current settings loses deterministic recovery. Keeping unbounded receipts defeats local capacity limits. No additional product decision is needed for this authorized repair.

Rollback: stop Worker, preserve database copy and use the prior app with the additive table unused. Existing settings/audit/inbox/source rows remain intact. Independent review and passing CI are required before any integration; this branch makes no merge or deployment.
