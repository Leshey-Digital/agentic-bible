# Tasks

- [x] Reproduce the failed-inbox recovery boundary with actual disposable D1.
- [x] Add a bounded immutable owner/selection checkpoint before dispatch; reuse paid ledger output.
- [x] Add explicit authenticated offline recovery with historical pricing validation and idempotent inbox/audit writes.
- [x] Preserve the request ID and provide a labelled recovery action in the private editor.
- [x] Cover write failure/restart, lost response, concurrent requests/recovery, expired policy, owner/auth, tampering, uncertainty, schema/capacity/checkpoint guards and UI reload.
- [ ] Complete exact-head independent review and retained composition qualification.
- [ ] Apply migration or promote any live artifact (outside this implementation task).
