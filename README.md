# Agentic Bible

A planned living encyclopedia of AI agents and the technology around them: sourced, interconnected articles with transparent revision history.

**Status on the local publication branch:** accepted local reading/search, synthetic editorial/source workflows and inert settings, plus isolated supplied-article HTML/search/history snapshots. Three original sourced working drafts remain unchanged; editorial/content review remains pending. Foundation/reading PRs #1/#2 are merged upstream, observed at main `2ad330e06fcc4dd46a8fc95291ccc3cd1c597327`; this branch does not merge main or deploy. No live analytics, ads, public submissions, provider calls or public article release is enabled. Accepted PR10 remains pinned at `d0bfca47cd221b970b01ace838afb3f3bb9a5d32`.

The source PR branches stay immutable. The feature sections below describe the separately reviewed slices; the integration candidate adds their combined validation without changing production gates. Public intake and production admin authentication remain disabled.

## Start here
- [Decisions and open questions](docs/decisions.md)
- [Proposed architecture and resource inventory](docs/architecture.md)
- [Roadmap and acceptance criteria](docs/roadmap.md)
- [Product specification](openspec/specs/product.md)
- [Contribution workflow](CONTRIBUTING.md), [agent instructions](AGENTS.md), [governance](GOVERNANCE.md), [security](SECURITY.md)
- [Discovery and measurement](docs/discovery-measurement.md)
- [Cost and advertising controls](docs/cost-advertising.md)
- [Change and release templates](docs/workflow.md)

## Development
Use Node **24.19.0** (`.nvmrc`) and npm **11.9.0**. The exact dependencies and integrity hashes are in `package-lock.json`. No credentials are needed.

```sh
npm ci
npm run dev
```

Development serves the library at `http://127.0.0.1:4321`. Full-text search needs the generated index, so use the built preview for search validation:

```sh
npm run validate
npm run staging:check
npm run staging:local
```

The Workers local preview is `http://127.0.0.1:8787`; it exercises the static asset routing, security headers, 404, and real search index. `staging:check` is a local Wrangler **dry run**. Neither command deploys. The configuration deliberately omits routes and custom domains. Never run `wrangler deploy` without deployment authorization.

`npm run validate` checks Markdown file links, Astro/TypeScript, the static build, Pagefind generation, generated route/citation anchors, provenance labels and staging safeguards. Browser checks are separate:

```sh
npm run browser:install
npm run test:browser
```

An existing `/usr/bin/chromium` is used automatically, or set `CHROMIUM_PATH` to a local executable. Otherwise `browser:install` downloads the pinned Playwright Chromium into `.git/playwright`. The saved environment blocks that download but includes system Chromium. Tests use desktop and mobile sizes, real Pagefind queries, keyboard navigation, failure states, external-request checks and axe accessibility audits. Automated accessibility checks are partial evidence, not a complete accessibility certification.

`npm run preview` offers an Astro-only built preview on port 4321; Cloudflare `_headers` are exercised only by `staging:local`. npm and runtime caches use the writable project `.git` directory. Astro/Wrangler telemetry is disabled in the commands. The CI workflow validates and tests; it has no deployment step or cloud credentials.

See [the slice change record](openspec/changes/reference-library-slice/proposal.md) for scope and [verification evidence](docs/review/first-slice.md) for the saved-environment handoff.

## Local editorial preview

```sh
npm run editorial:migrate
npm run editorial:local
```

Open `http://127.0.0.1:8788/contribute/` to submit synthetic corrections or sources, then `/admin/` to choose an explicit local editor/admin or reader test identity. This is not a production sign-in mechanism. State persists in `.wrangler/editorial`; no remote D1 database or real credential is created. The existing static staging config is unchanged.

`npm run validate` now also executes nine server/SQLite tests. Run `npm run test:editorial:browser` separately for the actual Worker/local-D1 end-to-end suite. It requires port 8788 to be free and resets only its isolated `.git/editorial-browser-state`; it preserves interactive data. Run `npm run test:browser` for reading/search regression checks. [HTTP, storage, authentication and integration contracts](docs/editorial-contracts.md) document the exact boundaries and production gates.

## Local source monitoring

The next stacked branch adds a deterministic source-observation/publication-ledger foundation. `npm run build` generates a catalog from the existing article/source metadata. Apply the additive local migration with `npm run editorial:migrate`, start `npm run editorial:local`, and open `/admin/sources/` on port 8788 with the local editor fixture.

Run a `baseline` and then a `change` for one source. Synthetic HTTP responses produce a persisted source-change event and an automatically published **local metadata revision**, flagged afterward for review. Review flags, revert and restore are independent operations. No article text or public release changes. The controls make no outside HTTP requests; live cron, models and provider credentials remain disabled.

