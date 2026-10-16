# Tasks

- [x] Branch locally from exact PR10 and preserve its immutable head.
- [x] Implement static official-source policy, public-address checks and pinned native Node HTTPS transport.
- [x] Add conditional/hash-only adapter and last-good-state behavior with strict limits.
- [x] Verify controlled fetch/resolver/native transport cases, including SSRF/redirects/deadlines/oversize/304 and concurrency budgets.
- [x] Run relevant existing validation/fixture regressions and record the local checkpoint, integration differences and limitations in docs/review/http-source-adapter.md; the handoff records the final exact commit.
- [ ] Independent review before any publication/integration; no push, merge or deployment in this slice.
