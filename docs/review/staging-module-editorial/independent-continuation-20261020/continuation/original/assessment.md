# Hosted qualification continuation assessment

Source: 912c75fddc54f223f5d2997596b9cc224ad4b830. No source or test modifications. Original run db3491bb-a6c6-4b67-9262-17175228f56b remains terminal failed and unchanged.

## Exact failures

- connected.test.mjs:3 — shipped Worker verifies real signed identity, persists an approval and proposes a recoverable GitHub draft: controlled proposed-source build deadline, case 57688.557611 ms.
- connected.test.mjs:11 — signed identity rejects wrong claims, algorithms, keys, expiry, forgery and CSRF before D1 or GitHub: 30000 ms test timeout, observed 36035.133629 ms.
- connected.test.mjs:17 — immutable hosted approval collisions, ownership, revocation and source budgets remain bounded after restart: 30000 ms test timeout, observed 33564.160317 ms.
- native.test.mjs:22 — actual Workers/D1 proposes one pinned GitHub change and replays after restart without reactivation: controlled proposed-source build deadline, case 56680.824456 ms.
- native.test.mjs:28 — ambiguous ref/PR effects and D1 completion faults resume without duplicate visible proposals: 45000 ms timeout, observed 46000.798406 ms.
- native.test.mjs:31 — authorization, changed/revoked approvals, stale Git bases and foreign branches fail closed: 45000 ms timeout, observed 45845.622033 ms.

Both build failures call the same project-build.mjs child with an unchanged 30000 ms deadline. That helper discards child stdout/stderr and removes its temporary project in finally. There is no retained build-stage trace to establish a semantic failure or the exact contention source. Concurrent file scheduling and the isolated 9.536-second pass support investigating contention, but do not establish its cause or exclude a product defect.

## Resource and cleanup evidence

The executor has accumulated unreaped processes and is unsuitable for further qualification. No per-test resource timeline was retained, and no OOM event was recorded. These observations do not establish the cause of the failed cases. Process provenance inspection was denied; no unidentified process was killed and no alternate inspection route was used. Unnecessary process identifiers and inventory details are excluded from this published assessment.

Any later permitted execution should use the existing tests/support/process-supervisor.py around the entire owned suite process tree, with its parent-death guard and subreaper cleanup. No new test process was started in this assessment.

## Exact contract incompatibility

scripts/release-qualify.mjs accepts only an output directory. src/release/qualification.ts:67 creates a new output directory, :69 always starts at manifest index zero, :71 invokes fixed npm scripts without additional arguments, and :68 excludes scheduling overrides from the child environment. The hosted package script is node --test tests/hosted/*.test.mjs, with default file concurrency. There is no serial hosted variant or supported continuation mode. Successful check durations exist only in the runner's in-memory checks array until all steps pass (:79-84), so the exited run has logs but no durable per-step receipt to import. docs/local-qualified-releases.md explicitly states failed output is never resumed/relabelled as a passing run.

Therefore serial execution and remaining-step evidence can be collected separately, but cannot honestly become this exact runner's successful qualification through its supported interface. Per the parent's explicit instruction to report when serial scheduling is incompatible, no new run, fabricated receipt or source patch was made.

## Independent continuation boundary

No application or test change is demonstrated or required by this assessment. A clean saved environment may run the unchanged hosted files serially, with original assertions and deadlines, followed by the 41 previously unrun commands. Record source/tree, command and scheduling, actual results/timings, log hashes and artifact pins as independently labelled evidence. Preserve this original failed run and never present the combined evidence as a successful receipt from the existing runner. Historical missing timings must remain unavailable.

The earlier suggestion of changing qualification orchestration is unnecessary for this independently labelled continuation and is not being implemented. No further test executes in the degraded executor.

State: original qualification failed; root cause unresolved; independent continuation not started. Provider state unchanged.
