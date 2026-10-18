# Non-deploying integration candidate evidence

Prepared 2026-10-16 on `feat/local-integration-candidate`. The original remote checkpoint is `fd9b38874e40bd4fabcc7b57122dc20641a7002b`, with successful CI 38944375116. PR #9 was first verified locally at 56f8f4df35a96064216ed78e8ce351c1f35cff3f; a later documentation-only commit records the separately authorized draft publication. Final published head, CI and PR outcome are recorded in the handoff; old-checkpoint CI is not substituted for final-head validation. This is a review/test candidate, not release approval or deployment. Existing PR heads remain immutable.

## Exact provenance

| Source | Exact reviewed/source head | Candidate provenance |
|---|---|---|
| PR #7 settings/source stack | `2254699fe4828f6ad11724a7f10c75e899609506` | Branch base and ancestor; includes PR #5 `9ac36c2e11dd8fb2316ddecb1e497cafafdfbd9a` and earlier application stack |
| Accepted PR #4 recovery | `3d98ef75679d855b1ffb5608014ccdf0c0c94669` | `b85aafa089f0475f920fad4417c856df52fab532`, `cherry-pick -x` |
| Accepted PR #6 interruptions/clear-only | `c61c576bf5455b20b01e1449330a85fe37386f45` | `29af0f2fd0f6b97ab77783b98470442714e65aed`, `cherry-pick -x` |
| Independently accepted PR #8 batch replay | `47885169b71b352c9425dc3b3aa269322ac549ae` | `ecb9ad75b9491bb3402cc036efa6efd0ea4b6a28`, `cherry-pick -x` |
| Independently accepted PR #9 no-op settings receipts | `a72b8f8c3d772618cf279035be4c19c8103d4198` | Source `45d989d` → `2d8fa5b5dc6483afed89484b1587cadc8fddd128`; `2cb7ed3` → `41e489413ddbf23cab8120405d63e69a3d2e25eb`; `a72b8f8` → `bd97075240ca0b466576fd672a76743fe96e116a`, all local `-x` |

PR #4/#6 source ancestry diverged from PR #7 at PR #3 `efa15e6fc47931951ea7d617c4a567850435f939`; PR #8 is one commit directly on PR #5. PR #9 contains three commits directly above PR #7. Source SHA trailers preserve every applied origin. Package script and CI command-list conflicts on PR #8/#9 inclusion retained all suites. No reviewed runtime code was altered to resolve conflicts.

Diff checks confirm contribution client/flow tests equal PR #6; monitoring runtime/unit/batch-browser/Worker tests and receipt migration equal PR #8; settings runtime/unit/new receipt-browser/Worker tests and migration equal PR #9. Editorial Worker/views/CSS/local config, lockfile and static staging config equal PR #7. Additional candidate changes are integration tests/harness/CI, docs and explicit document-load waits in existing settings/journey browser tests. PR #9 preserves the same order-agnostic concurrency assertion already used in the candidate. Its package/CI conflicts were resolved by retaining every existing suite and adding the settings Worker suite; runtime source required no conflict edits.

Observed upstream main was `2ad330e06fcc4dd46a8fc95291ccc3cd1c597327`, containing foundation/reading PR #1/#2 merges performed upstream. It was fetched read-only, never merged or rebased into this candidate. The integration draft targets PR #7's branch to keep the combination independently reviewable. No main merge or source-head mutation occurred here.

## Combined checks at the original remote checkpoint

| Check | Observed result |
|---|---|
| `npm run validate` | Passed; zero diagnostics across 49 files, 12 static pages, eight-source catalog/three Pagefind entries, 4 static + 9 editorial server + 23 monitoring + 11 settings + 2 populated-upgrade tests |
| `npm run test:editorial:browser -- --workers=1 --timeout=90000` | 20 actual Worker/local-D1 tests passed in 36.3s, including all recovery, replay, security, privacy and budget cases |
| `npm run test:integration:browser -- --workers=1 --timeout=90000` | One complete combined journey passed in 11.3s |
| `npm run test:browser -- --workers=1 --timeout=90000` | 16 desktop/mobile reading/search/accessibility/static-safeguard checks passed in 29.7s |
| `npm run test:monitoring:worker` | Passed in 16.9s: actual Worker restart, failed completion after committed work, exact replay, capacity/expiry protection and fixture-session revocation |
| `npm run staging:check` | Dry run passed; 53 assets, no bindings, no deployment |
| Interactive local upgrade | Added receipt migration, three statements; all 14 existing application-table row counts and hashes unchanged; new receipt table empty; foreign-key/integrity checks passed |
| `npm run editorial:migrate` repeated | No migrations to apply; no reset/re-execution |

The combined journey commits a correction then loses its response, edits/reloads and explicitly recovers the draft, saves a distinct intended record, tags/disposes it with audit, runs baseline/change fixture publication with post-publication flags, saves independent Clarity/privacy settings, inspects inert public policy/no outside requests and private-page exclusion, verifies schedule/process exact replay without advancing state, then resets its fixture settings and signs out. Mobile overflow and partial axe A/AA pass. It runs in its own `.git/integration-browser-state`; editorial and Worker suites have distinct disposable directories. Interactive `.wrangler/editorial` is preserved.

