# Tasks

- [x] Inspect the existing quality admission, publication ledger and affected specs.
- [x] Permit validated new slugs in the complete-candidate quality request; keep canonical maintenance target IDs pinned.
- [x] Add the quality-gated coordinator for publication and rollback commands.
- [x] Test new identity allow/deny, durable replay, publication metadata/history, revision, rollback, and replay after rollback through actual local D1/publication storage.
- [x] Run the focused quality/admission tests and retained publication suite.
- [x] Run type checking; record the unrelated pre-existing/concurrent recovery error in the handoff.
- [x] Record exact local checkpoint and remaining canonical-registration boundary.

## Verification note

The focused command `node --test tests/maintenance-quality/new-article-publication.test.mjs tests/maintenance-quality/admission.test.mjs` passed (9 tests), and `npm run test:publication` passed (12 tests). A full `npm run test:maintenance-quality` attempt also exposed five failures in existing canonical-source pin/build tests while other branch work was changing tracked inputs; the new lifecycle test's initial import/assertion issues were corrected and its focused rerun passed. `npx tsc --noEmit` currently stops on `src/recovery/d1.ts(118,78): TS2538` in concurrent recovery work outside this change's scope.
