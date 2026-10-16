# Measurement settings slice evidence

Prepared 2026-10-16 on `feat/admin-measurement-settings`, based on immutable PR #5 at `9ac36c2e11dd8fb2316ddecb1e497cafafdfbd9a`. The draft PR/handoff records the exact pushed head and CI run. No merge or deployment.

## Observed checks

| Check | Result |
|---|---|
| `npm run validate` | Passed: 45 checked files with zero diagnostics, 12 static pages, eight-source catalog, three search entries, four static tests, nine editorial server tests, 15 monitoring tests and 11 settings tests |
| `npm run test:editorial:browser -- --workers=1 --timeout=90000` | 12 passed in 23.5s against actual local Worker/D1, including four new settings cases |
| `npm run test:browser -- --workers=1 --timeout=90000` | 16 passed in 27.1s, desktop/mobile reading/search, headers, no outside requests, partial axe and viewport checks |
| `npm run staging:check` | Dry run passed: 53 static assets, no bindings, no deployment |
| `npm run editorial:migrate` | Additive 0003 applied locally: five statements, existing data retained |
| Real Worker stop/restart | Saved Google fixture settings and audit survived. Existing full source state (two jobs) and inbox (one item) matched before/after. Original settings restored and temporary fixture session revoked |
| UI review | Desktop/mobile screenshots inspected; settings, recovery, status, audit, partial axe A/AA and overflow checks passed |
| Isolation | Monitoring command routes/store, contribution script/flow tests, lockfile and static staging config remain equal to PR #5 base |

The initial browser run exposed a real conditional-cache defect: after enabling the policy preview, a reload could reuse the earlier static ETag response without the new template. Eligible local documents now strip conditional asset headers and return private/no-store even while off. A new unit regression and the existing real-browser toggle/reload case pass with the fix. An earlier TypeScript test-header typing issue and Node strip-only constructor syntax issue were corrected before the final checks. No failed application checks remain.

## Coverage and boundaries

Settings tests cover strict identifiers/types/allowlists, unknown fields and credentials/scripts/URLs, denied consent and locked ads, independent per-section writes, concurrent CAS/replay, atomic rollback, 1,000-event capacity, bounded audit, database reopen, production/remote fail-closed behavior, role/origin/CSRF, non-reflecting errors, public exclusions and missing/corrupt storage.

Actual Worker/D1 browser tests verify independent form saves and persisted reloads; rejection and stale-form preservation; concurrent duplicate and distinct section updates; audit counts; default omitted IDs; an enabled inert public template; no outside network/provider scripts; private/admin/form/search/query/error/DNT/GPC exclusions; and unavailable secret/collection status. The preview is not Google/Clarity collection. No live provider installation, consent UI or key vault exists.

- [Desktop dashboard](measurement-settings-desktop.png)
- [Mobile dashboard](measurement-settings-mobile.png)
- [Exact independent PR #4 acceptance and commands](editorial-draft-recovery-independent.md)
- [Settings HTTP/storage/rendering contracts](../measurement-settings-contracts.md)

## Handoff and remaining work

Run `npm run build`, `npm run editorial:migrate`, `npm run editorial:local`, then open `http://127.0.0.1:8788/admin/settings/` with the existing local editor fixture. Use synthetic IDs only. Interactive state is `.wrangler/editorial`; automated tests reset only `.git/editorial-browser-state`. Saved IDs are non-secret configuration, not verified ownership or working analytics. Metrics remain unavailable, not measured zero. The local reading Worker alone gains routing for its inert preview; static staging stays unchanged.

The independently discovered PR #5 schedule/process command-replay P2 is being fixed separately; this branch leaves all monitoring command code untouched. PR #4/PR #6 contribution fixes also remain separate for parent integration. Independent review and those upstream fixes are integration gates, not implemented here.

Live collection still needs reviewed production identity, provider ownership, privacy notice/retention/masking, consent and revocation, CSP and actual provider adapters. Provider credentials require separately implemented/reviewed server-side write-only setup, scoped connection tests and enforceable numeric budgets. Advertising stays locked off. No actual IDs, credentials, paid inference, cron, remote database, ad account, new access or competing frameworks were introduced.

Rollback code/config by reverting this slice. Migration creates separate settings/audit tables; existing editorial and source tables are untouched. Preserve local data; do not delete the interactive state directory.
