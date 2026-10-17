# Sealed wiki snapshot compatibility

Dedicated successor branch `fix/wiki-snapshot-compatibility`, checkout `/workspace/agentic-bible-wiki-compatibility`, starts at preserved PR22 `398bacc73a4c8b8e8a40dd75d1aa7d96bb86c950`. The draft PR records this successor's exact commit and CI. PR23's six further working drafts remain preserved at `54b9d0793af36c00c9feca7a8933d3c1a9fa9d95`; this fix has not been integrated into that head. Independent exact-head review remains required.

## Reproduction and contract

The regression archives immutable PR21 `c3d1d7a47e55862c53840d52ad4c71631bd9ad9e`, executes its actual runtime, prepares controlled charged native D1 evidence and activates two three-article sites with the real publisher. It retains site, publisher and observation stores across the upgrade. Before the fix, old runtime HTTP 200 becomes PR22 HTTP 503 (`503 !== 200`); no handcrafted substitute manifests establish compatibility.

The V1 reader now derives required canonical article pages from each sealed artifact's own hash-bound catalog, independent of the live article/content/source schemas. The frozen original three core entries and stable reading/search/catalog/Pagefind/history/review files remain required. Catalog version, safe unique IDs and exact declared/inventoried article pages are checked within fixed reader bounds: 20 articles, 128 inert source records, 32 KiB. Full reference/manifest/byte/hash/path/ancestry validation remains. These reader bounds do not expand live source admission or transport permissions. Source records are inert archived display data, not URLs to execute.

The writer still requires today's complete catalog. New and saved pending commands with changed source code retain `build_source_changed`. Read/replay does not migrate, rewrite, reactivate or fall back to an older site. Accepted old/current receipts use zero calls to the supplied D1 capability; existing SQLite mutex coordination is unchanged. No D1 charges, reservations, publisher/jobs/pointer or stored site bytes change.

Tests cover old/current HTTP and real Pagefind/history, exact status/current equality, old/current accepted replay, and a private future runtime with a new article ID plus incompatible live content and source catalog schemas. Raw corruption and resealed malformed layouts fail closed: missing legacy/current output, undeclared pages, unsafe/duplicate IDs, unknown catalog version, absent declared output and invalid source-array shape. Corrupt current HTTP stays 503 without fallback. Ordinary Markdown and dist remain byte identical.

## Validation

- `npm run validate`: all 109 tests passed, including actual populated old-runtime upgrades, native workerd/D1, full discovery builds and retained interruption/recovery cases. Type checking: 89 files, zero errors/warnings/hints. [Upgrade evidence](wiki-snapshot-compatibility-evidence.json) records three-to-eight article compatibility, exact replay, zero supplied D1 calls, future-schema/source-pin checks and corruption rejection.
- `npm run test:wiki-seo:browser`: one production-discovery/synthetic-exclusion composition journey passed after validate.
- `npm run test:browser`: 18 desktop/mobile cases passed, including all new-topic searches, navigation, accessibility, no-JavaScript reading and network/CSP checks.
- `npm run test:editorial:browser`: 22 cases passed. `test:integration:browser`, `test:publication:browser` and `test:combined:browser`: one journey each passed.
- `npm run test:wiki-bridge:browser`: both canonical and actual old-store upgrade journeys passed. [Browser evidence](wiki-snapshot-compatibility-browser-evidence.json) records old/current Pagefind, exact replay, preserved native accounting and no external requests. Across seven browser suites, all 46 cases passed.
- `npm run test:monitoring:worker` and `npm run test:settings:worker`: one real native Worker/D1 restart/capacity suite each passed, sequentially with browsers.
- `npm run staging:check`: staging/noindex assertion and 70-asset dry run passed, no deployment/bindings.

The intended red regression failed before the reader fix (`503 !== 200`); the implemented regression and all retained suites passed afterward without retries. The separate pre-journal interruption flake reported during PR21 review has no established root cause and did not recur in this full run; this change does not suppress it or claim to fix it. Exact-head CI is recorded in the draft PR. Final documentation validation and whitespace checks run after recording this evidence.

Reproduce in a full clone: `npm ci`, `npm run validate`, then `npm run test:wiki-bridge:browser`. CI uses full repository history to execute exact PR21 code; a shallow local clone needs `git fetch --unshallow`. Use Node 24.19.0/npm 11.9.0 and the pinned lockfile. Run the remaining documented browser/native suites sequentially. Local dependencies reuse the project's existing installation. Temporary linked-worktree `.git`/dependency symlinks are restored/removed after validation; no framework or package change.

No merge, deployment, resource, paid/model/provider call, live source/indexing submission, credentials/account, ads/tracking, intake or license change. PR22's five articles retain working-draft status; code compatibility review and content acceptance remain distinct. Next safe action is independent review of this exact successor before qualified integration with preserved PR23. Rollback reverts this successor to PR22; no stored-byte migration or remote rollback is required. Existing production, rights, cost and distribution gates remain open.
