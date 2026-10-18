# Proposed delta

- Explicit trusted activation and fixture-kind source/provider/Git/review ports are required; omitted activation has no SQL or external effects.
- One bounded durable job binds exact normalized input, source project, canonical head, private bridge, collection store and simulated policy. Reusing the event with different inputs fails; concurrent incomplete jobs are serialized.
- Reuse existing source/provider/writer ledgers and their conservative ambiguity rules. Stable keys and phase replay do not reset charges or rebase intent.
- A verified canonical receipt leads to a bounded exact-head Astro/Pagefind and release candidate with compiled catalog binding. Ingestion creates no human review row or factual approval.
- One review activation dispatch reconciles actual signed read state; ambiguity is never blindly resent. Superseded canonical heads do not activate older review catalogs. Completed historical replay does not rewind a newer catalog.
- Preserve previous record profiles, flags, article bytes, source reviews and default-disabled deployment/provider gates.