An initial journey invocation used stale pre-combination built assets and failed the original article-selection behavior; rebuilding the exact candidate resolved it. A combined validation exposed a test-only ordering assumption for concurrent identical settings requests; the assertion was corrected to verify unordered save/duplicate outcomes. Initial push CI at ecd4ec9 passed validation/staging/reading, then exposed a test timing race: immediate `page.reload()` after a native settings save collided with the redirect document swap (`Not attached to an active page`). Settings and integration forms now register the next `domcontentloaded` event before clicking and await it before subsequent actions. This replaces timing assumptions without sleeps/retries or application changes. Final-head CI results are recorded in the handoff/PR rather than substituting that earlier failed run.

## Migration upgrade evidence

The independently added `0003_measurement_settings.sql` and `0003_monitor_batch_commands.sql` retain their full source filenames. Wrangler tracks full filenames, accepts both on a fresh disposable database and applied only the missing receipt file to the existing populated PR #7 local database. No applied migration was renamed, overwritten or replayed.

Two integration SQLite tests cover both histories: populated editorial → source/publication → settings → receipt schema with database reopen; and populated PR #8 source/receipt schema → settings, preserving the exact receipt result and replay protection after reopen. They retain submission/tag/audit/session/rate rows and source jobs/reservations/events/revisions/actions, validate default denied/off settings, resume each subsystem and check foreign keys/integrity. The real local upgrade compared SHA-256 digests and counts of all prior rows before/after without logging row values or modifying prior data. Supplementary counts/hash evidence is `.git/integration-migration-result.json`.

## Independent review and remaining gates

- [PR #4 exact-head review](editorial-draft-recovery-independent.md)
- [PR #6 exact-head review](editorial-interruption-independent.md)
- [PR #8 exact-head review and command/environment detail](monitor-batch-replay-independent.md)
- [Remaining MVP and release gaps](../integration-mvp-gaps.md)

The candidate still requires independent integration acceptance and the pending release approval. Production identity, public-intake terms/licenses/privacy, real article publisher/live transport, numeric paid-provider budgets, secure credential setup, measurement/consent/retention/CSP, remaining MVP articles, SEO ownership/submission, delivery and production operational/rollback evidence remain incomplete. All provider collection/ads/live fetching/cron/paid calls stay off. No persistent access, secret, license choice, remote database/resource, ad account, merge or deployment was created.

The PR #7 no-op receipt P2 is resolved locally by independently accepted PR #9. [Exact review and bounded guarantees](settings-receipts-independent.md) distinguish this acceptance from the still-pending full integration/release approval. No-op receipt snapshots remain private and cannot restore stale public settings or grant consent. The follow-up was completed locally while publication was stopped. Draft publication is now separately authorized; its actual result is recorded in the handoff without granting release approval.

## Local PR #9 follow-up verification

The previous no-op receipt P2 is independently accepted as fixed at PR #9 head `a72b8f8c3d772618cf279035be4c19c8103d4198` and integrated locally. No source PR head is changed. All application checks below ran locally at 56f8f4df35a96064216ed78e8ce351c1f35cff3f before the authorized draft publication; later publication-status edits affect documentation only. Exact final-head remote CI is recorded separately in the handoff. The earlier remote `fd9b388` CI success is not substituted for final-head validation; exact PR #9 CI 38947395513 is separate source-review evidence.

| Combined local check | Result |
|---|---|
| `npm run validate`, followed by current type/upgrade checks | Zero diagnostics in 51 files; 4 static + 9 server + 23 monitoring + 19 settings + 3 populated-upgrade tests passed |
| Reading/search browser suite | 16 passed in 26.9s, desktop/mobile, partial axe and privacy/static safeguards |
| Combined editorial/monitor/settings browser suite | 22 passed in 35.9s, including actual lost no-op response and concurrent conflicting payloads |
| Full integration journey | Passed in 10.5s, now also verifies an old no-op privacy response cannot mutate current settings or restore the current public template |
| Monitoring Worker restart/failure/retention suite | Passed in 17.6s |
| Settings Worker restart/fault/retention suite | Passed in 22.8s, including exact no-op restart replay, rollback, 128-row capacity/expiry and revoked session |
| Static dry run | 53 assets, no bindings/deployment |
| Actual local migration 0004 | Three statements applied; hashes/counts of all 15 prior application tables unchanged, new settings-receipt table empty, foreign keys/integrity passed |
| Migration reapply | No work; no table reset or migration rename |

The upgrade tests seed historical changed settings/audit rows before invoking the receipt-aware app, then apply both distinct `0003` files followed by `0004`. They preserve legacy change keys and monitoring receipts, verify independent no-op/batch replay after later writes/reopen, reject changed no-op reuse and confirm full database integrity. A settings-first and a monitoring-first history are both covered. Local row-hash evidence is `.git/integration-pr9-migration-result.json`; suite logs are `.git/pr9-combined-*.log` and `.git/integration-pr9-validate.log`.

Independent source acceptance closes the bounded P2, while exact combined integration acceptance, publication authorization and release approval remain pending. The local checks above do not themselves establish a published PR or new-head remote CI; those outcomes must be recorded separately. No deployment, paid call, live provider setup or persistent access is claimed.

Rollback this candidate's code/config to the prior reviewed stack. Preserve/export local SQLite before any deliberate schema rollback; additive tables can remain unused by older code. Never delete `.wrangler/editorial`, rename applied migration files or treat test-directory resets as a backup/restore plan. No remote resource rollback is needed because none was changed.
