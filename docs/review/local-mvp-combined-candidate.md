# Local combined verification checkpoint

Branch `feat/local-mvp-combined-candidate` is isolated from all preserved source branches. Exact ancestry, conflict resolution, test-only orchestration, missing trusted bridge, production gaps and rollback are in the [combined contract](../local-mvp-combined-candidate.md). Source review status includes PR13 full documentation review still pending. Neither full source-commit nor combined candidate acceptance is inferred from accepted source/test rechecks or green CI.

## Exact provenance and changes

- Base PR10: `d0bfca47cd221b970b01ace838afb3f3bb9a5d32`.
- HTTP PR12: `b78751b4f4db09fcce4289052f7e163ac4be9c5b`, retaining Node checkpoint `e237f02912a71b812bc36cf8f628d9144b4b62a4`.
- Publisher PR11: `efeffed9467a9fa67125725d923d6d672cfd9555`; topic fix PR13: `d57e975253ba6d9ba3e48a2292611cfca14aa118`.
- Source merge: `1a1c6a878412672aa431b9f77b0f028bfb4b0483`, exact parents PR12/PR13, merge base PR10. All four source heads are ancestors and remain unchanged remotely.
- The final candidate head/CI is recorded in its handoff and draft PR; code is not accepted merely because it is combined.

Three merge conflicts involved only instructions, README and package commands; both source sections and every original test script were retained. The candidate adds a combined browser test/config, one CI step, expanded type-check coverage and this evidence/change documentation. An unused import in the original publication test was removed after expanded checking reported a hint. Actual HTTP and publisher runtime implementations match their reviewed heads byte-for-byte. Existing app/editorial/settings/fixture runtime, original Markdown, six migration files (including both 0003 names), shared styles, deployment configs and dependency lockfile are unchanged.

## Passed local checks

Pinned Node 24.19.0/npm 11.9.0 and existing dependencies/system Chromium; no framework or package was installed.

| Check | Observed result |
|---|---|
| `npm run validate` | Build/Pagefind, docs and **84 tests** passed: 4 static, 9 editorial, 23 monitoring, 19 settings, 3 populated upgrades, 13 Node HTTP, 1 real local workerd/D1 HTTP and 12 publication. Initial expanded type checking found one unused test import; it was removed, then the final check below passed. |
| Final `npm run check` | **71 files, zero errors/warnings/hints**, including publisher and combined test folders. |
| `npm run test:combined:browser` | **1 passed**: controlled native Worker fetch/D1, restart/conditional/cache/replay, independent supplied article validation/render/search/history/flags, publication reopen/replay/rollback, collector failure/last-good preservation and no automatic bridge. |
| `npm run test:publication:browser` | **1 passed**, actual HTML/Pagefind/history/flags/rollback with desktop/mobile accessibility and no external requests/runtime errors. |
| `npm run test:editorial:browser -- --workers=1 --timeout=90000` | **22 passed** against real local Worker/D1. |
| `npm run test:integration:browser -- --workers=1 --timeout=90000` | **1 passed**, existing cross-feature journey. |
| `npm run test:monitoring:worker` | **1 passed**, actual Worker/D1 restart/fault/receipt/capacity checks. |
| `npm run test:settings:worker` | **1 passed**, actual Worker/D1 restart/fault/capacity/expiry checks. |
| `npm run test:browser -- --workers=1 --timeout=90000` | **16 passed**, reading/search/mobile/accessibility and no outside requests. |
| `npm run staging:check` | Dry-run passed: **53 assets, no bindings**, no deployment. |
| Final documentation/whitespace | Passed `npm run test:docs` and `git diff --check`. |

Browser/Worker suites ran sequentially after the build. HTTP and publication unit suites retain timeout/oversize/redirect/304, parallel reservations, stale completion, SQL rollback, atomic activation, actual SIGKILL/recovery and bounded replay/rollback coverage. Both real local D1 and populated SQLite upgrade tests preserve prior state. No new schema beyond PR12 is introduced.

The saved interactive `.wrangler/editorial` tree was checked by file hash before/after the remaining suites: **21 files, every hash unchanged**. No default interactive migration or reset was performed. Runtime logs and private file-hash inventory remain ignored in the actual Git directory (`combined-*.log`/JSON); none of that database/session content is committed. Existing dependencies and a temporary worktree metadata/dependency link supported legacy .git-relative scripts; those links are removed/restored after checks.

## Meaning of the combined journey

[Actual example evidence](combined-journey-evidence.json) contains controlled source hashes and separately supplied event receipts only. Five real local Worker fetch dispatches produced five durable reservations, including baseline, conditional 304s, a changed observation and a rejected redirect. Collected bytes were synthetic and never became article text. Collector activity produced no publisher activation or fixture candidate. Independently supplied valid fixture events produced revisions at sequences one/two; malformed array topic rejected before publication. Publication rollback created operation three with earlier text/search and retained history/receipts, without rewinding the collector. Replays after restart/reopen performed no extra fetch/publication and did not undo newer state.

This is test orchestration, with `automaticBridge:false`, not an implemented trusted cross-store adapter or source-to-generated article system. The bridge still needs authenticated source/content provenance, durable outbox/receipt acknowledgment, factual/content/rights validation and safe cross-store failure recovery. The publisher remains an isolated supplied-fixture collection and does not update canonical Markdown/global search/live releases.

## Remaining gates and limitations

- PR13's independent full documentation/commit review remains pending when prepared, as does independent exact-head review of this combined candidate. Source patch acceptance is recorded separately from full-commit/candidate acceptance.
- Workers native fetch relies on platform DNS/TLS, with no Node-equivalent DNS pin/peer check. Real official-page connectivity/content sizes/validators remain unverified after the earlier bounded reads failed before an upstream response. No new live probe was made.
- HTTP request/day/concurrency limits and fixture storage bounds are not currency/infrastructure billing enforcement. Paid jobs/providers, live cron, public intake, credentials, tracking and ads stay disabled.
- Known nonblocking HTTP P3 remains: expired budget-blocked jobs can misleadingly report in progress; no extra requests are dispatched. No runtime change was made to hide or fix it in this candidate.
- Production identity/admin dispositions, factual/source/license/PII safeguards, canonical full-site artifact integration, trusted remote distribution/release/restore, cross-host locking and numeric spending controls remain absent.

No unresolved test failure remains. Qualified draft publication is authorized for review; no main merge, release acceptance, deployment, remote resource/migration, live schedule or paid call is implied. Rollback is described in the contract. Preserve interactive data and exact source heads.
