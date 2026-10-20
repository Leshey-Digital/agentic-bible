# Roadmap and acceptance criteria

The founder accepted the MVP scope on 2026-10-16. Implementation remains incomplete except work evidenced in each PR. The first local reading/search slice is on its feature branch.

## 0. Repository foundation
- Review linked docs, status labels, internal links and license hold.
- Establish current specs/change workflow, PR checklist, resource inventory and release checklist.
- Resolve licensing before inviting third-party contributions. No merge or deployment is implied.

## 1. Three-article vertical slice
- Validate stack; add pinned toolchain, lockfile, documented local commands and CI.
- Pick three representative articles; each has verifiable primary sources, dates, related links, revision history, and clear uncertainty.
- Build accessible responsive reading, navigation and local static search; verify empty/no-result queries, keyboard navigation, broken links, narrow screens and repeated navigation.
- Demonstrate one on-site source/edit proposal through moderation to a reviewed revision using synthetic data. Gate public submissions until terms, privacy and abuse controls are ready.
- Future pipeline: demonstrate one budget-limited discovery/update run with technical and source validation, automatic publication and post-publication review flags. Verify timeout, duplicates, rate limits, budget exhaustion and rollback; no paid pipeline is enabled in the current slice.
- Verify sitemap/canonical/robots behavior and measurement taxonomy; show real metrics or explicitly unavailable states, never fabricated dashboards.
- Build an isolated preview only after deployment authorization and inventory review. Prove prior-artifact rollback.

## 2. Accepted MVP scope: 20 articles / three clusters
- Founder confirms the article list and clusters; all meet the same editorial acceptance criteria.
- No orphan articles; validate internal references, citations and redirects. No thin programmatic pages.
- Validate performance and accessibility with measured evidence on representative mobile/desktop pages.
- License/submission terms, moderation, private reporting, retention, and operating budget are approved before public launch.
- Monitoring reports failures and budget stops; repeated jobs are idempotent. Ads remain disabled.

## 3. Launch and learn
- Verify production origin, resource isolation, billing controls, backup/rollback, search-console ownership and release evidence.
- Submit sitemaps and eligible IndexNow updates only through authorized accounts/protocols.
- Review observed indexing, readership, search quality, source freshness and costs; separate observations from gaps.
- Implement the approved automatic publication policy with post-publication human review flags, measured factual/source checks, malicious-content rejection, escalation rules, reversible revisions and an off switch. Do not impose a universal human editorial prepublication gate. Code/release review remains separate.
- Consider ads or TypesafeJev only via a scoped proposal with consent, cost and editorial review.

No milestone promises rankings, indexing, AI citations, traffic, or revenue.

## Next admin slice
- In-app editorial inbox/review queue, with editorial@agenticbible.si as the designated destination; do not claim email delivery exists.
- Independently editable tag fields and revision/audit history.
- Validated analytics-provider IDs; no arbitrary script setting.
- Authenticated server-side write-only API key setup, masked status, least-privilege connection tests, budget controls and redacted audit events.
- Decide specific admin identity and credential provisioning, code/content licenses and numeric Jev allocation before enabling those integrations.


## Dated private-editor milestone — 2026-10-20

- [x] Real authenticated staging editor reached the private inbox, reviewed pinned tool-use source, saved a labelled synthetic note and verified persistence after full reload. This is parent-reported browser evidence; see [acceptance](review/admin-capability-navigation/deployed-20261020/browser-acceptance.md).
- Next bounded milestone identified, not started: [recoverable GitHub draft integration](review/admin-capability-navigation/next-milestone.md). Runtime GitHub authority remains a separate decision. Public intake, paid AI and production changes are not enabled by this milestone.
