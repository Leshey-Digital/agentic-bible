# Private editorial inbox triage

Editors can combine disposition, article and exact case-sensitive tag to find relevant suggestions across the twenty-article encyclopedia. Article choices use the canonical reading inventory. Empty fields mean all articles/tags. The API validates filters, uses parameter-bound SQL and exact JSON tag membership, and filters before the existing twenty-item page limit. No schema or capacity changes are introduced.

Load inbox applies the visible filters from the first page. Next page retains the last successfully applied filter set even if the controls have since been edited. List filtering does not clear an open suggestion or unsaved note. Empty/error states remain explicit; opening a suggestion during a pending list request cannot leave pagination disabled.

This implements the roadmap's private editorial queue/tag triage without GitHub runtime authority, external provider calls or new costs. Signed-admin access remains mandatory, public intake remains closed, and all article/publication behavior is unchanged. There is no remote deployment or trial in this checkpoint.

Branch ancestry: integration/private-editorial-workflow at de6589f9c6a05a81f5ee622214eac1ecd227faf1. The parallel vault transport PR56 remains a9ec207f329fb1501d38eaf34b916a1c518ebd73; its prepared package and token/deployment approval remain intact. These source branches require deliberate integration later; this does not silently replace the frozen release candidate.

Focused verification: `node --test --test-concurrency=1 tests/production-hosted/inbox-triage.test.mjs tests/production-hosted/draft-navigation.test.mjs` passed 5/5. Native tests use disposable actual workerd/D1 with forty-seven synthetic rows, exact-tag/equal-timestamp pagination, authorization, invalid filters, restart and zero outbound calls. Browser journeys cover keyboard and 390/1280px filtering, draft preservation and interrupted-load cleanup; retained navigation checks run at 390/1440px. Independent source review identified the pagination cleanup issue after the first 3/3 run; it was fixed and covered in the final run without changing existing assertions or deadlines. The reviewer accepted the corrected source and did not independently run tests.

Rollback removes the filter controls and optional query predicates; existing data, cursors, schemas and stored reviews remain compatible. Full release qualification and live acceptance are not claimed.
