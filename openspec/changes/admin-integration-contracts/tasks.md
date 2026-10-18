# Implementation and verification

- [x] Read repository guidance, decisions/product/workflow, measurement and hosted identity/configuration contracts; verify exact base `b41a422881921638833f92b2361a70eb1647d01f` and isolated branch.
- [x] Implement unmounted fixed-target server contract, direct existing signed verifier and strict origin/CSRF/body controls.
- [x] Define trusted atomic write-only storage and fixed scoped connection-test interfaces; supply no production implementation.
- [x] Enforce owner/current-revision/replay bounds and stale test-completion protection; build mask/status/audit projections explicitly.
- [x] Exercise disposable fake storage and actual generated RS256 identity, unknown fields, body bounds, mask independence, rotation/races/rollback, replay/ownership, redaction and connection deadlines/quotas.
- [x] Retain and run existing local measurement tests.
- [x] Complete initial focused tests (16/16), docs validation, Astro check (zero errors/warnings, one style hint), 31-page/20-indexed-article build, retained settings (19/19) and static tests (8/8) at frozen implementation `9d38eea50b8da486b43895ee8fc12cc6f33462cd`.
- [x] Coordinate broader scope with parent: full validate/browser/native hosted suites are not run on this unmounted contract branch; parent owns broader integration checks.
- [x] Independent review of `9d38eea50b8da486b43895ee8fc12cc6f33462cd` reproduced an expiry microtask between final freshness check and adapter dispatch. Add two real-signed deterministic regressions, reproduce the expired invocation (17 passed/1 failed), and remove the intervening promise hop while retaining pending budgets and safe synchronous-error handling.
- [x] Document the separate delayed-reservation/rotation limitation and trusted adapter's serialized revision-validation responsibility.
- [x] Successor checks passed: focused 18/18, retained settings 19/19, docs (300 Markdown files/365 links), Astro (155 files, zero errors/warnings/hints), and clean diff whitespace. Broader full validation/browser/native hosted/build suites were not repeated for this narrow unmounted correction; prior initial build/static evidence remains distinct above.
- [ ] Obtain independent exact-successor re-review before integration.

No route or persistent/live provider adapter is implemented. Tests using memory survive handler replacement only; they do not demonstrate process persistence or vault operation.
