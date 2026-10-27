# Inspect the article revision produced by a saved review

Recovered AI drafts can enter the private inbox and receive an explicit owner/current-submission-bound reviewed note. Existing GitHub proposal code already projects that note into a complete article with a cited, provenance-labelled correction. However, the inbox cannot inspect that article revision while runtime GitHub authority is unavailable. Rebuilding the canonical publishing pipeline or introducing another revision service would duplicate working code.

Expose one explicit, authenticated revision-preview action for an existing saved submission review. Read only trusted immutable build source, validate the saved review's article/base/source pins, and call the same `projectNote` projection as the existing GitHub transport. Return the complete proposed Markdown, its SHA256, an applyable append diff and the saved review/source provenance. Editors can inspect the result from the inbox's existing review history without a GitHub token, source fetch or model call.

Current ownership, submission revision/status, revocation, signed authentication and request cancellation are rechecked after asynchronous work. The action accepts only the saved approval ID; caller-supplied article content cannot replace reviewed authority. A preview never creates a proposal, changes an article, grants publication approval or claims remote main is current. Existing proposal/release controls remain unchanged.

No schema, service, dependency, provider policy, paid hold, draft-outbox capacity, source article or live release change is required. This is a correction-note projection into a full article, not free-form article generation or a new publishing pipeline. Independent review and combined qualification remain separate.
