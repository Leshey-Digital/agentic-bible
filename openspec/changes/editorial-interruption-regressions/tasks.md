# Tasks

- [x] Branch from the exact immutable PR #4 head and inspect existing recovery coverage.
- [x] Add three real Worker/D1 regressions with exact record/audit counts and recovered-field assertions.
- [x] Record the baseline: unchanged retry and reload-during-save passed; clear-only failed because the response recreated an empty stored draft.
- [x] Make the minimal client storage-ownership fix only on this new branch.
- [x] Run validation (zero diagnostics, four static and nine server tests), all 11 Worker/D1 and 16 reading/browser checks, partial accessibility audits and staging dry run (52 assets, no bindings/deployment). Browser suites ran sequentially with one worker and a 90-second timeout for this environment.
- [x] Prepare the separate branch and exact-base draft-PR handoff with baseline failure and verification results.
- [ ] Remote CI and independent review before integration; no merge or deployment here.
