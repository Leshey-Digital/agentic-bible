# Product specification

Status: product requirements and proposed acceptance scenarios, not implemented functionality. Detailed scope/stack proposals are tracked in [decisions](../../docs/decisions.md) and [roadmap](../../docs/roadmap.md).

## Sourced knowledge
Readers can understand an AI-agent topic, inspect sources, follow related topics and see revision context.
- Given an article, its substantive claims link to supporting evidence, version/date context and uncertainty where relevant.
- Given a correction, the reviewed revision preserves provenance and history.

## Reading and search
Reading and search favor static delivery and require no paid inference on reader requests.
- Given a query, show relevant local results or a useful no-results state.
- Given keyboard/mobile navigation, content and controls remain usable.

## Proposals and updates
Founder decision, 2026-10-16: automatically publish articles and flag those needing human admin review after publication. This supersedes the initial proposed universal human prepublication review. Enforce technical validity, malicious-content rejection, evidence requirements, reversible revisions, budget limits and escalation; model confidence alone is insufficient. Code/deployment review remains distinct. The pipeline is not implemented in the first static slice.

On-site proposals and GitHub contributions enter a reviewable process after contribution terms are resolved.
- Given untrusted input, validate and moderate it without execution or direct publication.
- Given a detected source change, produce an evidence-linked draft within the approved budget.
- Given an exhausted or unknown budget, stop paid work safely and report why.

## Discovery and measurement
Legitimate search-engine discovery and privacy-aware Google/Microsoft/AI visibility measurement are first-launch requirements.
- Given unavailable metrics, show an explicit gap rather than zero.
- Given a preview, prevent indexing and exclude it from public sitemaps.

## Monetization
Reserve optional provider-neutral ad placements with no active ad network by default.
- Given ads disabled, send no ad/tracking requests.
- Enabling ads requires a separate decision and validated privacy/performance implications.

## Admin editorial and integration controls (approved direction, not implemented)
- Provide an in-app editorial inbox/review queue and designated editorial@agenticbible.si escalation destination; delivery configuration is pending.
- Allow a human admin to independently insert and edit tags with audit history.
- Validate analytics-provider IDs. Do not accept arbitrary executable scripts as ordinary settings.
- Handle API keys through authenticated server-side write-only setup with masked status, scoped connection tests, budget controls and redacted audit events. Never expose credentials in browser responses, static bundles or logs.
- Admin identity and persistent credential provisioning require specific setup approval. Open-source direction and the $10 operating target are accepted; specific licenses and numeric Jev allocation remain undefined.
