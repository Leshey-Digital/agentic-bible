# Tasks: consistent D1 recovery

- [x] Confirm official D1 export, `batch()` transaction, `dump()` scope and documented input/query limits.
- [x] Add versioned bounded D1 export with same-batch schema/data capture and drift checks.
- [x] Add strict artifact validation, explicit schema authorization and atomic fresh-database restore.
- [x] Exercise real local Miniflare D1 for complete schemas/data, concurrent mutations, limits, corruption, rollback and restart.
- [x] Document that content digests do not authenticate an artifact and require protected outer storage and schema authorization.
- [ ] Obtain independent review of the exact recovery diff.
