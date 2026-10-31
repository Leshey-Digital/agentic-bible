# Collector delta

- Default off. Explicit matching server/build policy revision and opt-in are required. Declined/revoked consent, DNT/GPC, private routes and non-production origins produce no collection.
- Same-origin POST only, JSON, maximum4096 streamed bytes/eight events. Exact schema/version and finite projections; reject unknown keys or raw values before reserving quota.
- Reserve the entire batch atomically before dispatch. Trusted hourly/monthly caps and clock high-water stop concurrency/rollback abuse; unknown dispatch/counter failures retain allowance. No retries/refunds.
- Native Analytics Engine uses fixed ordered labels/counts, no identifiers.202 means submitted-unconfirmed, not saved. Missing bindings or invalid policy fail closed.
- User choice is a policy-versioned boolean preference only, never a visitor ID. Revocation clears pending data. A separately approved build is required to display controls/install transport.
