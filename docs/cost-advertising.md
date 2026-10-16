# Cost and advertising controls

Policy proposal for implementation; no billing plan, cap, paid job, or ad provider is enabled by this document.

## Spend
Founder direction allows a lean Workers baseline around $5/month and occasional few-dollar overages. Verify actual current pricing and account entitlements before deployment. The proposed $10 target is unresolved, not approved.

Before enabling paid automation, record approved per-run/day/month numeric caps, currency, provider/model, token/request limits, concurrency, schedule, alert recipients and stop behavior. A missing cap means paid automation remains disabled.

Required implementation controls:
- Static reading and search; no model call per page view.
- Deduplicate and hash sources, cache results, limit input/output, cap retry attempts with backoff and timeouts.
- Reserve estimated maximum call cost atomically before dispatch; reconcile actual usage afterward. Use conservative pricing and stop on unknown pricing or accounting failure.
- Enforce run/day/month job and spend limits across concurrent workers; cap outbound fetch sizes and recursive discovery.
- Fail closed at the cap. Disable scheduling on unexpected spend; retain queued proposals for deliberate resumption.
- Separate alerting from enforcement. Billing alerts alone are not hard spending controls; vendor caps may omit charges or arrive late.
- Track infrastructure, model, storage, egress, analytics and CI cost separately. Implement rate limits against abuse and verify available platform limits.
- Test duplicate jobs, retries, timeout, concurrency and cap exhaustion without real paid calls.

## Advertising
Design provider-neutral labeled slots with stable dimensions to avoid layout shift, but render no ad scripts or tracking requests while disabled. Keep content readable when a slot is empty, blocked, or loading.

Activation requires a separate founder decision based on traffic, expected revenue versus operating cost, provider eligibility, editorial suitability, consent/privacy requirements, accessibility and performance. No provider selection or revenue claim is implied. Ads and sponsored material must be clearly identified and cannot influence article conclusions. Support a global off switch and per-placement rollback.
