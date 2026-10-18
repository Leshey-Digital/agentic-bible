# Report expired HTTP jobs accurately

Independent review of PR12 `b78751b4f4db09fcce4289052f7e163ac4be9c5b` reproduced a running job whose lease expired while its daily budget was exhausted. Claim correctly abandoned the old reservation and performed no fetch, but status still said busy/http_in_progress because it checked only the persisted state label.

Require an unexpired lease for busy status and use the durable action's trusted clock for status reads. Preserve blocked reason codes, replay receipts, all claim/completion SQL, retry limits, concurrency, storage bounds and conservative accounting. Add actual local workerd/D1 coverage across lease expiry, restart, UTC-day rollover and persisted retry backoff. Test-only clock injection must remain outside application/deployment entries.

Use a separate branch directly from immutable PR12; preserve PR12/PR13 and publication code. No route, schema, dependency, allowlist, scheduler, credential, paid call or cloud resource change. Publish a focused draft under the owner's project publication authorization after local validation; no merge or deployment. Numeric monetary enforcement and native DNS pinning remain outside this bounded correction. Rollback reverts this source/test/docs commit; no migration or data reset is needed.
