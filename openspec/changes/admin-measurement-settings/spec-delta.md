# Added requirements

- An authenticated local admin can save Google tag/GA4 identifiers, Microsoft Clarity identifier and privacy preview controls independently. Missing/invalid/unknown fields, raw scripts, credentials, URLs and unsupported identifiers are rejected without echoing submitted values in errors.
- All mutation paths require existing admin role, exact origin and CSRF token. Remote fixture flags cannot enable the controls. Stored data is revalidated before any projection.
- Each section has its own version. Stale saves do not overwrite newer values; identical request-reference retries create no extra audit event. Settings and audit commit together. Only changed field names, actor, version, timestamp and replay metadata are retained in audit, never submitted values. History is bounded at 1,000 changes and returns 30 events.
- Consent defaults remain denied; DNT/GPC protections remain enabled; advertising cannot be activated. Provider flags only select identifiers for an inert local policy preview. No setting can load an analytics/ad script, send a provider request or grant consent.
- Disabled preview emits no policy template or saved IDs. Enabled preview emits only allowlisted non-secret IDs and fixed denied/off status on selected public local reading pages. Private/admin/API/search/contribution/error pages and query-bearing URLs never receive it. Missing/corrupt settings fail to no preview. Static staging and remote reading remain uninstrumented.
- The dashboard marks integrations, AI visibility and secret setup as unavailable/not connected. There is no secret input, vault, connection success claim, live metric or fake measured zero.

# Acceptance scenarios

Real local Worker/D1 checks save each section, reload persisted values, reject anonymous/reader/CSRF/cross-origin/malicious updates, verify audit and stale behavior, and inspect public HTML/network for off and opt-in fixture policy states. Mobile/desktop axe and overflow checks cover admin controls. SQLite tests cover transactional failure, concurrency, replay, bounds and reopen. Existing editorial/monitoring/reading checks remain green. No merge/deployment.
