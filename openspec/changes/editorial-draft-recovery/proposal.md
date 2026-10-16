# Preserve editorial drafts across asynchronous saves

Independent review of PR #3 at `efa15e6fc47931951ea7d617c4a567850435f939` reproduced two client recovery defects: a successful response deletes newer edits, and editing a retained draft after a committed save's response is lost leaves retries in a request-reference conflict loop.

Keep the submitted snapshot distinct from the current draft. Clear only an unchanged successful snapshot; preserve newer edits with their own request reference. Offer an explicit draft-preserving new-reference action after an uncertain response or replay conflict, and persist that recovery state across reloads. A previous version may already be stored; communicate that without automatically submitting another version.

This follow-up branches from the exact reviewed PR #3 head and leaves that branch immutable for stacked work. No authentication, API, storage schema, publication policy, public-intake gate, dependency, paid integration or infrastructure change is required. Reuse the existing local synthetic Worker/D1 harness and session storage. Independent recheck is required before integration; no merge or deployment is performed. Roll back by reverting this follow-up.
