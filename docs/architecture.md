# Proposed architecture and inventory

Status: design proposal; no infrastructure provisioned by this change.

## Read path
Markdown content with validated front matter → static Astro build → Cloudflare Workers Static Assets → reader. Generate a Pagefind index during the build. Prefer static assets and CDN caching; reading/search must not invoke an LLM. Validate compatibility and current provider constraints before selecting final tooling.

Suggested article metadata: stable id/slug, title, summary, cluster, related article ids, source records, author/reviewer, published/modified/verified dates, and revision summary. Sources include URL, title, publisher, accessed date, applicable version, and claims supported. Preserve stable URLs and redirects.

## Write and discovery paths
- On-site edit/source proposal → bounded validation and moderation → issue or draft change → review → Git commit → build.
- Scheduled discovery → allowlisted sources and conditional fetching → deduplication/content hash → bounded extraction and optional model call → evidence-linked proposed diff → review.
- Never auto-publish unreviewed model output. D1 is optional for queues/submissions if GitHub alone is insufficient; do not provision it preemptively.
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
