# Settings no-op receipt verification

Change: [proposal](../../openspec/changes/settings-noop-receipts/proposal.md), based on immutable PR #7 `2254699fe4828f6ad11724a7f10c75e899609506`. This is implementation evidence, not independent acceptance or release approval.

The original defect was reproduced on PR #7: an unchanged save returned 200 without binding its request reference; changed reuse saved successfully and an identical retry after another edit returned stale. The repair stores bounded no-op receipts separately from changed-write history. [Contracts](../measurement-settings-contracts.md) define the retention and migration behavior.

Checks on the fix branch, 2026-10-16:

- `npm run validate`: documentation links, Astro/TypeScript (zero errors/warnings/hints), static build/Pagefind, four static checks, nine editorial server tests, 15 monitoring tests and 19 settings tests passed.
- `npm run test:editorial:browser`: all 14 actual local Worker/D1 browser checks passed, including desktop/mobile axe and overflow, authorization/origin/CSRF, privacy exclusions, lost committed no-op response, reload/later edit replay and conflicting concurrent payloads.
- `npm run test:browser`: all 16 reading/search checks passed, including desktop/mobile accessibility, real search, no-JavaScript fallbacks, headers and no external/runtime/CSP errors.
- `npm run test:settings:worker`: the real Worker/D1 restart/fault/retention suite passed. Cached responses survived restart exactly; later state, inbox and source records were preserved; full capacity rejected only new no-ops; an expired row freed one slot; old unexpired retries stayed exact. Failed receipt creation left no claim or changes; failed settings updates rolled back both settings and audit; the same reference retried once after removing the fault. Invalid synthetic secret was absent from errors and runtime logs; logout revoked access.
- `npm run staging:check`: dry run passed, 53 static files, no bindings. No deployment was performed.
- A search of `dist` found none of the receipt fixture IDs, rejected synthetic secret, receipt table name, local-editor identity or X-CSRF marker.

An initial concurrent launch of the two Playwright suites collided in their shared artifact directory (`ENOENT` during context close) and hit a reading accessibility timeout while overlapping. Both runs were interrupted and rerun sequentially with unchanged app code and timeouts; README now documents this requirement. The clean sequential results are the evidence above.

The first CI run exposed an existing test assumption that the first of two identical concurrent writes must win. It correctly produced one `saved` and one `duplicate` in the opposite order, with no application failure. The assertion now checks that exact pair without imposing a winner; the existing single-audit and revision assertions remain. No application code changed for this correction.

The standalone Worker harness checks that port 8788 is free before resetting its own state or starting/restarting. It refuses an existing local listener, preventing accidental requests to an interactive preview. It still resets only its own disposable directory.

Migration provenance: this branch adds only `0004_measurement_request_receipts.sql`, after PR #7's `0003_measurement_settings.sql`. Independently owned PR #8 `0003_monitor_batch_commands.sql` is neither imported nor renamed. Both distinct `0003` files precede `0004` in integration. No old table is rewritten or deleted. Legacy settings/audit migration/reopen coverage confirms prior replay keys remain valid.

Limits: 128 receipts, 32 KiB UTF-8 response each, fixed 24-hour window, no supported-retry eviction. Historical allowed IDs may remain privately retained until expiry. Current GET state/public policy always read current settings. Identity, public intake/terms, secret integration setup, live tracking/ads, paid work and enforceable currency budgets remain unavailable. No remote resource or binding is created. Preserve a local DB copy before rollback; prior app can ignore the additive table.
