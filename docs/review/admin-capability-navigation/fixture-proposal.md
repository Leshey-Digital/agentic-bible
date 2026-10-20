# Proposed single staging fixture — not inserted

Target only `agentic-bible-staging-editorial` / D1 `1ca9a6f8-c0a9-4040-8a2f-e22d888a985a` through the existing authorized Agentic Bible connector. Exact synthetic record content and fixed identifiers are in [fixture-proposal.json](fixture-proposal.json). No contributor identity is impersonated; actor is `synthetic-staging-fixture`. No source is fetched, public intake opened or credential created.

The existing local fixtures call `D1EditorialStore.submit`; there is no remote staging seed command or UI. Do not invoke that helper remotely: it also updates rate counters and prunes old sessions. No new endpoint is proposed. The bounded alternative is two guarded inserts into existing `submissions` and `editorial_audit`, followed by exact readback.

## Reviewed procedure for later authorization

1. Freeze the exact JSON and its hash in an insertion journal. Read only rows matching the fixed submission ID, request key, fingerprint or audit ID. Compare all fixed fields without returning unrelated records. Confirm schema and the 1000-submission capacity guard. Do not use the empty browser view as proof the database is empty.
2. If both exact untouched records already exist, return an idempotent no-op. If IDs collide, a record differs, only one record exists, or the fixture has already been edited/reviewed, stop and report; never overwrite, reset or delete anything.
3. If neither exists, insert the fixed submission with `INSERT ... SELECT ... WHERE NOT EXISTS` guards for all three unique identifiers, absence of its audit ID, and the existing capacity. No `UPDATE`, `REPLACE` or deletion is permitted. Verify the exact inserted row before continuing.
4. Insert the matching audit only when the complete unchanged submission (including version 1, new status and last_event_id) exists and the audit ID is absent. Verify both exact records. A duplicate invocation that finds both exact records performs no write. Do not touch any other submission, audit, rate window, session, review or GitHub table.
5. The HTTP query transport is not assumed to be a transaction across two requests. If a response is uncertain or only one record exists, record partial state and stop for reconciliation; do not claim a completed fixture or blindly retry. Cloudflare documents transactional behavior for Worker `D1Database.batch`, but that is not automatically a guarantee for the connector's REST query transport. No temporary Worker or endpoint is proposed to obtain it.
6. Only after complete readback may the real signed editor use the normal inbox to move this fixture to follow-up, review the immutable tool-use source, save a clearly synthetic note and read it back. Retain the fixture and audit; cleanup is a separate scoped decision. No GitHub draft or article publication is part of this trial.

This is a proposal for parent review. No D1 read or write was performed to prepare it; no synthetic record exists because of this work.