`npm run test:monitoring` runs 23 source/job/publication and batch-receipt tests after a build. `npm run validate` includes them; `npm run test:editorial:browser` also exercises the new flow against actual Worker/local D1. Run `npm run test:monitoring:worker` separately, with port 8788 free, for restart, failed-completion and receipt-retention checks against actual local D1. It resets only `.git/monitor-command-worker-state`, preserving interactive and browser-suite data. [Source-monitoring contracts](docs/source-monitoring-contracts.md) describe limits, state transitions, endpoints and remaining live-integration gates. The original PR #5/#8 heads remain unchanged; the integration candidate combines the separately accepted contribution fixes.

## Local measurement settings

After `npm run build` and `npm run editorial:migrate`, start `npm run editorial:local` and open `/admin/settings/` with the local editor fixture. Google tag/GA4 and Microsoft Clarity identifiers save independently with per-section revisions and a bounded audit history. Use synthetic identifiers only. Consent defaults are denied and ads are locked off.

The optional public policy preview emits an inert template on selected local reading pages. It cannot execute or send tracking requests. No SDK, provider connection, secret form or key vault exists; private/admin pages, search and forms are excluded. Static staging remains uninstrumented. `npm run test:settings` checks validation, security/privacy, transactions, replay and persistence; the editorial browser suite includes actual Worker/D1 settings/rendering checks. [Settings contracts and remaining gates](docs/measurement-settings-contracts.md) describe the precise scope. PR #7 remains immutable; accepted contribution and batch-replay fixes are combined only on the integration candidate.

## Local integration validation

Start with `npm run validate` to build the exact candidate and run all server/static tests, including the populated migration upgrade/reopen checks in both schema orders. Then run `npm run test:editorial:browser`, `npm run test:integration:browser`, `npm run test:monitoring:worker` and `npm run test:browser` sequentially. The integration browser journey uses its own `.git/integration-browser-state`; all test harnesses preserve `.wrangler/editorial`. `npm run editorial:migrate` applies only missing local migrations by their full filenames; reapplying an up-to-date schema is a no-op. Both independently added `0003_` migration filenames are preserved and tested. No remote migration or deployment is part of these commands.

[Exact integration provenance and evidence](docs/review/local-integration-candidate.md) and [remaining MVP/release gaps](docs/integration-mvp-gaps.md) distinguish local behavior from launch readiness. Independent integration review and pending release approval remain required.

The local PR #9 follow-up closes no-op settings replay with separately bounded private receipts and additive migration `0004_measurement_request_receipts.sql`, after both distinct `0003` files. Run `npm run test:settings:worker` sequentially with the other Worker suites for actual restart/fault/capacity/expiry checks. [Independent exact-head review](docs/review/settings-receipts-independent.md) records acceptance of the bounded fix. This follow-up was verified locally before the separately authorized integration draft publication. Record the actual published head/CI and PR outcome in the handoff; independent integration/release approval remains pending.

The settings follow-up preserves unchanged-save request references with separate bounded receipts: 128 private responses, 32 KiB each, 24 hours without evicting supported retries. New no-ops fail closed at capacity; change audit is unaffected. After a build, `npm run test:settings:worker` verifies actual Worker/D1 restart, capacity, expiry and rollback in its disposable `.git/settings-receipt-worker-state`. Run all browser/Worker suites sequentially: the browser suites share their artifact directory, and the editorial browser and settings Worker suites share port 8788. Migration `0004_measurement_request_receipts.sql` follows PR #7's measurement `0003`; PR #8's independent monitoring `0003` keeps its distinct filename. See the contracts for provenance, retention and rollback.

## Local rendered publication preview

The separate publication slice accepts supplied synthetic cited article revisions and automatically renders them into an isolated local collection with real Pagefind search, readable history, post-publication flags and a reversible hash manifest. Run `npm run build`, `npm run publication:demo`, then `npm run publication:local` and open `http://127.0.0.1:8790/local-publications/`. Original Markdown articles, static deployment output and monitoring transport files are unchanged. No generation, public release or deployment occurs. [Publication contracts, validation, rollback and remaining gaps](docs/local-article-publication.md) describe the exact local guarantees. [PR10's pinned independent review](docs/review/pr10-integration-independent.md) remains separate evidence.

`npm run test:publication` checks interruption/process death, deterministic manifests, replay, rollback, schema/security and isolation. `npm run test:publication:browser` exercises real HTML/search/history and desktop/mobile accessibility on its own disposable Git-directory store. Run browser suites sequentially. The production source-event/publishing adapter, identity, factual/licensing checks and canonical full-site integration remain unfinished; no new PR is published before the local checkpoint handoff.

## License and contributions
The founder approved open-source direction. Specific licensing for code, articles, and submitted material is unresolved; no license is granted by these documents. Third-party contributions are not being solicited or accepted until the founder approves and publishes the relevant terms.
