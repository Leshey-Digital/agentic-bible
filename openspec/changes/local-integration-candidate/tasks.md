# Tasks

- [x] Verify ancestry and create a new branch from exact PR #7; cherry-pick PR #4/#6 with source SHA trailers.
- [x] Independently accept PR #8 at 47885169b71b352c9425dc3b3aa269322ac549ae and include with source SHA trailer; preserve both test-command lists when resolving conflicts.
- [x] Verify populated migration upgrades in both orders, real local migration/reapply with all 14 prior table hashes unchanged, and combined browser journey without resetting interactive data.
- [x] Run combined validation, 20 Worker/D1 browser cases, full cross-feature journey, real Worker restart/capacity, 16 reading checks and static dry run.
- [x] Prepare the focused draft integration PR handoff with exact provenance, CI result recorded before completion, known MVP gaps and rollback; no main merge/deployment.
- [x] Independently accept PR #9 at a72b8f8c3d772618cf279035be4c19c8103d4198 and integrate its three commits locally; the no-op receipt P2 is closed within its documented retry window.
- [x] Rerun all local combined checks after PR #9: 58 static/server/upgrade tests, 22 Worker/D1 browser cases, complete journey, 16 reading cases, both Worker restart suites and static dry run. Migration 0004 preserved all 15 prior table hashes; reapply did no work.
- [x] Obtain separate explicit user authorization for draft publication and prepare one authorized PR-creation retry; actual outcome and final-head CI are recorded in the handoff. No main merge/deployment authorization is implied.
- [ ] Independent integration acceptance and pending release approval; do not merge/deploy here.
