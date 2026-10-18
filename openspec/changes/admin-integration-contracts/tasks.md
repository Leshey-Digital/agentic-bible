# Implementation and verification

- [x] Read repository guidance, decisions/product/workflow, measurement and hosted identity/configuration contracts; verify exact base `b41a422881921638833f92b2361a70eb1647d01f` and isolated branch.
- [x] Implement unmounted fixed-target server contract, direct existing signed verifier and strict origin/CSRF/body controls.
- [x] Define trusted atomic write-only storage and fixed scoped connection-test interfaces; supply no production implementation.
- [x] Enforce owner/current-revision/replay bounds and stale test-completion protection; build mask/status/audit projections explicitly.
- [x] Exercise disposable fake storage and actual generated RS256 identity, unknown fields, body bounds, mask independence, rotation/races/rollback, replay/ownership, redaction and connection deadlines/quotas.
- [x] Retain and run existing local measurement tests.
- [ ] Complete final focused tests, docs validation and Astro/TypeScript check after final edits; record actual results in handoff.
- [ ] Coordinate broader validation with parent and record passed/failed/not-run separately.
- [ ] Obtain separate independent exact-commit review before integration.

No route or persistent/live provider adapter is implemented. Tests using memory survive handler replacement only; they do not demonstrate process persistence or vault operation.
