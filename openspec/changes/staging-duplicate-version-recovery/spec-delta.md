# Changed release recovery requirements

- Given pinned Wrangler creates two versions with the exact candidate/request marker after dropping a response or returning 500, and the process is killed before recording its version ID, the same UUID/plan recovers without creating another version.
- Validate every matching version's exact UUID, full request marker and ASSETS-only bindings before choosing. Reject conflicting detail/list markers, duplicate IDs, excessive matches and full/truncated history before activation.
- With no successful CLI return, durable selection or own active selection, choose the lexicographically lowest version UUID independently of provider list order. Reuse a journaled or this operation's already-active version only if it belongs to the validated match set. Fail if the durable selection disappears.
- Preserve source/CI/target/expected-active and exclusive-writer boundaries, candidate inventory/hash/provenance validation and complete served-byte/runtime validation. A completed journal is historical and never reactivates on replay.
- Actual package-pinned CLI tests use only a controlled loopback provider and synthetic credentials. Test interruption, replay, conflicts, source/active changes and served corruption; distinguish those results from live provider evidence.
