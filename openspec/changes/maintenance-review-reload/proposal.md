# Recover reload after a superseding save

Independent review of frozen PR39 a255d81d4d08bdcd0a60a8916d514068e1373bec reproduced a disabled Reload button after an older audit read returned during a committed save. Save advances the response-freshness sequence, so the old read correctly cannot paint; its finally block incorrectly used the same sequence to release the button. If the save's follow-up read fails, the UI directs the admin to a disabled recovery action. Another stale save can then leave both buttons disabled.

Keep response freshness and reload-operation cleanup distinct. A reload captures its own operation sequence; only a newer reload takes that cleanup ownership. A save still supersedes older read data/status, but no longer prevents the completed read from releasing its button.

Use an isolated successor from PR39, preserving the larger restoration branch. Add actual shipped-Worker/workerd-D1 desktop/mobile ordering with an audit GET held before save, successful save response held after durable commit, newer draft, old GET release, failed follow-up GET, stale next save and a successful deliberate reload/reconfirmation. Preserve strict assertions/timeouts, canonical bytes/flags, private notes and all backend/source/auth/release/serializer semantics. No migration, dependency, credential, paid call, deployment or article mutation is introduced.
