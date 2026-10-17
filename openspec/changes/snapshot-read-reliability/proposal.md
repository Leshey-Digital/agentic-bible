# Snapshot read and local harness reliability

Independent review identified P2 excessive bounded-read allocations (reported 1.41 GB requested for1.33 MB read) and duplicate current-snapshot inventory validation per pinned HTTP request; P2 Miniflare CF-metadata startup traffic bypassing application counters; P3 expensive child imports before its PID guard. Preserve PR27 d3c80414634480fdf479131bd96e490c58b1d1a0 and the separately preserved correction checkpoint a222eece3f4719a77c1da4cc39d5ab6b0bfa268a.

Allocate for observed regular-file size with a sentinel while retaining maximum, no-follow, change detection and full content/hash/inventory validation. Reuse only the current request's already-validated current manifest; historical requests retain distinct current-authority/target validation. Verify the actual served bytes against that manifest. No persistent integrity cache.

Disable external CF metadata explicitly in local Miniflare and inherited CLI/archive harness environments. Keep actual workerd/D1 and original archived application source bytes. Move heavy child imports behind the cheap owner check and start existing guards/deadline first. Retain sanitized bounded child/parallel/network failure diagnostics with no raw payload, cookies, URLs/query strings, SQL or exception text.

Preserve existing five-second assertions,180-second test boundaries,45-second child deadline and all application/resource limits. Add measured regressions and full/native/browser checks, then a separate draft with exact-head CI. Do not claim these changes explain the unresolved59.919-second socket closure, discarded original rejection, mobile search failure or every composition timeout. No main merge, deployment, credentials, paid call, live indexing, license or content change.
