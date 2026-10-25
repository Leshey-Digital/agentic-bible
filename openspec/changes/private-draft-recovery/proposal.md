# Recover private AI drafts without regenerating

The inbox bridge previously discarded its validated result when the inbox insert failed. Its original-key replay then reached an already-used source attempt and could never retrieve the already-paid draft. The existing maintenance accounting packet already retains prose and settled usage; duplicating that response or introducing another generation service is unnecessary.

Add an owner-scoped, immutable pre-dispatch checkpoint containing the exact validated prompt and generation identity. Claim the selection before source acquisition, checkpoint the validated prompt before inference, and keep the current automatic initial inbox save. An explicit authenticated request-ID recovery action reads the existing settled paid result, checks its historical currency authority and exact source/article/generation pins, validates the output again, and idempotently saves the private inbox suggestion. The private UI preserves the request ID across reload when browser storage is available.

Scope is one private draft-to-inbox boundary. Recovery never acquires sources, calls a provider, approves, publishes, refunds, renews policy, retries an uncertain generation or repairs old synthetic records. Existing automatic article publication policy remains unchanged. No live bindings, migration, source calls, paid calls, release or deployment are performed.

Migration 0027 is additive and required before the new inbox generation path can dispatch. Sixteen lifetime checkpoint rows match the current paid-ledger bound; each retains at most 8192 prompt bytes. Failed pre-AI requests retain their claims. Cleanup/archival and recovery for historical attempts lacking this checkpoint are separate work. Missing schema fails before source/AI calls. Rollback preserves the new table and paid ledger; an old application cannot recover these unsaved requests and must not regenerate them.

Independent exact-head review and full composition qualification remain required before any live promotion. No new provider allocation or infrastructure service is proposed.
