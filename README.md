# Agentic Bible

A planned living encyclopedia of AI agents and the technology around them: sourced, interconnected articles with transparent revision history.

**Status on the feature branch:** a local Astro/TypeScript reading slice with three sourced working drafts, topic navigation, citations, related entries, GitHub file history, and Pagefind search. Editorial approval is pending. No deployment, analytics, advertising, public submissions, or automated publishing is enabled. Foundation PR #1 remains unmerged.

The stacked `feat/editorial-inbox` branch adds a persisted **local synthetic** correction/source flow and role-protected editorial inbox with tags, dispositions and audit history. Public intake and production admin authentication remain disabled. PR #2's branch is unchanged.

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

`npm run test:monitoring` runs 15 source/job/publication tests after a build. `npm run validate` includes them; `npm run test:editorial:browser` also exercises the new flow against actual Worker/local D1. [Source-monitoring contracts](docs/source-monitoring-contracts.md) describe limits, state transitions, endpoints and remaining live-integration gates. PR #3 and the separately reviewed contribution-draft fixes are kept outside this branch's changes.

## License and contributions
The founder approved open-source direction. Specific licensing for code, articles, and submitted material is unresolved; no license is granted by these documents. Third-party contributions are not being solicited or accepted until the founder approves and publishes the relevant terms.
