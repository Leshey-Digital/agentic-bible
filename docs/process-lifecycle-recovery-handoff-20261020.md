# Wrangler process-lifecycle recovery handoff

Current recovery work is based on `main` at `59948d8e5b84f980954473cc54ef6b0e49673f59` and the reviewed rollback recovery head `c1a9ba15ddb37a946e8675645fffceedb6053740`. The dedicated WIP branch is `recovery/workerd-child-supervisor`. Its code inherits the reviewed legacy-baseline rollback implementation and existing qualification/review evidence; no prior receipt or log was changed.

The unqualified patch adds a Linux test-only Python subreaper for Wrangler's isolated process group. It terminates only that owned group, escalates after one second, and waits for adopted children. Regression coverage exercises normal completion, timeout/escalation, nonzero exit, spawn error, and an unrelated process that must remain alive. Existing Wrangler-backed Worker fixtures use the helper. Descendants must remain in Wrangler's owned session; escaped daemonizing children are outside its current scope.

## Runtime gate and current process state

No runtime tests were run for this patch. The saved environment reports `pids.current=1086`, above its 1,000-process guard; cgroup `pids.max` is unlimited. It contains 117 pre-existing workerd zombies (PPID 1) and three live workerd processes. PID 1 is `tail -f /dev/null`, which does not reap adopted zombies. The patch cannot reap those old zombies. Memory was about 9.23 GB of the 16 GiB cgroup limit. Do not run probes or suites in this environment, signal unrelated processes, or alter PID 1.

The first allowed runtime checks, in a clean environment below the process guard with a reaping init, are:

1. `node --test tests/support/process-supervisor.test.mjs`
2. `node --input-type=module -e "import {verifySeoCliIsolation} from './tests/seo/cli-isolation.mjs'; await verifySeoCliIsolation();"`
3. Confirm the run adds no workerd zombies and leaves no live processes from its owned groups; inspect each test receipt/PID assertion.
4. If those checks pass, run affected callers serially: `node --test --test-concurrency=1 tests/monitoring-worker/batch.test.mjs tests/settings-worker/receipts.test.mjs tests/seo/build.test.mjs tests/release/local.test.mjs tests/release/cli-recovery.test.mjs`.

Do not run a full release qualification until the focused checks pass and a safe process baseline is established. The current tools expose waiting for an already-starting environment, but no environment restart/recovery control; no environment was started.

## Owner-observed staging evidence and remaining baseline work

The owner supplied a browser screenshot of `/api/runtime/status` for `staging.agenticbible.si`. It reports `releaseCommit=b41a422881921638833f92b2361a70eb1647d01f`, `releaseVerified=false`, `releaseManifestVerified=true`, and verification mode `compiled-worker-manifest-binding`. It also reports admin verifier configured, admin approvals not configured, and public intake, GitHub proposals, hosted canonical writes, and local fixture identity disabled. This is owner-observed runtime content only: it is not an independently fetched response, HTTP status/header capture, or byte digest. It shows JSON was available in the browser; it does not qualify a source candidate or attest a deployment.

The remaining candidate baseline is exact-source qualification in a safe saved environment, retaining immutable per-stage logs/resource records and the completed candidate inventory/digests, followed by independent review of those exact bytes. A minimal staging checklist still needs the exact approved candidate/source and independent pins, expected-active/version preflight, scoped resource/binding inventory, post-release served-byte/noindex/runtime checks, durable receipts, and retained-version rollback evidence. Admin approval setup and hosted writes remain closed; the screenshot does not satisfy those prerequisites.

Historical handoffs and qualification failures remain available unchanged for provenance. This file is the current process-lifecycle and staging-evidence handoff; prior checkpoint-specific commands are not instructions for this recovery branch.
