# Tasks

- [x] Verify actual workspace, remote heads and free ports after disconnect; branch from the exact PR #5 head.
- [x] Implement bounded receipt migration, frozen plans, ownership and attempt guards, and exact result replay.
- [x] Verify conflicts, crash/resumption, stale-owner handoff, capacity/window boundaries and unchanged daily budgets with 23 monitoring/SQLite tests and actual Worker/D1.
- [x] Run validation (zero diagnostics; four static and nine server tests), 10 Worker/D1 browser and 16 reading checks, real Worker restart/retention integration and static staging dry run (53 assets, no bindings/deployment). Browser runs used one worker and a 90-second local timeout.
- [x] Prepare the separate fix branch and exact-base handoff for draft PR publication.
- [ ] Exact-head remote CI and independent review before integration.
- [ ] Independent acceptance/integration by another reviewer; no self-approval, merge or deployment.
