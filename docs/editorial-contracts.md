# Local editorial integration contract

Scope: the `feat/editorial-inbox` branch stacks on PR #2 at `9a24bb5a14d534205295c7f60912aacc254456b7`. PR #2 and the existing static staging configuration remain unchanged on their branches. This is a local synthetic-data implementation, not production authentication or public intake.

## Run it

Run `npm ci`, `npm run validate`, `npm run editorial:migrate`, then `npm run editorial:local`. Open `http://127.0.0.1:8788/contribute/` and `http://127.0.0.1:8788/admin/`. Use only synthetic text. The sign-in page explicitly offers local editor/admin and local reader fixtures; no real account/password is created. Sessions expire after 20 minutes and are revocable on sign-out.

Interactive SQLite/D1 state is under `.wrangler/editorial`, excluded from Git. Restarting `editorial:local` preserves it. Do not remove it to run tests. `npm run test:editorial:browser` starts its own Worker and migrated D1 in `.git/editorial-browser-state`, resetting only that isolated test directory. Port 8788 must be free for those tests.

The static reading/search preview still uses `npm run staging:local` on port 8787. Its `/contribute/` page remains disabled because no intake Worker is configured there. The new local configuration has no remote binding, account, routes, persistent secret or production deployment command. Its D1 UUID is a local placeholder, not a provisioned cloud resource.

## HTTP contract

| Method / path | Behavior |
|---|---|
| `GET /api/editorial/status` | Capability response; `publicIntake: false` always. Enables the form only on explicit loopback test mode with storage. |
| `POST /api/submissions` | Same-origin JSON `{requestKey, articleId, kind, message, sourceUrl, website}`. Returns 201 with opaque reference, 200 for duplicate/replay, 202 for honeypot, 4xx validation/rate/conflict, 503 storage/capacity/gate failure. No public receipt lookup. |
| `GET/POST /admin/sign-in/` | Local fixture selection only. Outside the exact local origin plus mode flag: 503, no identity granted. |
| `POST /admin/sign-out/` | Same origin and per-session CSRF token; revokes the stored session hash and clears the cookie. |
| `GET /admin/` | Admin-only server-rendered inbox. `status` filter: new/follow-up/resolved/dismissed. `before` comes only from the next-page link. |
| `GET/POST /admin/items/:id/` | Admin-only evidence, disposition, tags and audit page. Form writes require CSRF and expected revision. |
| `GET /api/admin/session` | Admin identity/role and CSRF value; never the raw session token. |
| `GET /api/admin/submissions[/:id]` | Admin-only JSON list or item/audit; list returns at most 20 entries with an opaque cursor. |
| `PATCH /api/admin/submissions/:id` | Same-origin JSON `{status, tags, version}`, plus `X-CSRF-Token`; 200 saved, 409 stale revision, 403 missing authorization/CSRF. `tags` is comma-separated text. |

Anonymous API callers receive 401; non-admin identities receive 403. Protected responses are `no-store`, non-indexable and frame-blocked. Unknown methods/routes do not expose records. Client-supplied role/identity headers confer no authority.

## Validation and persistence

The server accepts only known article IDs, correction/source kinds, 20–2,000 characters of plain text, bounded HTTPS URL text and a UUID request key. Source suggestions require a URL. HTML/executable markup and control characters are rejected. URLs reject credentials, custom ports, numeric/IP hosts and known local host suffixes; fragments are retained for claim-level context. This is syntactic validation, not DNS verification or a safety certification. **Submitted URLs are never fetched server-side.** All stored content is escaped in admin HTML.

The browser clears only the unchanged snapshot confirmed by a successful response. Edits or a new draft made while that request is pending are retained with their own reference and survive reloads; a retained article selection takes precedence over the original article-link default. After an uncertain response or request-reference conflict, **Keep draft with new reference** preserves the current fields and chooses a new reference without submitting automatically. Recovery availability and the chosen reference persist in this tab's session storage. An earlier version may already be stored; an unchanged retry remains replay-safe.

An unchanged retry after a committed response is lost returns the existing receipt without adding a record or audit event. Reloading before response delivery retains newer fields for explicit conflict recovery. If the reader clears without entering a replacement draft while an older save is pending, that completion leaves session storage cleared; reload and subsequent article links use their normal article defaults.

Requests are streamed with an 8 KiB ceiling. A honeypot discards bot payloads. An atomic SQLite window admits at most five new suggestions per client hash per ten minutes; a global local-test ceiling stops intake at 1,000 records. Duplicate keys/content return the existing reference; conflicting key reuse returns 409. These are local test controls, not approved paid-job budgets or complete public bot protection.

`migrations/0001_editorial.sql` owns submissions, audit records, hashed local sessions and expiring rate counters. `EditorialStore` in `src/editorial/contracts.ts` is the storage port; `D1EditorialStore` implements it using prepared bindings and transactional D1 batches. Submission plus initial audit, and disposition plus audit, are atomic. Updates match the expected version; a per-update event ID prevents stale writes from producing phantom audit entries. Lists are bounded to 20 and audit views to the most recent 30 events (older audit records remain stored). No message body is copied into audit events; no payload/cookie/SQL exception is logged by application code.

Node tests execute the same adapter SQL in SQLite, including rollback, capacity and restart scenarios. Browser tests additionally run the actual Worker and local D1. See [Cloudflare's D1 transaction API](https://developers.cloudflare.com/d1/worker-api/d1-database/) and [local development documentation](https://developers.cloudflare.com/d1/best-practices/local-development/).

## Production authentication and integration boundary

`localMode` requires **both** `LOCAL_EDITORIAL_MODE=synthetic-only` and exact origin `http://127.0.0.1:8788`. The flag, a forged role header, or a local cookie at a remote hostname is insufficient. Local cookie/session behavior is not a production IdP; production handlers fail closed. HTTP loopback cookies are HttpOnly/SameSite Strict, with only a random token hash stored; a real deployment must use Secure sessions and a specifically approved verified identity setup.

Before enabling production admin: select/provision the authorized IdP; verify cryptographic token signature, issuer, audience, expiry and admin membership server-side; use secure session lifetime/revocation, CSRF protections and least privilege. Never trust an unverified email/header assertion. No real identity or persistent credential is provisioned here.

Before public intake: resolve submission terms, privacy/retention/deletion and abuse limits, review capacity/archival behavior, approve the real D1 binding/migration/rollback and test production authorization. Rate keys here are in a local synthetic namespace; production privacy protection, distributed abuse handling and storage budgets still need explicit implementation. The $10 operating target is accepted; actual licenses and numeric Jev allocation remain undefined.

Analytics-provider IDs, secret-vault setup, connection tests and budget enforcement stay separate backend contracts. Future analytics settings accept validated IDs, never scripts. Future API setup must be authenticated and server-side/write-only, expose masked status only, redact logs, apply least-privilege connection tests and preserve audit history. No settings page, live secret, provider connection, email delivery or paid inference is claimed in this slice.

## Editorial policy and rollback

This inbox collects suggestions and review follow-up. Disposition changes do not publish/unpublish articles or require human preapproval for every article. The founder's automatic-publication/post-publication-review policy remains intact; the article generation/publication pipeline is not implemented here.

Rollback: close/revert the feature PR. The existing static staging config is untouched and needs no infrastructure rollback. Preserve/export local SQLite before deliberately removing local test data; no remote database exists from this work.
