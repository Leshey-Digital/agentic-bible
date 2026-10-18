# Published collection intake: local checkpoint

Base: main `b41a422881921638833f92b2361a70eb1647d01f`. Branch: `feat/published-contribution-intake`.

Implementation checkpoint `545eaa7afaa1fc4d1b50248f558ae0feb0a7b205` reuses the existing compiled canonical reading inventory for all twenty local contribution choices and server validation. Migration 0017 removes the original three-ID SQL CHECK, preserves exact populated submissions/audit/correction references plus rate/session state, and retains all other constraints/defaults/indexes. Store entry validates inventory membership again. The contribution build rejects collection drift; request/env/ASSETS catalogs never confer article authority. No second article list, source-byte hash gate or synthetic/derived-build restriction was added.

Test-only successor `34b65c66cdfa81f5d6ab3d218c5d9b98e7e7a957` replaces a potentially precompiled missing-table failure with a runtime duplicate-key failure after all migration statements. This proves rollback at execution time and asserts temporary tables are absent afterward. Runtime code and migration are byte-identical to 545eaa7.

## Passed

- Full `npm run validate` at 545eaa7: exit 0. Includes docs, Astro check (157 files, zero errors/warnings/hints), build/Pagefind, static/intake/native D1, populated integration upgrades, retained publication/wiki/corrections/hosted/release/maintenance/history/restoration/base/pipeline/currency/monitor suites. Durable local log: `.git/published-intake-validation.log`.
- `npm run test:editorial` after 34b65c6 test strengthening: 13/13. Actual browser-platform Worker bundling and workerd/D1 cover populated migration, exact row preservation, dependent FKs, both unique constraints, runtime late-failure rollback, restart/replay, every twenty IDs, unknown rejection and five/six rate boundary. SQLite/API checks also retain moderation, source/HTML/UUID/size/origin/honeypot/hosted gates. Log: `.git/published-intake-focused-final.log`.
- `npm run test:editorial:browser`: 25/25. New desktop/mobile cases verify selector/catalog agreement, restored nonoriginal article drafts, keyboard selection and actual newly supported article submission; retained error/interruption/CSRF/role/rate/moderation/accessibility/settings/monitoring cases pass. Log: `.git/published-intake-editorial-browser.log`.
- `npm run test:browser`: 74/74 desktop/mobile reading, actual search, keyboard, no-script, accessibility, reduced motion, narrow/tablet/desktop, external-network and disabled static intake checks. Log: `.git/published-intake-reading-browser.log`.
- `npm run staging:check` and `npm run runtime:check`: exit 0, dry-run only. Existing static staging has no bindings; runtime has ASSETS only. Logs: `.git/published-intake-{staging,runtime}-dry-run.log`.
- The two new UI cases reran successfully for visual inspection after the shared Playwright output was reset by the reading suite. Inspected screenshots retain the cream/green serif identity, native labelled controls and bounded desktop/mobile layouts; no style changes were needed. Private retained files: `.git/published-intake-screenshots/{desktop,mobile}.png`; log `.git/published-intake-visual-check.log`.
- Parent reports bounded independent source acceptance at 545eaa7 and 34b65c6 with no actionable findings. Independent probes included 15 tests, populated rollback at fourteen statement boundaries, reopen/schema/FK/default/unique/index/invalid-write controls and the actual coordinator splitter plus migration journal. Private independent evidence: `/tmp/contribution-intake-independent-review/{probes.mjs,results.json,README.md}`. This is source review, not composition acceptance.

## Failures observed and corrected

The initial fourth-article API regression returned 503 from the original three-ID SQL CHECK. A preliminary parent-only replacement using deferred FKs failed native D1 commit with `FOREIGN KEY constraint failed`; it was replaced before the implementation checkpoint by transactional child snapshot/restore with FK enforcement continuously enabled. The first Astro check identified definite-assignment declarations in the native test harness; these were corrected. Final checks listed above pass; no failure thresholds were weakened.

## Limits and rollback

Full validation was not repeated after the isolated runtime-failure test strengthening; the complete source/migration implementation was unchanged, the focused suite was rerun, and both browser suites/dry runs ran on the successor. The final documentation check passed: 300 Markdown files, 368 relative links, no missing targets/conflict markers.

Public/hosted intake remains disabled. No remote migration, credential/OAuth/account/security setup, live application/provider call, article mutation, deployed configuration change, push/PR/merge/release/deploy or Library screenshot upload occurred. Interactive `.wrangler/editorial` is preserved; all tests use disposable local stores. Canonical source bytes and dependency lockfile are unchanged. There are no new services or quota increases; migration temporary storage scales with existing stored rows and requires the complete preceding migration sequence.

Apply 0017 atomically through Wrangler migrations or one D1 batch, never as individual statements against populated data. If the local feature is rolled back, preserve/export expanded records and keep a compatible reader; old three-ID code/schema cannot accept the new article IDs. Do not delete or silently downgrade data. Terms/privacy/retention and live identity/abuse/storage prerequisites remain separate from this local expansion. Composition review and any publication or release remain separate gates.

[Proposal](../../openspec/changes/published-contribution-intake/proposal.md), [tasks](../../openspec/changes/published-contribution-intake/tasks.md), [requirements](../../openspec/changes/published-contribution-intake/spec-delta.md), [HTTP/storage contract](../editorial-contracts.md).
