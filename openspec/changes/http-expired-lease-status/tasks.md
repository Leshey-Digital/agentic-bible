# Tasks

- [x] Preserve PR12/PR13 and reproduce the P3 with a failing actual local workerd/D1 regression.
- [x] Make busy status depend on lease expiry and pass the trusted service clock; preserve all claim/completion SQL and limits.
- [x] Verify exact expiry, repeated blocked calls/restart, daily rollover, persisted backoff, receipts and zero extra fetches/reservations.
- [x] Run full documented validation and static dry run; actual Worker/D1 regression passes. Final reading/pre-publication inspection is recorded in the evidence handoff.
- [x] Prepare focused draft handoff under authorized publication scope; record later publication/exact-head CI outcome in the PR body. No merge/deployment.
- [ ] Independent exact-head integration review of this fix; author validation is not release acceptance.
