# Tasks

- [x] Reuse current inbox, correction and integration controllers.
- [x] Add fixed target selection, write-only clearing and fail-closed controls.
- [x] Display controlled/provider/unverified connection evidence and disabled Jev check.
- [x] Add bounded publication-status presentation and contextual navigation.
- [x] Extend actual local workerd/D1 desktop/mobile browser coverage.
- [x] Run focused browser, type and documentation checks; record actual results below.
- [ ] Independent exact-head review and full composition qualification.

# Verification

- `npm run check`: passed; 182 files, zero errors/warnings/hints.
- `npm run test:docs`: passed; 365 Markdown files, 388 relative file links.
- `git diff --check`: passed.
- `npm run test:production-hosted:browser`: passed, 2/2 desktop/mobile scenarios against actual local workerd/D1 with signed synthetic access, encrypted synthetic vault and controlled outbound transport. Covers retained contribution review/draft path, separate GitHub/Jev storage, mask/DOM redaction, controlled-result labels, zero additional Jev outbound requests, lost committed rotation response/reload, renewed confirmation after explicit status reload to a changed revision, unknown-evidence closure, owner denial, publication failure, keyboard focus, axe and no overflow.
- Actual screenshots retained privately in `.git/admin-setup-ui-{1280,390}.png`, `.git/admin-setup-ui-jev-{1280,390}.png`, and `.git/admin-setup-ui-fail-closed-{1280,390}.png`; mobile and desktop layout inspected.
- These are controlled local checks, not evidence of live provider credentials, production identity, monetary enforcement, publication or deployment. Full exact-head composition qualification and independent review remain pending.

# Rollback

Revert the integration UI and inbox navigation changes and matching focused tests/change record. No resource, live identity, credential, production state or article content was changed by this UI lane.
