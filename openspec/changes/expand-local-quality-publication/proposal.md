# Proposal

The quality-gated local publisher already admitted new supplied article slugs, but its collection cap of twenty still matched the older canonical inventory. That made the out-of-set lifecycle impossible to exercise past entry twenty. Raise the local collection cap to 31 while retaining the 32-operation ledger's final rollback slot, and add a test that publishes 21 IDs, revises one, and rolls back while retaining its history.

The production runtime also needs a truthful distinction between compiled Jev transport/admin setup and an actual hosted dispatch composition. Add a server-only injectable factory for the typed adapter and charged D1 authority, with explicit `unconfigured`, `disabled` and `configured` states. Expose the current runtime as `not-mounted`; do not turn on dispatch or provider connectivity claims while the secret resolver, approved currency limits and token bounds are absent.

## Scope and non-goals

This changes only local collection capacity, its regression test, runtime status reporting, and current production-gap documentation. It does not change the canonical writer or the fixed twenty-article Astro/release inventory; it does not add a Jev route, call provider APIs, fetch source material, configure credentials, enable Actions, or deploy.

## Dependencies and decisions

The local workflow retains finite limits of 32 revisions, 32 committed operations, one reserved rollback operation, 8 MiB per artifact and 64 MiB total storage. Owner-provided Jev credential, model, actual price/caps, token bounds, admin trust and explicit activation remain prerequisites for a separately reviewed dispatch composition.
