# Tasks

- [x] Inspect the existing quality admission, publication ledger and affected specs.
- [x] Permit validated new slugs in the complete-candidate quality request; keep canonical maintenance target IDs pinned.
- [x] Add the quality-gated coordinator for publication and rollback commands.
- [x] Test new identity allow/deny, durable replay, publication metadata/history, revision, rollback, and replay after rollback through actual local D1/publication storage.
- [x] Run the focused quality/admission tests and retained publication suite.
- [x] Run type checking; record the unrelated pre-existing/concurrent recovery error in the handoff.
- [x] Record exact local checkpoint and remaining canonical-registration boundary.
- [x] Close the publication CLI bypass: reject new IDs without trusted quality context and route the fixed synthetic demo through durable local D1 admission.
- [x] Add CLI apply/demo/replay regression coverage and distinguish synthetic demo evidence in user documentation.

## Verification note

The focused command `node --test tests/maintenance-quality/new-article-publication.test.mjs tests/maintenance-quality/admission.test.mjs` passed (9 tests). `npm run test:publication` passed (14 tests), including the CLI boundary/replay cases. `npm run check` passed for 188 files with zero errors, warnings or hints. An earlier full `npm run test:maintenance-quality` attempt exposed five failures in existing canonical-source pin/build tests while other branch work was changing tracked inputs; the focused lifecycle tests passed on rerun.
