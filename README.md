# Agentic Bible

A planned living encyclopedia of AI agents and the technology around them: sourced, interconnected articles with transparent revision history.

**Observed main status, 2026-10-18:** main `6987bf2c53d8ddc9ffb34d9b89d453caf0adf213` contains the reviewed twenty-article MVP and accepted admin/release recovery fixes through PR37, plus the controlled maintenance/history/restoration stack through PR43. All twenty accepted article files retain the hashes recorded in the [integration evidence](docs/review/reviewed-mvp-integration-source.json). Content/source review acceptance does not establish factual completeness or live publication.

Reading/search and maintenance have local or controlled test evidence. Hosted identity, public intake, real provider calls, analytics, ads and indexing remain closed by default. Validation CI produces a release candidate; a separate manual staging workflow exists behind explicit owner enablement and environment approval. Live settings are not established by code or green CI. See the [dated observations, owner setup checklist and release hold](docs/commit-pinned-releases.md#observed-status-and-owner-preparation-2026-10-18). Static reading/search requires no Jev key.

The source PR branches stay immutable. The feature sections and linked review/change records below preserve their preparation-time checkpoints, test results and earlier main states. References there to unmerged branches, three articles or pending acceptance are historical unless explicitly updated; they do not override the observed main status above. The separate hosted pipeline in PR44/PR46 is not part of this main snapshot.

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

`npm run preview` offers an Astro-only built preview on port 4321; Cloudflare `_headers` are exercised only by `staging:local`. npm and runtime caches use the writable project `.git` directory. Astro/Wrangler telemetry is disabled in the commands. The validation workflow validates, tests and packages the release candidate without deploying. The separate [Explicit staging release workflow](.github/workflows/release-staging.yml) can consume an exact successful main-push candidate only after its owner gates pass; no release is authorized by these development commands.

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

## Local HTTP adapter checkpoint

The separate `feat/local-http-source-adapter` branch adds a callable Node HTTP observation library with six fixed official documentation targets, public-address DNS pinning, conditional fetch, strict response/deadline/body/request limits and hash-only last-good metadata. `npm run test:http-sources` uses controlled resolver/fetch data; it makes no live adapter request. Existing Worker source controls remain fixture-only and remote schedules stay disabled. The library is not wired to persistence, admin actions or publication. [API, safety boundaries and integration limitations](docs/http-source-adapter.md) describe the local checkpoint. PR10 stays immutable; this branch is not published or deployed.

The local `feat/http-worker-persistence` follow-up separates shared validation from Node transport and adds a Workers-native fetch library plus HTTP-only D1 state, atomic request reservations, leases and explicit bounded retries. Run `npm run test:http-worker`; it is included in `npm run validate` and uses actual local workerd/D1 with controlled outbound responses and restart. No app endpoint, schedule or article-publication bridge invokes it. Workers cannot use the Node DNS pinning options; [the follow-up contract and limitations](docs/http-worker-persistence.md) describe platform DNS/TLS trust, additive migration 0005, request-count limits and remaining monetary/egress review. The original Node checkpoint and PR10 stay unchanged.

## Local rendered publication preview

The separate publication slice accepts supplied synthetic cited article revisions and automatically renders them into an isolated local collection with real Pagefind search, readable history, post-publication flags and a reversible hash manifest. Run `npm run build`, `npm run publication:demo`, then `npm run publication:local` and open `http://127.0.0.1:8790/local-publications/`. Original Markdown articles, static deployment output and monitoring transport files are unchanged. No generation, public release or deployment occurs. [Publication contracts, validation, rollback and remaining gaps](docs/local-article-publication.md) describe the exact local guarantees. [PR10's pinned independent review](docs/review/pr10-integration-independent.md) remains separate evidence.

`npm run test:publication` checks interruption/process death, deterministic manifests, replay, rollback, schema/security and isolation. `npm run test:publication:browser` exercises real HTML/search/history and desktop/mobile accessibility on its own disposable Git-directory store. Run browser suites sequentially. The production source-event/publishing adapter, identity, factual/licensing checks and canonical full-site integration remain unfinished; no new PR is published before the local checkpoint handoff.

## Local combined candidate

The separate successor `feat/local-mvp-combined-status` retains the exact PR10/PR12/PR11/PR13 histories and independently accepted PR14 status fix, preserving published PR15 unchanged, all original feature suites and a controlled collector/supplied-publication browser journey (`npm run test:combined:browser`). HTTP observation and supplied article publication remain separate libraries: no source-to-generated-article or trusted provenance bridge exists. [Combined contract, exact source heads, review gates and missing bridge](docs/local-mvp-combined-candidate.md) describe the candidate for independent review. No combined acceptance, main merge or deployment is implied.

## Local canonical wiki bridge

The separate canonical bridge successor connects actual charged local HTTP receipts to explicitly supplied original tool-use revisions, the existing publisher and a full isolated wiki build. `npm run wiki-bridge:prepare` prepares controlled synthetic observations; `npm run wiki-bridge:apply -- --file fixtures/wiki-bridge/packet.json` performs evidence validation, publication, full Astro/Pagefind build and atomic activation in one command. `npm run wiki-bridge:status` exposes pending state; `npm run wiki-bridge:local` previews canonical routes on 127.0.0.1:8793. [Bridge contracts and reproduction](docs/local-canonical-wiki-bridge.md) and [verification](docs/review/local-canonical-wiki-bridge.md) distinguish integrity binding from factual/authenticity proof. Original Markdown, ordinary dist and interactive data are preserved. Earlier disconnected-slice descriptions remain historical; no source generation, live release or deployment is added.

## Canonical discovery and disabled indexing

The separate canonical SEO/indexing slice adds explicit origin/mode policy, accurate article structured data, public-only sitemap generation and a disabled bounded SQL indexing outbox. Default builds remain staging/noindex. `npm run test:seo` and `npm run test:seo:build` are included in validate; `npm run indexing:queue` and `npm run indexing:status` default to disabled with no submissions or store creation. [Contracts and reproduction](docs/canonical-seo-indexing.md) distinguish candidate URLs/provider receipts from actual publication/indexing. [Verification](docs/review/canonical-seo-indexing.md) records native D1/build checks and the separately prioritized bridge-isolation fix. No live transport, provider key, account, cron or deployment is configured.

## Bridge and SEO composition

The separate [bridge/SEO composition](docs/wiki-seo-integration.md) preserves exact PR19/PR20 ancestry and adds `npm run test:wiki-seo:browser` for charged evidence → supplied canonical reading/history/search with synthetic sitemap/indexing exclusion, restart/replay and rollback. Only explicit production build mode with https://agenticbible.si enables canonical production discovery. Default staging and synthetic output remain nonindexable, and indexing has no live transport. Independent source/composition acceptance and release gates remain pending; no deployment or live submission is performed.

## License and contributions

The separate [encyclopedia usability pass](openspec/changes/encyclopedia-usability/proposal.md) preserves the twenty-entry source and existing identity while improving reading measure, article actions, native contents/navigation, search feedback and admin recovery. Run `npm run test:browser` and `npm run test:hosted-admin:browser` after validation for keyboard, narrow/tablet/mobile, reduced-motion, no-script, real Pagefind and controlled signed-admin/D1 error/retry coverage. PR33 and all live release gates remain separate.

The founder approved open-source direction. Specific licensing for code, articles, and submitted material is unresolved; no license is granted by these documents. Third-party contributions are not being solicited or accepted until the founder approves and publishes the relevant terms.

## Expanded encyclopedia collection

PR22 added five original working drafts with claim-linked primary sources. Read the [source-verification record](docs/review/encyclopedia-source-verification.md) and [change proposal](openspec/changes/encyclopedia-agent-topics/proposal.md). That preserved checkpoint covered eight articles in genuine reading/search and explicit production discovery; the original synthetic editorial form remains limited to its three supported entries. New citation metadata does not expand the separate live HTTP transport allowlist. No source fetching, paid generation, public submission, indexing delivery or deployment is enabled.

The [six-entry operating-principles successor](openspec/changes/encyclopedia-operating-principles/proposal.md) expands the collection to 14 genuine drafts, with its [source audit](docs/review/operating-principles-source-verification.md). It does not complete the 20-article MVP or change the three clusters. Citation/local-fixture storage is explicitly bounded at 48 sources, with request/day, live transport and spending controls unchanged.

The separate [fourteen-article compatibility candidate](openspec/changes/wiki-content-compatibility/proposal.md) composes preserved PR23/PR24 while their independent reviews proceed. Actual PR21 three-article snapshots remain readable/searchable and replay accepted receipts without D1 calls or historical rebasing; new builds and production candidates require all fourteen current entries. Follow `npm run validate` with `test:wiki-seo:browser`, retained browser/native restart suites sequentially, and `staging:check`. Source and composition acceptance remain separate; no release or further article expansion is performed here.

The separate [catalog/reliability successor](openspec/changes/catalog-atomicity-reliability/proposal.md) preserves PR25 and fixes whole-catalog atomic admission at the existing 48-row bound, native-navigation stylesheet readiness for strict browser audits, and the bounded current search index's worker-startup dependency. `test:monitoring` now includes actual Worker/D1 boundary/restart/fault/concurrency coverage. [Evidence and review status](docs/review/catalog-atomicity-reliability.md) distinguish accepted source reviews from pending successor/composition acceptance. No source articles, transport/spending limits or release gates change.

The [final six source audit](docs/review/mvp-twenty-source-verification.md) and [twenty-entry handoff](docs/review/mvp-twenty.md) record the working collection, bounded metadata adjustment and validation. The content-count target is reached; independent editorial review and production readiness remain separate.

The separate [snapshot-read reliability candidate](docs/review/snapshot-read-reliability.md) reduces bounded-read allocation, verifies the actual served bytes, disables local framework metadata lookup and retains safe build/network failure diagnostics. Validation executes real three/eight/fourteen/twenty-entry snapshot paths without changing archived source or artifacts; prior unexplained failures remain explicit review gaps.

## Explicit local reviewed corrections

The [reviewed community-correction coordinator](docs/reviewed-community-corrections.md) connects existing on-site synthetic intake/admin review to one canonical tool-use correction-note path. Run `npm run validate`, then `npm run corrections:local` with port 8788 free. An admin writes a cited note and explicitly approves it; ordinary dispositions and contributor text cannot publish. Full original prose, opaque contribution/reviewer attribution, readable history, real twenty-entry search, rollback and same-reference recovery remain local. Run `test:corrections` and `test:corrections:browser`; [handoff](docs/review/reviewed-community-corrections.md). This adds no real production authentication, public intake, live source/provider call or deployment.

The [reviewed-corrections composition](openspec/changes/reviewed-corrections-composition/proposal.md) retains both preserved correction and PR28 ancestry, with correction runtime metadata isolation, recoverable completion faults and explicit reconfirmation after stale approval. Independent review of the source and composition remain separate gates.

The [SEO CLI and page-audit follow-up](openspec/changes/seo-cli-and-page-audits/proposal.md) closes inherited review findings without changing public output. `npm run test:seo:build` includes an actual cold-cache Wrangler CLI regression with external networking blocked. `CI=1 npm run test:browser` reports each of the same 24 accessibility/viewport pages independently for desktop/mobile; `CI=1 npm run test:browser -- --grep 'automated accessibility and viewport' --workers=1` isolates all 48 page cases. Per-page axe assertions, 30-second test boundaries and zero retries remain unchanged. Runtime versions are logged and attached: the saved environment uses existing Chromium 154.0.8037.57; CI explicitly selects and launches the executable from package-locked Playwright 1.64.1, verifies it against Chromium revision 1248 (156.0.8078.4), and exports that path to all browser suites. An earlier automatic CI selection used 155.0.8059.0; its successful results are recorded separately. CI/browser differences are recorded rather than treated as equivalent evidence.

The separate [hosted-runtime gap report](docs/hosted-runtime-gap.md) explains why local canonical corrections cannot currently update the hosted wiki. The [Workers-native GitHub proposal adapter](docs/github-content-proposals.md) preserves GitHub source/history, with a bounded D1 outbox and a separate assets-backed staging entrypoint. `npm run runtime:check` is a dry run; hosted write/auth/credential ports remain unconfigured. `test:hosted` and `test:hosted:browser` exercise controlled proposal recovery and real local Workers Static Assets reading/search without claiming a live GitHub change or deployment.

The separate [approval-collision fix](docs/review/correction-approval-correlation.md) binds submission/audit writes to the complete immutable winning approval. `npm run test:corrections` forces both initial D1 lookups to miss, then verifies conflicting submission IDs, successive versions, rollback fingerprints and identical input with different server timestamps. Rejected candidates have no side effects; the winner survives actual D1 restart and exact retry. Previously corrupted stores require explicit audited recovery. PR29 and the paused hosted adapter remain preserved.

The [hosted corrections integration](docs/hosted-corrections-integration.md) composes frozen PR30/PR31 and supplies the shipped Worker's signed-assertion verifier, append-only D1 approvals/revocation and restricted server-only GitHub transport. Once explicit trusted bindings are configured, `/admin/corrections/` supports source review, approval and a separate draft request. No bindings or credentials are configured here. Run `test:hosted` and `test:hosted-admin:browser` alongside retained suites; [handoff](docs/review/hosted-corrections-integration.md). GitHub source integration and authorized build/deployment remain necessary before hosted reading changes.

The [commit-pinned release path](docs/commit-pinned-releases.md) verifies article bytes against a full Git commit and uses that SHA for public history. `npm run test:release` covers local Git/build/native serving and controlled deployment/rollback faults. After the existing CI checks, `npm run release:prepare` packages the tested default-closed Worker/assets without deploying. The separate manual staging workflow remains disabled until owner setup; [handoff and limits](docs/review/commit-pinned-release-path.md). No live deployment or secret setup is performed.

[PR37](https://github.com/Leshey-Digital/agentic-bible/pull/37) merged the reviewed twenty-entry MVP and accepted release/admin recovery fixes into main at `d9ea6386b92c499fc70b9c81b8cb557b8cf96717`. The [integration evidence](docs/review/reviewed-mvp-integration.md) preserves its source history and article hashes. This separate maintenance successor preserves that stack and keeps every live provider/write/release port closed.

## Bounded automatic-maintenance demonstration

The [maintenance audit](docs/automated-maintenance-gap.md) identifies separate monitoring, supplied article revisions, community-correction GitHub drafts and release. The [proposal producer](docs/bounded-maintenance-proposals.md) connects charged source bytes through a strict deterministic extractive fake to automatic local wiki publication with post-publication human flags. It does not enable a real provider or canonical GitHub update.

`npm run validate` includes actual-D1 maintenance checks; `npm run test:maintenance:browser` checks generated twenty-entry reading/search/history/flags. `npm run maintenance:demo` explicitly prepares controlled receipts and activates a synthetic snapshot; `npm run maintenance:local` previews it at loopback port 8798. Simulated costs/tokens are not real provider pricing, billing enforcement or an approved allocation. Source/package changes never silently rebase existing demo state. Public contributions and live release remain closed.

## Captured source-body maintenance connection

The default-disabled [source collector](docs/maintenance-source-collection.md) connects original controlled response bodies and charged D1 receipts to the existing fake producer, automatic local wiki publication and later human flags. Run `npm run test:maintenance-sources` (also in validate), `npm run maintenance:collect:demo`, then `npm run maintenance:collect:local` for the separate read-only loopback preview on port 8799. Successful restart/replay makes no additional source or provider request. No live discovery, HTML normalization, real provider, canonical GitHub write or release is enabled; [checkpoint evidence](docs/review/maintenance-source-collection.md).

## Controlled canonical maintenance writer

The default-disabled [canonical writer](docs/canonical-maintenance-writer.md) consumes completed sourced maintenance output and atomically updates article Markdown, immutable history and the review pointer through an expected-head protected controlled GitHub mutation. `npm run test:maintenance-github` exercises actual D1 and an owned real Git repository, including replay, concurrent writers, lost responses and conflicts. It is included in validate. No real GitHub transport, credential, article publication or release is configured; [checkpoint evidence](docs/review/canonical-maintenance-writer.md).

## Canonical history and post-publication review successor

The separate local hosted-history successor adds static history/diff/flag pages and signed-admin, receipt-bound append-only review. See [the contract and live gaps](docs/hosted-maintenance-review.md). Ordinary builds show an honest empty maintenance history; controlled history requires explicit staging mode and the exact Git source pin. Review never gates valid automatic publication or removes original flags. The current writer supports a retained-target revert request, not canonical restoration.

`npm run test:maintenance-history` checks actual Git receipt reconstruction. `npm run test:maintenance-review` checks shipped workerd/D1 authentication, admission, restart/stale/replay/capacity and quoted-source URL rendering; both commands are included in `validate`. `npm run test:maintenance-history:browser` covers desktop/mobile history and private review flows. No live identity, migration, provider, deployment or remote article write is configured by these tests.

## Controlled canonical restoration successor

A separate successor adds explicit signed restoration approval and a default-disabled local coordinator that appends a new atomic article/history/review-pointer commit. Old requests remain request-only; ordinary valid automatic publication keeps its policy. [Restoration authority, recovery and live gaps](docs/canonical-maintenance-restoration.md) distinguish real owned-Git/local-D1 tests from missing production integration. `npm run test:maintenance-restore` is included in `validate`; `npm run test:maintenance-restore:browser` covers the rebuilt desktop/mobile artifact. No route, provider credential or live write is enabled.

## Controlled maintenance after restoration

`npm run test:maintenance-base` covers separate signed restoration followed by a canonical-base-bound fake generation, atomic writer, strict public history build and source-matching release candidate on owned Git/shared local D1. It is included in `validate`. The port is opt-in fixture-only; no route, schedule, provider, credential or deployment is enabled. [Contract, stale-base recovery and production gaps](docs/restored-maintenance-base.md).

The separate [reviewed maintenance integration candidate](docs/review/reviewed-maintenance-composition.md) composes the accepted PR42 ancestry onto fresh main, preserving all twenty article bytes and the lockfile. The separate hosted pipeline is excluded. Composition acceptance and live release remain separate; direct downgrade to PR41/older readers is unsupported after new canonical-base records exist.
