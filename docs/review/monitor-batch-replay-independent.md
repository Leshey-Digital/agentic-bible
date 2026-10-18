# Independent PR #8 review

2026-10-16: **ACCEPT** the bounded monitoring batch replay fix at `47885169b71b352c9425dc3b3aa269322ac549ae`, based directly on PR #5 `9ac36c2e11dd8fb2316ddecb1e497cafafdfbd9a`. No blocking findings. [PR #8](https://github.com/Leshey-Digital/agentic-bible/pull/8) · [exact batch implementation](https://github.com/Leshey-Digital/agentic-bible/blob/47885169b71b352c9425dc3b3aa269322ac549ae/src/monitoring/batch.ts) · [exact-head CI success](https://github.com/Leshey-Digital/agentic-bible/actions/runs/38942309406).

The fix persists action fingerprints, freezes schedule keys/due-job IDs before side effects and checkpoints publication candidate IDs before publishing. Atomic attempt-ordinal checks prevent retrying an already charged attempt. Leased ownership and fenced checkpoint/result updates protect concurrent/stale owners. Completed requests return the saved byte-identical JSON rather than selecting another batch or recomputing a later state. UUID case is normalized; cross-action reuse and unsupported business fields are rejected.

The policy is explicitly bounded: 24-hour retry protection, 128 receipts, 128 KiB result, 30-second renewed command leases. Capacity cannot evict an unexpired protected key; expired inactive receipts alone free space. Failed/interrupted work remains charged. Resuming the old command may leave retries for a deliberate new command instead of expanding the frozen pass. After the documented retry window, an expired/removed key can execute again. These local fixture limits do not authorize currency spend, live fetching or production retention.

Independent evidence at the exact head:

| Check | Result |
|---|---|
| Locked `npm ci`, Node 24.19.0 / npm 11.9.0 | Passed, 310 packages |
| `npm run test:docs`; `npm run check`; `npm run build`; `npm test` with absolute npm cache override | 33 Markdown files / 32 links; 42 checked files with zero diagnostics; 12 pages / 3 search entries; 4 static tests passed |
| `node --test tests/editorial/*.test.ts tests/monitoring/*.test.ts` | 32 passed: 9 editorial and 23 monitoring/SQLite |
| Playwright exact editorial suite, one worker, 90-second timeout | 10 passed in 21.0s, including actual committed response loss, exact schedule/process replay and concurrent process budget checks |
| `node --test tests/monitoring-worker/*.test.mjs` | Passed in 21.6s: real Worker stop/restart, failed completion after work commits, exact replay/no additional reservations, 128-receipt pressure, expiry resumption and revoked fixture session |
| Playwright reading suite, one worker, 90-second timeout | 16 passed in 30.5s, desktop/mobile, partial axe/overflow and static safeguards |
| Wrangler static staging dry run | 53 assets, no bindings, no deployment |
| Exact detached head, clean tracked status, whitespace | Passed |

The SQLite cases additionally cover partial database-reopen recovery, stale owner fencing/checkpoint handoff, frozen publication selection, capacity/window boundaries and oversized results. Existing daily/attempt/byte caps, fixture transport and remote fail-closed authentication remain unchanged. No extra provider, framework or credential is installed.

Review worktree: `/workspace/agentic-bible-monitor-replay-review`, clean at the exact SHA. Its `.git` is a file; to run unchanged scripts expecting a directory, a disposable cwd mirror `/workspace/agentic-bible/.git/pr8-review-run` symlinks the exact worktree's source/tests/migrations/dist/scripts/configs/dependencies and has its own writable `.git` directory. Playwright overlays change only cwd, absolute test/report paths and the static preview command; original application/test/harness source stays untouched. Actual Worker tests execute unchanged from that mirror. No interactive state is reset.

Commands from the mirror: `node --test tests/editorial/*.test.ts tests/monitoring/*.test.ts`; `node node_modules/@playwright/test/cli.js test --config editorial.config.ts --workers=1 --timeout=90000`; `node --test tests/monitoring-worker/*.test.mjs`; the same Playwright CLI with `reading.config.ts`; Wrangler `deploy --dry-run --config wrangler.staging.jsonc` with isolated XDG config/cache and metrics disabled. Build/type/docs/static commands run in the exact review worktree with `npm --cache /workspace/agentic-bible/.git/review-npm-cache ...`.

Supplementary logs are `.git/pr8-review-unit.log`, `pr8-review-browser.log`, `pr8-review-worker.log` and `pr8-review-reading.log`. The durable acceptance and linked CI above do not depend on those local logs. This review authorizes inclusion in the requested non-deploying integration candidate only; it does not merge a PR, deploy, enable production access/tracking, or bypass release approval.
