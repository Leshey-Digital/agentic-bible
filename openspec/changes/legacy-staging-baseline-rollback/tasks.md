# Tasks

- [x] Inspect current release guards and read-only Cloudflare baseline metadata/bindings.
- [x] Add the distinct legacy-baseline schema and canonical digest validation.
- [x] Add exact metadata/binding re-fetch and guarded legacy rollback journaling.
- [x] Add positive, replay and tampering tests with no real provider writes.
- [ ] Capture runtime evidence through an authorized read-only route/browser; keep unavailable evidence explicit.
- [x] Obtain independent review of exact source commit `7689698316125fb68c46c7122fa41192d56091a0`; reviewer found no remaining actionable findings.
- [ ] Run one full exact-source saved-environment qualification after focused tests, review, and required runtime evidence are available.

Implementation and the focused regression suites are complete locally. Independent review accepted code commit `7689698316125fb68c46c7122fa41192d56091a0`; the current qualification source was `ddabc2863b1af4fc68e62ba1089a2a9aaab155da`.

The authorized connector route did not reach staging: `GET https://staging.agenticbible.si/api/runtime/status` returned 403 Forbidden, `text/plain`, body `Forbidden: requests to staging.agenticbible.si are not allowed`; `HEAD https://staging.agenticbible.si/` returned 403 Forbidden, `text/plain`, with no body. This is a tool-route request denial, not evidence of a Cloudflare Access login page or a Worker runtime response. Direct executor `GET https://staging.agenticbible.si/api/runtime/status` failed before HTTP with `EAI_AGAIN` / `fetch failed`. No baseline record was manufactured.

One exact-source qualification attempt was retained at `.git/local-qualifications/qualification-ddabc28-20261020-021859/`. It passed through `test:maintenance-review` and stopped at `test:maintenance-restore` when the resource supervisor observed 1,000 total processes (983 zombies, mostly pre-existing/accumulated). At the stop sample memory was 9.79 GB (9.12 GiB) of 16 GiB, cgroup high/OOM counters were zero, `pids.max` was unlimited, and four `workerd` processes were live (108 zombie). The per-stage samples and supervisor log are in `.git/local-qualification-resources/qualification-ddabc28-20261020-021859.resources.jsonl` and `.stdout.log`. No success receipt exists; this run was not retried. The prior release journal remains untouched. Qualification and baseline capture remain incomplete.

On current code head `7689698316125fb68c46c7122fa41192d56091a0` (subsequently followed only by documentation commits), focused baseline tests passed 6/6 and the four-file release regression set passed serially 22/22. The default-parallel four-file invocation passed 21/22: the local Git build assertion failed to find `ReleasefixtureSecond`; that named test passed alone and passed in the serial set. No assertion or coverage was changed.
