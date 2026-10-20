# Wrangler child supervisor runtime check

Date: 2026-10-20 UTC

Source: `recovery/workerd-child-supervisor` at `6092c88e31f4bd7516b942be56eebd5503afb329`, plus the test-cleanup correction in this change.

## Environment

- The fresh namespace started with 12 processes, one pre-existing zombie, and about 16 GiB available memory. Its PID 1 is `tail -f /dev/null`, which does not reap adopted children. The cgroup process limit is unlimited; the repository's separate 1,000-process safeguard was not changed.
- The checkout initially had no installed npm dependencies. `npm ci` installed the exact lockfile dependencies (310 packages) without changing the lockfile.
- No staging or production request was made.

## Results

- `node --test tests/support/process-supervisor.test.mjs`: passed, 1/1. It exercised normal completion, timeout/escalation, nonzero exit, spawn error, and an unrelated live sentinel. It recorded and verified absence of both PIDs in each supervised child subtree.
- `node --input-type=module -e "import {verifySeoCliIsolation} from './tests/seo/cli-isolation.mjs'; await verifySeoCliIsolation();"`: passed against real local Wrangler/Workers static assets after dependencies were installed.
- `npm run build`: passed; Astro built 31 routes and Pagefind indexed 20 article pages.
- After the build, `node --test --test-concurrency=1 tests/monitoring-worker/batch.test.mjs tests/settings-worker/receipts.test.mjs tests/seo/build.test.mjs tests/release/local.test.mjs tests/release/cli-recovery.test.mjs`: passed 21/21 in 119.2 seconds. The first attempt before the required build failed because `dist` was absent and local Workers were not ready; it was rerun after building.
- Independent code review found the supervisor's process-group ownership model sound for descendants that remain in Wrangler's session, and confirmed the test cleanup correction.
- No workerd process or workerd zombie was present in post-run checks. There were no live supervised processes after the tests.

## Process-residue gate

The namespace ended at 59 processes and 47 zombies, compared with 12 processes and one pre-existing zombie at the start. The new zombie command names were `git` and `esbuild`; none were `workerd`. PID 1 is not a reaper. The exact spawning parents/session membership of these zombies was not captured, so the independent review could not establish whether they were outside the supervisor's owned groups. This fails the broader no-accumulation gate despite passing the no-workerd-zombie check.

Do not run the full exact-source qualification in this runtime until the residue origin is established or a clean runtime with a reaping init is available. No full qualification receipt was created and no existing receipt inventory was changed. Staging qualification, baseline evidence, deployment, rollback, and live serving checks remain pending.
