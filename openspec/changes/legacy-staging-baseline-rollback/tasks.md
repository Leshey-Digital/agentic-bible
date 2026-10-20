# Tasks

- [x] Inspect current release guards and read-only Cloudflare baseline metadata/bindings.
- [x] Add the distinct legacy-baseline schema and canonical digest validation.
- [x] Add exact metadata/binding re-fetch and guarded legacy rollback journaling.
- [x] Add positive, replay and tampering tests with no real provider writes.
- [ ] Capture runtime evidence through an authorized read-only route/browser; keep unavailable evidence explicit.
- [x] Obtain independent review of exact source commit `7689698316125fb68c46c7122fa41192d56091a0`; reviewer found no remaining actionable findings.
- [ ] Run one full exact-source saved-environment qualification after focused tests, review, and required runtime evidence are available.

Implementation and the focused regression suites are complete locally. The staging origin returned 403 to both GET and HEAD requests through the authorized read-only route, while direct fetch failed DNS resolution; no baseline record was manufactured. A reviewer rechecked the exact source and found no further actionable issues. Qualification remains pending a usable read-only serving/runtime observation.
