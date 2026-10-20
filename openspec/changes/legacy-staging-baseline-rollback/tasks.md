# Tasks

- [x] Inspect current release guards and read-only Cloudflare baseline metadata/bindings.
- [x] Add the distinct legacy-baseline schema and canonical digest validation.
- [x] Add exact metadata/binding re-fetch and guarded legacy rollback journaling.
- [x] Add positive, replay and tampering tests with no real provider writes.
- [ ] Capture runtime evidence through an authorized read-only route/browser; keep unavailable evidence explicit.
- [ ] Obtain independent review of the exact source and evidence.
- [ ] Run one full exact-source saved-environment qualification after focused tests and review pass.

Implementation and the focused regression suites are complete locally. The staging origin returned 403 to both GET and HEAD requests through the authorized read-only route, while direct fetch failed DNS resolution; no baseline record was manufactured. Obtain independent review and a usable read-only serving/runtime observation before qualification.
