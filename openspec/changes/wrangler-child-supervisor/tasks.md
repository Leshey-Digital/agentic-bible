# Tasks

- [x] Add a Linux test-only subreaper for Wrangler's owned process session.
- [x] Route affected Wrangler-backed Worker and release fixtures through the supervisor.
- [x] Cover normal exit, timeout/escalation, nonzero exit, spawn error and unrelated-process isolation.
- [x] Ensure test cleanup terminates the deliberately SIGTERM-resistant unrelated sentinel.
- [x] Run focused supervisor and SEO isolation checks.
- [x] Run affected Worker/build/release regression checks serially.
- [x] Complete independent code review of the supervisor and cleanup fix.
- [ ] Complete one serial full exact-source qualification after process residue is accounted for or a clean runtime is available.
