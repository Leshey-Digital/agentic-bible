# Added local requirements

- Supplied revision events use a bounded, exact schema with explicit base revision, source bibliography, resolvable citations, known article crosslinks and allowed quality concerns. Raw HTML, unsafe URLs, missing sources/citations, invalid dates/IDs, unknown fields and stale revisions are rejected with stable technical reasons and no publication side effect.
- Valid revisions automatically become readable HTML and searchable content. Quality concerns appear in a post-publication review queue and immutable revision metadata; they do not block technically valid publication.
- Each completed snapshot has content-addressed input revisions, deterministic state and a file-hash manifest binding HTML/search/history/flags/assets. The active pointer changes only after the full snapshot is built, synchronized and validated.
- Identical event retries return the original receipt without a new revision/snapshot; different reuse conflicts, including after rollback. Concurrent writers serialize or return a retryable busy reason. Process interruption before activation preserves the previous complete snapshot; a retry resumes safely. Old pinned pages keep their matching search index.
- Rollback requires the expected active snapshot and an ancestor target. It restores that article/search state atomically while retaining readable history, event receipts and the rollback action. Corrupt/incomplete artifacts fail closed.
- All outputs stay isolated from source articles and deployments. The preview accepts only loopback read requests; no HTTP mutation/authentication/credential path or live model/source fetch is introduced.

Acceptance covers malformed content/citations/crosslinks, escaping, deterministic artifacts, replay/conflicts, stale/concurrent operations, interrupted publication and restart, previous revisions, actual Pagefind search before/after/rollback, post-publication flags, desktop/mobile accessibility and existing application regressions.
