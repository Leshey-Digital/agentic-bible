# Decisions and open questions

Last prepared: 2026-10-16. This document distinguishes founder direction from technical proposals; it is not evidence of deployed capabilities.

## Founder direction
- Build a living encyclopedia focused on AI agents and surrounding technology.
- Provide sourced, interconnected articles, reading/search, revision history, on-site edit/source proposals, and GitHub contribution pathways.
- Automatically publish articles and flag those needing review for post-publication human admin review. This supersedes the initial proposed universal human editorial preapproval. Autonomous discovery/maintenance remains the long-term goal. Technical/source validation, malicious-content rejection and cost limits remain required.
- Pursue strong legitimate SEO and measure Google, Microsoft, and AI visibility from the first launch, with explicit measurement gaps and privacy safeguards.
- Be advertising-ready through provider-neutral slots; activation depends on traffic, approval, and economics.
- Keep infrastructure lean: roughly $5/month Workers baseline with occasional small overages. The founder accepted the $10 monthly operating target on 2026-10-16. It is an operating target, not verified pricing or an unlimited spending authorization; enforceable paid-job caps and numeric Jev allocation still need definition.
- TypesafeJev is described by the founder as a funded structured decision model rather than a text generator. No integration is selected or authorized here.

## Additional founder decisions (2026-10-16)
- Open-source direction is approved; specific code and content license texts are still undefined. No license is selected by this repository.
- MVP scope and reviewed merge/staging/production release authority are approved. This slice remains a draft for independent review and makes no deployment.
- Editorial destination: editorial@agenticbible.si plus an in-app editorial inbox/review queue. No email has been sent and no mailbox or admin account is provisioned.
- Admin backlog: independently editable tags; validated analytics-provider IDs; secure server-side write-only API integration setup; connection tests; budget controls; audit history. Secret values must never be returned to the browser, static output or logs. Arbitrary script injection is not a settings field.

## Implementation choices and remaining proposals
- First feature branch implements Astro + TypeScript static pages, Pagefind, Markdown and GitHub file history, with local Workers Static Assets validation. D1 remains deferred until a concrete mutable-data need justifies it.
- The authorized first slice contains AI agent, tool use and Model Context Protocol. The accepted MVP scope is 20 articles across three clusters; the remaining article list is unfinished.
- An OpenSpec-style directory workflow plus AGENTS.md, GitHub issues, and draft PRs.
- Automatic article publication and post-publication review flags are now approved policy. The publishing pipeline, admin review inbox and escalation delivery are not implemented in this static slice. Code review and deployment checks remain separate.
- The next stacked branch implements a local synthetic correction/source inbox with role-scoped test sessions, human-entered suggestion tags, dispositions and audit records. Public intake, production identity, article publishing, email delivery and live settings integrations remain disabled. This is implementation progress, not a change to the automatic-publication policy.
- The measurement-settings branch adds locally persisted non-secret Google/Clarity identifiers, independent admin forms, denied consent defaults and value-free audit. Its optional public policy template is inert and local only: no provider script, tracking, credential setup or ads are activated. Live integrations and reviewed production identity remain unconfigured.
- The source-monitoring branch implements bounded fixture checks and automatic local source-observation metadata revisions with later review flags. This is not article-text generation or a public publication pipeline. Its request/retry/day limits are local test bounds, not actual currency/provider spending caps. Live fetching, cron and Jev/model integration remain disabled pending secure setup.
- The $10/month operating target is accepted. Numeric Jev allocation, per-run/day limits, provider credentials and the enforcement mechanism remain undefined; paid jobs stay disabled until these are concrete.
- A separate local article-publication slice on accepted PR10 renders supplied synthetic cited revisions into isolated HTML/search/history snapshots with post-publication flags and rollback. It does not write canonical Markdown or a public release and is not connected to the source-monitoring transport/event outbox. Identity, factual/licensing validation, full-site publishing, artifact distribution and production cost enforcement remain future work.

## Decisions still needed
- Active zone agenticbible.si was verified in foundation preparation. Canonical production origin and deployment prerequisites remain to be validated. Reviewed release authority is granted; this slice does not exercise it. Isolated staging target: staging.agenticbible.si.
- Code/content licensing and contributor terms before accepting third-party submissions.
- Initial three articles and cluster boundaries.
- Provider/model, approved numeric spending caps, billing alerts, overage/stop behavior.
- Approved analytics providers, account ownership, consent/retention requirements and private security contact.
- Release evidence and launch prerequisites; advertising provider and activation decision later.

Record each accepted decision with date, owner, rationale, alternatives, and the corresponding issue/PR. Never fill approval fields from an assistant recommendation.

Decision record: founder, 2026-10-16; rationale is autonomous publishing with visible human follow-up and lean operating costs. This supersedes the manual-initial-review and unaccepted-$10 proposals at foundation commit aed0712. Do not rewrite that historical PR as if it contained the later approval. Code/content license choices, Jev allocation and admin identity setup remain explicit open decisions.
