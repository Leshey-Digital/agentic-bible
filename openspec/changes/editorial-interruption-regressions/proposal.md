# Contribution interruption regression coverage

Branch from immutable PR #4 head `3d98ef75679d855b1ffb5608014ccdf0c0c94669`. Cover unchanged retry after a committed response is lost, reload while a committed response is pending with newer edits, and clear-only while a save is pending. Forward requests to actual local Worker/D1, control only response delivery with explicit promise gates/abort, and assert record/audit counts plus recovered field values.

Baseline: two scenarios passed; clear-only failed because completion recreated an empty session-storage draft after Clear draft removed it. Its default article could then suppress the next article-link default. The minimal client fix lets a response persist a fresh reference only when the current form still owns the submitted reference. A cleared/new draft owns its storage through its own clear/input actions.

No server/API/authentication/schema/dependency/infrastructure or public-intake change is required. Use only isolated synthetic test data and existing local D1 state; no paid calls, merge or deployment. Independent review remains required. Rollback is to revert this follow-up commit; there is no migration or resource rollback.
