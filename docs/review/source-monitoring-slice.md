# Source-monitoring slice evidence

Branch `feat/source-monitoring`, based on immutable PR #3 at `efa15e6fc47931951ea7d617c4a567850435f939`. Exact pushed head is recorded in the draft PR and handoff. No merge, deployment, cron, model integration or outside HTTP source fetch is enabled.

## Observed checks (2026-10-16)

| Check | Result |
|---|---|
| Astro/TypeScript | Zero errors/warnings/hints across 39 checked files |
| Build/static checks | 12 HTML pages, generated eight-source metadata catalog, three Pagefind entries; four static tests passed |
| Editorial server/SQLite regression | Nine passed |
| `npm run test:monitoring` | Fifteen passed; deterministic HTTP mocks with persisted SQLite adapter state |
| Reading/search browser regression | 16 passed in 19.6s after restarting a stale local preview that returned 404 |
| Worker/local-D1 browser suite | Eight passed, including source-change → automatic local metadata publication → review flag → clear/revert/restore, authorization and concurrent daily-budget enforcement |
| Local migration | 0002 applied successfully, 12 statements; original editorial data preserved |
| Actual Worker restart | Source job, published metadata revision, review flag, head and action ledger persisted across stopping/restarting the Worker against interactive local D1; temporary fixture sessions revoked |
| Static staging dry run | Passed, 53 assets, no bindings/deployment |
| Dependency audit / diff | Zero reported vulnerabilities; no dependency/lockfile changes; whitespace check passed |
| Isolation | PR #3 remained at efa15e6; contribution script/browser-test file, both existing Wrangler configurations and lockfile match the base |

The server tests cover baseline/304/same hash, ETag and Last-Modified, changed/shared-source fan-out, deduplication and conflicting keys, bounded retries/timeouts/day reservations, interrupted leases and terminal attempt exhaustion, allowlist/redirect rejection, unsupported/malformed/oversized bodies, no global fetch, missing evidence, stale observations, rollback of ingestion/publication transactions, review/rollback/restore idempotency, pagination-sized work planning and database reopen with published state intact.

Actual local-D1 browser tests additionally send duplicate concurrent run requests and race two distinct sources at 19 reserved attempts: the count stops at 20, with the other job budget-blocked. Mobile/desktop source controls and queue passed partial automated axe A/AA checks and overflow checks. A source selection is preserved after a successful fixture check.

## Screenshots

- [Desktop source jobs and publication/review ledger](monitoring-desktop.png)
- [Mobile source controls and flagged local revision](monitoring-mobile.png)

These are inspected screenshots of the running local Worker, contain synthetic content only, and explicitly identify fixture observations/local metadata publication. No source body, cookie, key or private account identity is in the artifacts.

## Handoff

[Contracts and route/state definitions](../source-monitoring-contracts.md) document the exact limits and boundaries. New runtime code is `src/monitoring/`; catalog generation is `src/pages/source-catalog.json.ts`; schema is additive `migrations/0002_source_monitoring.sql`; tests are `tests/monitoring/` and a separate `tests/editorial-browser/monitor.spec.ts`.

Run `npm run build`, `npm run editorial:migrate`, then `npm run editorial:local`; open `http://127.0.0.1:8788/admin/sources/` with the local editor fixture. This automatically publishes only a local source-observation metadata ledger. Article text/public releases, actual source freshness, live cron/fetching, provider credentials, Jev/model calls and production identity are not implemented by this slice.

The separately reviewed PR #3 contribution-draft P2 fixes remain outside these changes, as directed. Parent coordinates their independent review/integration. Production release still needs those fixes, review, verified identity, actual provider/monetary budgets and a production publisher adapter. No permanent human-preapproval requirement was introduced.
