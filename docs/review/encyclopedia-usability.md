# Encyclopedia usability candidate

Separate successor to frozen PR33 `e924db11b32171ee28006aabe488c3615a54f583`, branch `feat/encyclopedia-usability`. The exact published head and terminal CI belong in the draft PR handoff. Independent review remains required; this is local MVP interface work, not a release.

## Direction and bounded changes

Read the project frontend standard and existing reference-library proposal/specification, README, decisions and product specification. No separate brand-brief file was present. Preserve the existing cream paper, green/rust accents, Georgia/system-sans typography and restrained reference-library character. No identity decision, marketing section, new route, font download, dependency or framework is introduced.

- Article title precedes mobile contents. A native disclosure follows the title/actions on mobile and opens as a sidebar on desktop; without JavaScript it still opens through its native summary.
- Article actions make sources, revision history and contribution options visible near the title. History still uses an exact verified Git commit. Contribution options retain the closed-intake explanation.
- Desktop prose is bounded to 68ch (646px measured at 1440px), with 19px serif text; mobile uses 18px text within the column. Source context, revision metadata and contents links are more legible. Original code bytes soft-wrap within the reading measure.
- Header search is labelled and at least 44px tall, with visible navigation on mobile. There is no JavaScript-only menu. Search exposes busy/empty/error/success states, preserves its fragment query for retry and keeps all twenty browse links available.
- Admin controls explain loading/disabled requirements and show local feedback as well as the existing live status. Reloading saved notes preserves draft text. Confirmed saves/revocations remain confirmed after a failed list read; the list is marked unavailable/out of date. A superseded older read cannot overwrite a newer list or operation confirmation. Revoked controls remain disabled if the follow-up read fails.

All twenty original Markdown files and both package files are byte-identical to PR33. No backend authority, daily quota, identity, publication, source/release pin or account privilege changes. The retained delayed approval-response cases still protect newer text, citation, confirmation and selection. Old lost drafts/poisoned stores are not repaired by this change.

## Actual browser inspection

Baseline and after captures use the actual twenty-entry Astro/Pagefind build through local Wrangler, plus the shipped admin Worker/real local D1 behind test-only signed assertions and controlled GitHub responses. Main still contains the separately merged three-entry source. Captures are not a live site or a build/deployment of remote main.

| View | Before | After |
|---|---|---|
| Desktop article | [Before](usability-before/article-desktop.png) | [After](usability-after/article-desktop.png) |
| Mobile article/code | [Before](usability-before/article-mobile.png) | [After](usability-after/article-mobile.png) |
| Mobile long title | [Before](usability-before/long-title-mobile.png) | [After](usability-after/long-title-mobile.png) |
| Desktop navigation/library | [Before](usability-before/library-desktop.png) | [After](usability-after/library-desktop.png) |
| Mobile navigation/library | [Before](usability-before/library-mobile.png) | [After](usability-after/library-mobile.png) |
| Desktop search | [Before](usability-before/search-desktop.png) | [After](usability-after/search-desktop.png) |
| Mobile admin | [Before](usability-before/admin-empty-mobile.png) | [After](usability-after/admin-empty-mobile.png) |
| Desktop admin | [Before](usability-before/admin-empty-desktop.png) | [After](usability-after/admin-empty-desktop.png) |

Also inspected actual [loading search](usability-after/search-loading-desktop.png), [list failure with a retained draft](usability-after/admin-list-error-mobile.png), and [confirmed save with unavailable list](usability-after/admin-confirmed-save-list-error-mobile.png). Geometry is recorded [before](usability-before/geometry.json) and [after](usability-after/geometry.json): mobile search grows from 18px icon height to a labelled 44px target; the tool-use title moves from 385.8px to 266.4px from the viewport top. Screenshots captured before the candidate commit show the current working interface with original article blobs pinned to PR33; exact-head CI rebuilds source and retains its own screenshots/artifact.

## Verification and failures

Use the exact locked Node 24.19.0/npm 11.9.0 dependencies (`npm ci`) in a normal checkout. Run `npm run validate`, then the ten reading/editorial/integration/publication/combined/wiki/SEO/corrections/hosted/admin browser commands, both native persistence commands, `npm run staging:check` and `npm run runtime:check`, sequentially. The command-level results are in [validation evidence](usability-validation.json). New coverage lives in `tests/browser/usability.spec.ts` and the existing admin browser suite; no separate test service is installed.

The first full reading run passed 73/74 and identified a serious `scrollable-region-focusable` violation on mobile tool-use code. The larger code font plus corrected column containment exposed horizontal scrolling. The fix preserves the code and larger font while soft-wrapping within the column. Four focused desktop/mobile accessibility/no-script checks passed, followed by the final retained run. [Failure and fix](usability-first-reading-failure.json) are retained; the original local trace is in the actual Git directory. No assertion, axe rule, retry count or timeout is relaxed. This has no bearing on the unrelated earlier unexplained aggregate axe timeout in historical review evidence.

The capture harness initially encountered a stale local preview after rebuilding and an occupied local port. Those attempts are not acceptance evidence. A clean owned-preview capture completed after the fixes; logs remain in the actual Git directory. The final browser checks start and stop their own local services.

Coverage includes all 24 ordinary page audits on desktop/mobile, real Pagefind for every genuine entry, keyboard skip/search/contents/article actions, reduced-motion scroll behavior, no-JavaScript reading/citations/contents/browse, and geometry at 320/390/768/1024/1440px. Admin tests use real workerd/D1 and controlled failures, delayed responses and signatures; these do not verify a live gateway or live GitHub deployment. Automated axe checks are partial accessibility evidence; Safari/Firefox and assistive-technology testing are not performed. Local Chromium is 154.0.8037.57; CI separately selects and reports package-pinned Chromium 156.0.8078.4.

## Remaining gates and rollback

Independent candidate/source review, accepted main integration and PR33's protected-environment/scoped-credential/bootstrap/provider validation remain separate. No live workflow dispatch, merge, deployment, secret/account setup, service purchase, paid/model call, indexing submission, advertising activation or license choice occurs. Keep release enablement and public contributions closed.

Code rollback is the preserved PR33 head. UI changes need no migration. Preserve validation metadata and source heads; existing resources and interactive editorial state are untouched. Publication receipts, retained artifacts, cost enforcement and provider setup retain their documented limitations.
