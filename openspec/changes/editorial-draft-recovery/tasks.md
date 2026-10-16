# Tasks

- [x] Reproduce both defects independently at the exact immutable PR #3 head.
- [x] Preserve newer drafts on successful snapshot completion and add explicit persisted reference recovery.
- [x] Add and run three real Worker/D1 browser regressions, including reload recovery (all eight editorial browser tests passed).
- [x] Run validation (zero diagnostics, four static and nine server tests), 16 reading/browser accessibility checks and static staging dry run (52 assets, no bindings/deployment). Browser suites ran sequentially with a 90-second timeout and one worker; three new regressions failed against the pre-fix build before passing the fixed build.
- [x] Prepare the separate fix branch and exact-base verification handoff for draft PR publication.
- [ ] Independent recheck and integration by the parent; no merge or deployment here.
