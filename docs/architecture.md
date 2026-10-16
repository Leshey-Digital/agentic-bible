# Proposed architecture and inventory

Status: the foundation describes the design proposal. The first application feature branch implements local static Astro/TypeScript pages and a Pagefind index. No infrastructure is provisioned. Public submissions, background discovery, analytics, ads, and autonomous publishing remain future work.

The next stacked branch implements submissions and the editorial inbox only in an explicit local synthetic Worker/D1 preview. [The editorial contract](editorial-contracts.md) defines the storage port, routes, local sessions, fail-closed production boundary and test commands. The reviewed static staging configuration is preserved; no cloud D1 resource, identity or route is created.

The source-monitoring branch adds a metadata-derived catalog, bounded fixture HTTP jobs, conditional/hash observations, persisted change candidates and an automatic local metadata-revision ledger with post-publication review flags. [Its contract](source-monitoring-contracts.md) distinguishes this working local foundation from future live fetching, model-generated article changes and public release. No live schedule or provider integration is enabled.

## Read path
Markdown content with validated front matter → static Astro build → Cloudflare Workers Static Assets → reader. Generate a Pagefind index during the build. Prefer static assets and CDN caching; reading/search must not invoke an LLM. Validate compatibility and current provider constraints before selecting final tooling.

Suggested article metadata: stable id/slug, title, summary, cluster, related article ids, source records, author/reviewer, published/modified/verified dates, and revision summary. Sources include URL, title, publisher, accessed date, applicable version, and claims supported. Preserve stable URLs and redirects.

## Write and discovery paths
- On-site edit/source proposal → bounded validation and moderation → issue or draft change → technical/evidence validation → Git commit → build → post-publication review flags when needed.
- Scheduled discovery → allowlisted sources and conditional fetching → deduplication/content hash → bounded extraction and optional model call → evidence-linked proposed diff → review.
- Founder policy, 2026-10-16: automatically publish articles and flag those needing human admin review afterward. This supersedes the initial proposed human publication gate. Technical validity, evidence requirements, malicious-content rejection, reversible revisions, cost limits and escalation must be enforced. The pipeline is not implemented in this slice. D1 is optional for queues/submissions if GitHub alone is insufficient; do not provision it preemptively.
- TypesafeJev integration is out of scope until its interface, utility, permission, and cost are understood.

## Resource inventory template
Populate with verified non-secret identifiers when resources actually exist. Do not store tokens or connection strings.

| Resource | Environment | Identifier/origin | Owner | Purpose | Cost control | Rollback | Verified |
|---|---|---|---|---|---|---|---|
| GitHub repository | source | Leshey-Digital/agentic-bible | Leshey-Digital | docs, future source | n/a for this change | revert commit | 2026-10-16 |
| Cloudflare Worker/assets | staging | proposed: agentic-bible-staging | founder | isolated preview | pending cap | prior artifact | name available; not deployed |
| Domain zone | account | agenticbible.si | founder | potential public origin | pending | no zone changes in preparation | active zone verified 2026-10-16 |
| Database/queue | optional | none selected | pending | only if needed | bounded rows/jobs | backup/migration plan | not provisioned |
| Analytics/search consoles | production | pending | pending | measurement | approved scope | disable collection | unverified |
| Model provider | background | none selected | pending | update proposals | hard ledger limits | disable scheduler | not configured |

Keep staging separate and non-indexable. Production data and unrelated Leshey Digital resources are out of scope. Secret access, account grants, deployment settings, domains, and billing require their own authorized implementation steps.

## Verified staging preparation (2026-10-16)
Read-only account inspection found an active agenticbible.si zone, no Worker-name collisions for agentic-bible-staging or agentic-bible-production, no zone Worker routes/custom domains, and no staging DNS record. These observations must be rechecked before deployment.

Proposed deployment map: repository build artifact → agentic-bible-staging Worker/Static Assets → staging.agenticbible.si custom domain. The exact build output and entrypoint remain undecided until the application exists. Keep apex/production unchanged. Do not add D1, KV, R2 or AI bindings until needed and approved.

Propose workers_dev=false and preview_urls=false to avoid extra public endpoints, subject to validation with current tooling. A custom domain is still public; this does not create private staging. Prevent indexing and choose access control separately if required. No deployment configuration, routes, DNS, or credentials are created by this documentation.

## Authorized next admin work (not implemented)

Build an in-app editorial inbox/review queue, linked to editorial@agenticbible.si once delivery and identity are specifically configured. Admins must be able to independently insert and edit tags. Analytics settings accept validated provider IDs, not arbitrary scripts. API integration setup must use authenticated server-side write-only secret storage: return only masked status/connection metadata, never raw keys; avoid logging request bodies, use scoped connection tests and preserve audit history. Provide budget controls and automatic stop behavior. Selecting/provisioning admin identity or persistent credentials requires the specific setup decision; no secrets belong in Astro public environment variables or static builds.
