# Added saved-review article revision preview

- Explicit signed, same-origin POST `/api/admin/submissions/<id>/revision-preview` accepts exactly `{approvalId}`. Only a current owned submission-bound review can produce a revision; stale/revoked/unrelated/foreign reviews, request-supplied Markdown and GET requests fail closed.
- Source comes only from the trusted immutable build review port. Match article/content path, exact base commit/hash and declared citation membership. No GitHub/source/model port is called by the action.
- Use the existing GitHub reviewed-correction projection to produce complete proposed article Markdown and its hash. Preserve every base byte and source declaration; include the same citation and opaque review/contribution provenance. Return an exact applyable diff including correct final-newline handling.
- Recheck current review and fresh identity/cancellation after asynchronous source/projection work. Revocation or a newer submission revision cannot yield a usable stale preview.
- Preview/replay/restart performs no D1 mutation, outbox admission, spend change, publication approval or canonical change. A controlled existing GitHub proposal for the same base/review must produce byte-identical article Markdown.
- The inbox exposes preview from current saved review history. Display Markdown/diff as inert text, retain newer editor text, reject responses superseded by selection/history/disposition changes, and remain usable at desktop/mobile widths.
