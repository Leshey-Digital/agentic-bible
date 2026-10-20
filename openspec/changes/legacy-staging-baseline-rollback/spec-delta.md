# Proposed release requirements

- Keep `deploy` and qualified `rollback` semantics unchanged. A first deployment may use an exact expected-active legacy version without a prior release receipt.
- A separate `rollback-legacy` action requires a canonical, digest-pinned `legacy-baseline` record and an independent review pin for that digest. Never coerce it into a qualified candidate receipt.
- The baseline binds the fixed staging target, exact version ID/number/creation time/source/script ETag, absence of a candidate marker, full external binding names/types/D1 ID, the original 100% deployment observation, closed runtime status, and bounded public asset byte/hash inventory.
- Before activation, re-read the active deployment and target Worker version and compare every pinned provider field and binding. Require the expected-active version, owner authorization, accepted candidate/review pins, exclusive writer lock, and 100% deployment strategy.
- Journal legacy rollback separately and durably. On recovery, recognize only the same request, baseline digest, expected-active version, and exact legacy version. Never upload or rebuild the baseline.
- Verify restored noindex headers, all pinned asset bytes, and the captured closed runtime fields before recording a distinct `legacy-baseline-restored` outcome. Do not label the outcome `verified-serving` or use it as a candidate rollback receipt.
- Tests cover valid controlled restoration, replay, stale active version, baseline digest tampering, version identity/ETag/creation metadata changes, binding changes, runtime/asset corruption, authorization, and zero upload effects.
