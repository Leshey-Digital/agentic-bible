# Local source-monitoring and publication-ledger contract

Branch: `feat/source-monitoring`, based on PR #3 at `efa15e6fc47931951ea7d617c4a567850435f939`. PR #3 stays immutable. Parent coordinates its separate contribution-draft P2 fix; this slice does not edit the contribution script or its browser-test file.

## Runnable outcome and scope

Run `npm run build`, `npm run editorial:migrate`, then `npm run editorial:local`. At `http://127.0.0.1:8788/admin/sources/`, sign in with the explicit local editor fixture. Select a source, run `baseline`, then `change`. A baseline creates no change claim. A changed hash records an event and candidates; valid candidates automatically publish **local source-observation metadata revisions**, then receive review flags. Clear the flag, revert and restore to inspect the persisted ledger.

No primary source page is fetched by these controls. Synthetic fixture HTTP uses the real allowlisted metadata URLs as identifiers only. Article text, source-verification dates, Markdown, Pagefind content and public releases are unchanged by these jobs. This is not a deployed article-writing/model pipeline. The founder's automatic-publication/post-publication-review policy is preserved; `queued` means bounded work waiting to run, not human preapproval.

## Catalog and trust boundary

The Astro build creates `/source-catalog.json` from the existing three articles' source metadata: eight distinct URLs and their article associations. It is public metadata already visible in citations, with no credentials or source bodies. The monitor validates catalog shape/version, known article IDs, stable URL-derived source IDs, unique HTTPS URLs, a maximum 12 active sources, and five exact primary-documentation hostnames. No credentials, custom ports, URL query/fragment or arbitrary API URL input is accepted.

Admin actions accept source IDs found in that catalog, never a destination URL, HTTP header, transport implementation, deadline or model. The default transport is an original synthetic fixture implementation with no global/network `fetch` fallback. Redirects are not followed, including redirects to private hosts. Submitted contribution URLs do not enter this allowlist or runner. Registry/metadata edits require a reviewed repository build.

Future live fetching still requires a separately secured transport, DNS/address/redirect protections, account/release review and actual operating controls. A host allowlist is not a general DNS/SSRF safety certification. This slice makes no outside HTTP requests at all in its monitoring path.

## Jobs, conditional HTTP and limits

`migrations/0002_source_monitoring.sql` adds source snapshots, jobs, reservations, change events, candidates, article ledger heads, revisions and action history to the existing local D1 adapter. There is no new dependency or cloud resource. State remains in `.wrangler/editorial`; automated tests migrate their isolated state directory.

- `scheduleChecks` is a callable hourly-slot planner. Each call queues at most four sources; duplicate slots are skipped, and subsequent calls can cover remaining catalog sources. There is no Worker `scheduled` handler, cron binding or enabled schedule.
- Job keys persist and reject conflicting reuse. Each dispatch needs an atomic lease and reservation. Only one unexpired job per source runs; a lost lease cannot commit. Reservations survive crashes and abandoned attempts still count.
- Local fixture limits: four jobs and four candidates per pass, three attempts per job, 20 reserved attempts per UTC day, 32 KiB per response, two-second deadline, ten-second lease, 500 retained jobs, 1,000 events and 24 registry records. The day cap stops dispatch **before** fixture HTTP; budget-blocked jobs can resume next day when manually processed. These are test/request bounds, not monetary spending approval or a model budget. Paid calls remain zero.
- Transient network/408/429/5xx/timeout failures use bounded one-/two-second retry delays. The third failure is terminal. Expired third attempts are terminal on the next processing pass. There is no recursive discovery or immediate infinite retry.
- Requests use `If-None-Match`, or `If-Modified-Since` when only a date is stored. 304 requires a prior baseline. A 200 with the same SHA-256 produces no change. Validators, content type, UTF-8, JSON syntax when applicable, body size and deadlines are checked. Unsupported/malformed/empty payloads and redirects have explicit job errors. Source bodies are hashed in memory and discarded.

Source snapshot, versioned change event, affected-article candidates and successful job/reservation state commit transactionally. Event IDs include the source version, so replay cannot duplicate an event while a genuine later A→B→A cycle remains distinguishable. A failed transaction leaves the previous snapshot intact.

## Publication and review states

Candidates contain only a source-observation note plus event/source IDs, URL and old/new hashes. The publisher independently checks the payload kind/scope/article and required evidence against the catalog and recorded event. Structural invalidity becomes `blocked_malformed`; missing/mismatched evidence becomes `blocked_evidence`; neither produces a revision. Valid `queued` candidates automatically become `published` with `review_flag=flagged`.

Publication creates a local revision, updates its article's ledger head, changes the candidate and writes an action together. The revision is unique per candidate. Optimistic guards prevent duplicate publication or head races. Older queued observations become `superseded` if a newer source version was already published; they cannot move the head backward.

Review flags are separate from publication: `flagged` → `cleared` does not move a ledger head. Current local revisions can become `reverted`, moving the head to their predecessor; `restore` returns that same revision when the head/version still match. Every action uses candidate/head versions and a request key; replay is idempotent, conflicting key reuse or stale state is rejected. Flags can be cleared on historical published revisions without restoring their content/head.

## Protected routes

All routes below inherit the existing exact-loopback/local-mode/admin-role gate. Writes additionally require same origin and the session CSRF token. Production identity remains unconfigured and fails closed. No provider key, permanent identity or raw session token is introduced.

| Route | Contract |
|---|---|
| `GET /admin/sources/` | Server-rendered local fixture controls, source observations, bounded job/candidate views and action ledger |
| `GET /api/admin/monitor/state` | JSON snapshot with `mode=fixture-only`, `publicRelease=false`, sources/jobs/candidates/heads/budget/actions |
| `POST /api/admin/monitor/run` | `{sourceId,scenario,requestKey}`; known fixture scenario only; run one job then bounded automatic publication |
| `POST /api/admin/monitor/schedule` | `{requestKey}`; queue next bounded hourly fixture batch, no live scheduling |
| `POST /api/admin/monitor/process` | `{requestKey}`; process due jobs and queued candidates within per-pass limits |
| `POST /api/admin/monitor/transition` | `{id,action,headVersion,candidateVersion,requestKey}`; action is clear-flag/revert/restore; 409 stale state, 422 invalid/conflicting input |

Native admin forms use corresponding `/admin/sources/check/`, `schedule/`, `process/` and `transition/` paths. API writes use `X-CSRF-Token`. Responses are no-store, non-indexable and frame-blocked. Raw source payloads, cookies and SQL exception details are not logged by application code.

## Verification and remaining work

`npm run validate` includes `npm run test:monitoring` after building the real metadata catalog. SQLite tests cover conditional responses, hash changes, replay, timeout, malformed/oversized payloads, allowlist/redirect rejection, no global fetch, retry/day caps, lost leases, missing evidence, rollback, stale revisions, reversible flags/heads and persisted state. `npm run test:editorial:browser` also exercises this flow against the actual Worker/local D1, including concurrent duplicate requests and daily-budget reservation races.

This slice does not enable live HTTP/cron, Jev/model integration, public article publication, production admin identity, email, analytics or advertising. Secure provider setup, actual monetary budgets and a production publisher adapter remain pending. Specific licenses/Jev allocation are still undefined. The accepted $10 operating target is unchanged.

Rollback is a feature-code revert. Preserve/export interactive SQLite before deliberately reverting migration state; do not automatically drop records. No remote infrastructure rollback is needed. Existing static staging config and lockfile are untouched.
