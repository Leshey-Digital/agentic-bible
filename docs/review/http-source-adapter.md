# Local HTTP adapter verification

Prepared 2026-10-16 in `/workspace/agentic-bible`, branch `feat/local-http-source-adapter`. The base is PR #10's exact immutable head `d0bfca47cd221b970b01ace838afb3f3bb9a5d32`; a read-only `git ls-remote origin refs/heads/feat/local-integration-candidate` confirmed that head unchanged at checkpoint. The final local commit is recorded in the handoff and can be recovered with `git log -1 --format=%H`. No branch push, PR publication/update, main merge or deployment is included in this checkpoint.

## Scope and integration differences

The [contract](../http-source-adapter.md) and [change proposal](../../openspec/changes/local-http-source-adapter/proposal.md) define the callable Node library. Six exact official documentation targets use a static registry, public DNS validation and pinning, TLS hostname/certificate verification, no redirects/proxies/credentials, conditional requests, strict response validation and hash-only last-good state. Limits are four charged checks per pass, two seconds total per check, 32 KiB accepted body and eight DNS answers, with no automatic retries.

The existing fixture runner, Worker/editorial routes, publisher, migrations, Wrangler configurations and dependency lockfile have an empty diff against the base. There is no route, CLI, schedule, persistence bridge, candidate creation, article publication or source-verification-date update. HTTP metadata carries `mode:http`; it is not inserted into fixture-provenance tables. No new schema, dependencies, frameworks, credentials, paid calls or cloud resources are introduced. Existing interactive `.wrangler/editorial` data is preserved; browser tests use the existing disposable test state.

## Passed checks

Pinned runtime: Node 24.19.0 and npm 11.9.0; existing project dependencies and system Chromium were used. Commands ran from the project directory.

| Command | Observed result |
|---|---|
| `npm run validate` | Passed documentation validation, 55-file Astro/TypeScript check with zero errors/warnings/hints, static build/Pagefind, and 71 tests: 4 static, 9 editorial, 23 monitoring, 19 settings, 3 integration upgrades and 13 HTTP adapter tests. |
| `npm run test:http-sources` (included above) | 13 passed. Actual adapter/policy/native transport code exercised using controlled resolver, fetch and native request events. |
| `npm run test:browser -- --workers=1 --timeout=90000` | 16 passed across desktop/mobile, including search, keyboard, no-JavaScript, accessibility and no external reading requests. |
| `npm run test:editorial:browser -- --workers=1 --timeout=90000` | 22 passed against actual local Worker/D1, including fixture source publication ledger, concurrency and settings receipts. |
| `npm run staging:check` | Passed dry-run: 53 static assets, no bindings, exited without deployment. Wrangler reported the environment's proxy warning; the new adapter explicitly disables inherited proxies independently. |
| `git diff --check` | Passed. |

Adapter coverage includes arbitrary URLs/credentials/invalid baselines rejected before network work; public/private/reserved/mixed/empty/sparse/oversized DNS answers; pinned lookup, TLS options, outbound header limits and socket-peer mismatch; redirects and unexpected final URLs; ETag/Last-Modified and evidenced 304; baseline/unchanged/changed hashes; malformed response headers/status; MIME/charset/encoding, validators, UTF-8/JSON and declared/streamed body bounds; atomic concurrent reservations, failure charging and no retries; last-good preservation; external cancellation and real two-second deadlines for uncooperative DNS, fetch and streams. Native errors are sanitized. Tests also verify isolation from the fixture/Worker import graph.

The full validation log and browser/dry-run logs remain local under `.git/http-adapter-*.log`; they are ignored runtime artifacts. No failing check remains. The final documentation-only additions receive a fresh `npm run test:docs` and whitespace check before the local commit.

## Not run and remaining limits

- No real adapter DNS/HTTPS request or live TLS handshake. Controlled native request events verify configuration and guards, not official-site connectivity or real socket behavior. Documentation pages inspected separately do not establish live adapter compatibility.
- The conservative 32-KiB identity-only cap can reject real official HTML. Current site MIME, redirects, size, encoding and validators have not been certified. No production availability claim is made.
- Node DNS/HTTPS transport is not Worker-compatible. A reviewed Worker egress implementation with equivalent guarantees and separate integration work is needed before a background/admin workflow.
- The four-check budget is process-local. Durable daily/currency limits, idempotent HTTP persistence, retry policy, trusted baseline provenance, operational identity and monitoring remain integration work. No funded provider is connected.
- Unchanged integration browser and Worker restart/capacity suites were not rerun for this isolated library; PR10 has its own exact-head integration evidence. This checkpoint ran populated schema-upgrade tests and the full editorial browser regression suite.
- Independent adapter review and explicit publication authorization remain pending. Licenses and other release prerequisites remain as recorded in the existing decision documents.

Next action: independent review of this exact local checkpoint and its transport/SSRF boundaries. Stop before publication/integration. Rollback is removal/reversion of these new adapter/test/docs files and script/type-check additions; no migration, data or cloud rollback is needed. Preserve PR10 and interactive data.
