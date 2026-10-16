# Non-deploying integration candidate evidence

Prepared 2026-10-16 on `feat/local-integration-candidate`. Final exact head and exact-head CI are recorded in the integration draft PR/handoff. This is a review/test candidate, not release approval or a deployment. Existing PR heads remain immutable.

## Exact provenance

| Source | Exact reviewed/source head | Candidate provenance |
|---|---|---|
| PR #7 settings/source stack | `2254699fe4828f6ad11724a7f10c75e899609506` | Branch base and ancestor; includes PR #5 `9ac36c2e11dd8fb2316ddecb1e497cafafdfbd9a` and earlier application stack |
| Accepted PR #4 recovery | `3d98ef75679d855b1ffb5608014ccdf0c0c94669` | `b85aafa089f0475f920fad4417c856df52fab532`, `cherry-pick -x` |
| Accepted PR #6 interruptions/clear-only | `c61c576bf5455b20b01e1449330a85fe37386f45` | `29af0f2fd0f6b97ab77783b98470442714e65aed`, `cherry-pick -x` |
| Independently accepted PR #8 batch replay | `47885169b71b352c9425dc3b3aa269322ac549ae` | `ecb9ad75b9491bb3402cc036efa6efd0ea4b6a28`, `cherry-pick -x` |

PR #4/#6 source ancestry diverged from PR #7 at PR #3 `efa15e6fc47931951ea7d617c4a567850435f939`; PR #8 is one commit directly on PR #5. Source SHA trailers preserve the applied origin. Only the package script list and CI command list conflicted on PR #8 inclusion: resolution retained settings, integration and Worker-restart tests. No reviewed runtime code was altered to resolve conflicts.

Diff checks confirm contribution client/flow tests equal PR #6; monitoring runtime/unit/batch-browser/Worker tests and receipt migration equal PR #8; settings runtime/editorial Worker/views/CSS/local config, lockfile and static staging config equal PR #7. Additional candidate changes are integration tests/harness/CI, docs, one order-agnostic settings concurrency assertion and explicit document-load waits in settings/journey browser tests. The concurrency assertion requires exactly one save and one duplicate regardless of which identical request wins; runtime behavior is unchanged.

Observed upstream main was `2ad330e06fcc4dd46a8fc95291ccc3cd1c597327`, containing foundation/reading PR #1/#2 merges performed upstream. It was fetched read-only, never merged or rebased into this candidate. The integration draft targets PR #7's branch to keep the combination independently reviewable. No main merge or source-head mutation occurred here.

## Combined checks

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

Known P2 after independent PR #7 review: unchanged/no-op saves return without persisting a request-key receipt, allowing changed reuse and preventing exact no-op replay after a later save. A separate PR #7-based fix is pending. The integration candidate leaves the settings store/receipt schema untouched; passing existing tests does not close that untested guarantee. This checkpoint must not be called fully accepted until the fix is independently reviewed and integrated.

Rollback this candidate's code/config to the prior reviewed stack. Preserve/export local SQLite before any deliberate schema rollback; additive tables can remain unused by older code. Never delete `.wrangler/editorial`, rename applied migration files or treat test-directory resets as a backup/restore plan. No remote resource rollback is needed because none was changed.
