# Editorial slice evidence

Branch `feat/editorial-inbox`, stacked on immutable PR #2 head `9a24bb5a14d534205295c7f60912aacc254456b7`. Exact pushed feature commit is in the draft PR/final handoff. No merge or deployment is part of this slice.

## Results (2026-10-16)

| Check | Observed result |
|---|---|
| `npm run validate` | Passed: zero diagnostics across 29 checked files, 12 static pages, three Pagefind entries, four static tests and nine server/SQLite tests |
| `npm run test:browser` | 16 passed in 16.8s, desktop/mobile; includes public static intake disabled and admin route absent |
| `npm run test:editorial:browser` | Five passed in 11.4s against actual Worker/local D1; screenshots captured from successful flow |
| Local migration | 0001 applied successfully to local D1; nine schema statements; no remote database |
| Actual Worker restart | Saved a synthetic suggestion, stopped the Worker, restarted it against the same local state, signed in through a temporary local fixture session, and read the same reference/version/audit; temporary session then revoked |
| Staging dry run | Passed against unchanged static config; 52 asset files, no bindings or deployment |
| Dependency audit / whitespace | Zero reported vulnerabilities; diff whitespace check passed; no added dependencies or lockfile changes |
| PR #2 isolation | Remote branch remained at 9a24bb5; static staging config and lockfile match that base exactly |
| Remote identity, public intake, email, production D1, paid inference | Not enabled, provisioned or claimed |

Server checks cover invalid/plain-text/URL/body validation, capacity, deduplication, key-reuse conflicts, five-per-window rate controls, transactional rollback, stale writes with no phantom audit, pagination, storage reopen, session expiry/revocation, reader/anonymous/tampered access denial, remote fail-closed routing and CSRF.

The browser suite proves a correction survives page reload, saves to D1, appears in the admin inbox, receives tags and a follow-up disposition, and retains the change/audit through refresh. It also tests network interruption with draft recovery, two simultaneous duplicate POSTs, malicious intake rejection, unauthorized access, cookie replay after logout, missing CSRF, stale API and native-form edits with entered tags retained, empty inbox state and rate exhaustion. Mobile form/review and desktop inbox/sign-in/empty states passed partial automated axe A/AA checks. The reading/search suite remains intact.

## Screenshots

- [Mobile correction form](editorial-form-mobile.png)
- [Mobile disposition and audit](editorial-detail-mobile.png)
- [Desktop editorial inbox](editorial-inbox-desktop.png)

These contain only synthetic test content and local fixture identities. They were visually inspected. Successful browser tests create fresh screenshots under ignored `test-results`; selected captures are copied here. No raw cookie, key or persistent credential is in these artifacts.

## Integration handoff

See [HTTP/storage/authentication contracts](../editorial-contracts.md). New runtime code is under `src/editorial/`, schema under `migrations/`, the static form under `src/pages/contribute.astro` and its script, and styling under `public/editorial.css`. Local config is separate in `wrangler.editorial.local.jsonc`.

Shared reader changes are limited to the article correction link and accurate about/status copy. Package scripts, TypeScript inclusion and validation-only CI add the new checks. The existing staging configuration and dependency lockfile are untouched. No empty admin/settings pages were introduced.

Run `npm run editorial:migrate`, then `npm run editorial:local`; use only `http://127.0.0.1:8788`. Interactive data is under `.wrangler/editorial`. Automated editorial tests use a separate resettable `.git/editorial-browser-state`. Stop the interactive preview before running the editorial browser suite on the same port.

Remaining gates: independent review, verified production identity and admin membership, production Secure sessions, specific binding/migration/release review, code/content terms, public abuse/privacy/retention/capacity policy and secure provider setup. Automatic article publishing with post-publication human review flags remains approved direction; this suggestion queue does not become a universal human prepublication gate. API-vault/analytics settings, email delivery and article publication are not implemented here. No paid inference or real persistent credential was used.
