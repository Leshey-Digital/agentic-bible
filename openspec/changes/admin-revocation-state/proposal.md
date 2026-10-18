# Approval state across saved-list replacement

Independent review of preserved successor `99b565a8bb0a1666ccd210398f927d3f20cbae8f` finds that per-row closures lose pending/confirmed revocation when an older successful list read replaces the row. A later confirmed revoke and failed refresh then leave the replacement row approved with enabled controls.

Retain operation ownership and monotonic revocation by approval ID across renders. Reconcile older list results with intervening mutations and paint the current view. Preserve existing draft/input ownership, backend authority, source/article bytes, quota and release code. This is a focused browser-state correction, with no resource, dependency, paid-call or identity change. Existing server revocation remains authoritative; no existing GitHub draft is closed automatically.

Verification holds three completed controlled Worker responses independently, including revoke only after durable D1 commit, replaces the row, fails the follow-up read and releases the old proposal last. Preserve desktop/mobile red evidence and rerun retained checks. Independent review and publication authorization remain separate. Rollback is the preserved predecessor; no migration is needed.
