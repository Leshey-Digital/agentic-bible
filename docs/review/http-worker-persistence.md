# Local Workers/persistence checkpoint evidence

Branch `feat/http-worker-persistence`, based on preserved `e237f02912a71b812bc36cf8f628d9144b4b62a4`. PR10 stays at `d0bfca47cd221b970b01ace838afb3f3bb9a5d32`. Final exact local commit is recorded in the handoff and recoverable with `git log -1 --format=%H`.

Scope, limits, integration differences, rollback and architecture constraints are in the [contract](../http-worker-persistence.md) and [change proposal](../../openspec/changes/http-worker-persistence/proposal.md). Only the HTTP adapter/shared core, its separate D1 tables, tests and documentation/scripts change. No article-publication, fixture runtime, application Worker entry or Wrangler configuration file changes. No new dependency or lockfile change.

## Passed

Pinned Node 24.19.0/npm 11.9.0; existing Astro, Wrangler, Miniflare/workerd, esbuild and system Chromium. No package installation or funded call.

| Check | Result |
|---|---|
| `npm run validate` | Passed documentation, 61-file type check (zero errors/warnings/hints), static build/Pagefind and 72 tests: 4 static, 9 editorial, 23 monitoring, 19 settings, 3 populated upgrade tests, 13 Node HTTP tests and 1 comprehensive actual workerd/D1 scenario. |
| Final `npm run test:http-worker` | Passed after final reservation-outcome/unknown-byte accounting changes. Actual workerd fetch handler, controlled outbound service, persisted D1, runtime restart and transaction-failure injection. |
| Final `npm run check` | 61 files, zero errors/warnings/hints. |
| `npm run test:browser -- --workers=1 --timeout=90000` | 16 passed, desktop/mobile reading/search/keyboard/no-JavaScript/accessibility/external-request checks. |
| `npm run test:editorial:browser -- --workers=1 --timeout=90000` | 22 passed with actual local Worker/D1 fixture/publication-ledger/settings regressions. |
| `npm run staging:check` | Passed dry-run, 53 assets, no bindings, exited without deployment. |
| `npm run test:docs` and `git diff --check` | Passed before final local commit. |
| Provenance/configuration check | Prior checkpoint branch remains e237f02912a71b812bc36cf8f628d9144b4b62a4. Remote PR10 branch remains d0bfca47cd221b970b01ace838afb3f3bb9a5d32. Empty diff for existing app Worker/editorial/fixture/publisher/config/lockfile paths. |

Worker coverage: custom Node HTTPS lookup rejected with `ERR_OPTION_NOT_IMPLEMENTED`, with no outbound dispatch; arbitrary/private/credential URLs rejected before storage/network; baseline and validator persistence across restart; byte-identical successful receipt replay; ETag and Last-Modified conditional 304; unexpected 304; redirect, declared/streamed oversize, unsupported encoding, oversized headers, header/stream timeouts; unchanged last-good state on failure; persisted explicit retry/backoff and three-attempt exhaustion; same-key/source contention, four global leases and parallel competition for the final daily slot; restart at exhausted budget; charged crash recovery and abandoned attempts; expired/repeated completion fencing; interrupted third attempt; reservation/completion SQL failures rolling back atomically; 128-job capacity; backward-day fail-closed behavior; missing accounting before dispatch. All outbound responses are controlled. The one-second backoff is tested immediately; a synthetic due-time extension keeps the restart assertion independent of runtime startup duration, then explicit due-time fixtures test retries.

The migration suite preserves every prior application table and a populated synthetic rate row in actual local D1 when adding migration 0005; existing populated upgrade tests also pass. New tables are isolated from fixture/publication provenance. Only disposable `.git/http-observation-worker-state` is reset/migrated by the new suite. Interactive `.wrangler/editorial` is preserved. Failed/interrupted body-transfer size is unknown (`NULL`), not reported as zero.

## Resolved verification failure

The first reading-browser attempt overlapped `npm run validate` rebuilding the shared `dist` directory: Pagefind and page navigation failed while assets were replaced (1 passed, 15 failed). That run is not acceptance evidence. Its log remains `.git/http-worker-reading-build-overlap.log`; rerunning against the completed build passed all 16 checks, followed by all 22 editorial checks. Initial test-harness compatibility/restart issues were corrected using the pinned Miniflare v5 persistence option and fresh D1 stubs after restart. No unresolved test failure remains.

## Not verified and architecture limits

- Three manual reads targeted the exact allowlisted Claude tool-use overview, OpenAI function-calling guide and MCP tools specification. Each used a two-second timeout, identity encoding, no redirect and a 32-KiB cap. Each failed with curl exit 56, upstream status 000 and zero source bytes. No upstream response was obtained; source headers, content size, TLS connectivity and validator behavior remain unverified. No alternative path or retry was used. This is a failed network-read attempt, not an approval denial or a successful adapter call.
- Workers native fetch cannot reproduce Node's DNS pinning/connected-peer checks. Its platform DNS/TLS trust model requires independent review before app integration; there is no app route or schedule invoking it. Local controlled success is not evidence of deployment readiness.
- Twenty daily reservations, four concurrent leases, three attempts and bounded rows constrain request work. They do not enforce currency, inbound CPU/D1 costs or the operating target. Paid providers and remote scheduling remain disabled.
- Terminal jobs/receipts are not pruned automatically. At 128 commands, new keys fail closed pending a reviewed retention/archive policy. No production identity, distributed-clock policy, monitoring/backup or currency accounting is introduced.
- Unchanged integration browser and original Worker restart suites were not rerun here. The populated upgrade tests and full editorial-browser suite passed; PR10 retains its separate exact-head integration evidence.

Local logs remain ignored under `.git/http-worker-*.log`; the failed manual-read metadata is `.git/http-worker-manual-compatibility.json`, containing no body or credentials. No remote resource was created or changed. No article-publication files, source articles or licenses changed.

Next action: independent exact-head review of the native egress boundary, migration and budget/lease transactions, coordinated with the isolated article-publication worker. Stop before push/PR/integration/deployment. Rollback and future integration requirements are in the contract. No publication, push, PR, remote migration, main merge or deployment occurred.
