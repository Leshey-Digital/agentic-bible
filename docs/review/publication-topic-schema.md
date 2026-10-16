# Local publication topic schema fix

Branch `fix/publication-topic-schema` starts from exact reviewed PR11 head `efeffed9467a9fa67125725d923d6d672cfd9555` in `/workspace/agentic-bible-publisher-topic-fix`. PR11, PR10 and the HTTP branch remain unchanged. The final exact local commit is recorded in the handoff and recoverable with `git log -1 --format=%H`.

## Defect and bounded fix

The prior topic whitelist compared `String(value.topic)` while preserving the original value. A JSON array such as `["Foundations"]` therefore passed validation, was persisted as an array and activated successfully. The new regression reproduced this on the base, failing with `Missing expected exception: array`. The fix requires a primitive string before the existing enum check; all rejected topic values retain the stable `invalid_topic` reason.

Regression cases cover array, nested singleton array, object, null, number, boolean and unexpected string. After an initial valid publication, every rejection compares the complete store file inventory/hashes, active pointer bytes and loaded manifest/state, including revisions, HTML/Pagefind artifacts, history, receipts and sequence. A corrected event successfully reuses a rejected key and still receives the normal post-publication editorial flag. All three valid topic strings remain accepted.

Adjacent validation inspection found no equivalent input-coercion bypass: schema version/provenance/block/inline discriminants use strict literals; text and source URLs require strings before normalization/parsing; quality concerns use strict enum membership. Added negative cases prove stringified schema version and array-valued date, provenance, source URL and quality concern are rejected by existing guards. No other runtime validator changes are included. Renderer escaping intentionally converts already-validated display values; it is not used to approve schema input.

## Validation

- `npm run validate`: passed docs, 57-file Astro/TypeScript check (zero errors/warnings/hints), static build/Pagefind and **70 tests**: 4 static, 9 editorial, 23 monitoring, 19 settings, 3 populated upgrades and 12 publication tests.
- Direct strict TypeScript check of `tests/publishing/publication.test.ts` passed using the existing compiler: `./node_modules/.bin/tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 --allowImportingTsExtensions --skipLibCheck tests/publishing/publication.test.ts`.
- `npm run test:publication:browser`: **1 passed**, exercising actual rendered HTML, real Pagefind replacement/pinned old snapshots, readable history/citations, post-publication flags, replay/rollback/empty rollback, mobile/desktop accessibility and no outside requests/runtime errors.
- `npm run test:browser -- --workers=1 --timeout=90000`: **16 passed** after the completed build, including reading/search/mobile/accessibility regression checks.
- `npm run staging:check`: passed static dry-run with **53 assets, no bindings**, no deployment.
- Final `npm run test:docs` and `git diff --check` passed. No unresolved failing check remains. The original red regression is retained as reproduction evidence, not an acceptance result.

Local red/green/type/browser logs remain ignored in this worktree's actual Git directory under `topic-schema-*.log`. Existing dependencies were reused with a temporary local link; legacy `.git`-relative harnesses used a temporary metadata symlink, restored byte-for-byte after validation. No package install or extra framework was needed. Existing editorial/integration browser and Worker-restart suites were not repeated for this one-line validator change; the independent base review/CI already records those results, and no corresponding runtime/schema changes are present.

## Scope and remaining gates

Only the topic guard, publication regression tests and this change/evidence documentation differ from PR11. No renderer, store, article, monitoring, D1, lockfile, route, configuration or dependency change is made. Tests use disposable named publication stores; interactive state is preserved. Previously written malformed topic artifacts are not silently repaired: the stricter revision validator fails closed when reading them. Valid string-topic artifacts and their normalized content schema remain supported.

This remains supplied local fixture publication, with the same explicit production/canonical-live gaps in [the publisher contract](../local-article-publication.md). No source fetch, generation, credentials, paid call, live cron, remote resource change, push, PR, merge or deployment occurs. No CI run is claimed for this unpublished fix. Independent author recheck is pending; prior PR11 CI does not validate this new local head.

Rollback is reverting this isolated guard/test/docs commit. No schema/data migration or resource rollback is needed. Preserve existing isolated stores before any deliberate cleanup; this fix performs none.
