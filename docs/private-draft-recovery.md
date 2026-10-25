# Private draft recovery checkpoint

This candidate fixes a demonstrated source → budgeted draft → private inbox failure: a generated result survived in `maintenance_proposals.packet` but the inbox bridge lost its validated context when saving failed. Original-key replay could only encounter the already-used source attempt.

The new `hosted_draft_outbox` table records the signed owner and exact selection before source acquisition. It checkpoints the complete validated prompt, its SHA256, maximum output tokens and derived generation ID before inference. Prompt/source/article pins become immutable. The existing paid ledger remains the only response, usage and monetary authority.

The initial request still attempts to save the labelled unverified suggestion. If saving fails, the editor uses its retained request ID in **Recover saved result to inbox**. POST `/api/admin/drafts/recover` accepts only `{requestKey}` and requires the existing signed-admin and same-origin protections. It has no source/model port and works without an active AI adapter or a currently valid AI price window. It validates the retained historical currency chain and settled paid packet, reconstructs the pinned draft with the same output checks and writes through the existing bounded inbox/audit transaction. Simultaneous recovery and lost committed responses return the same row. Recovery is private review intake; it never approves or publishes.

Missing/uncertain paid results remain unavailable and retain all holds. A source-only receipt cannot substitute for paid usage. The checkpoint cannot rescue older attempts that lack their prompt. No synthetic acceptance note is edited or promoted. Integrity checks do not establish factual correctness, source authenticity or licensing.

The UI displays the request ID and stores only that ID in browser local storage when available. An editor can copy it or enter it after reload; only the owning signed identity can recover. Storage failure does not prevent manual entry. Draft text and prompts are never stored in browser storage.

## Verification

Focused deterministic commands:

```
node --test tests/hosted/cloudflare-drafts.test.mjs tests/hosted/cloudflare-draft-inbox.test.mjs tests/hosted/cloudflare-draft-errors.test.mjs tests/maintenance-adapters/sourced-draft.test.mjs
npm run check
npm run test:docs
npm run test:hosted
npm run test:maintenance-adapters
```

Tests use disposable actual local workerd/D1, controlled original HTML and fake Workers AI outputs. They cover failed inbox writes and checkpoint writes, real restart, lost committed response, parallel recovery and generation claims, expired policy with disabled generation, foreign/expired/unsigned/cross-origin identity, malformed request bodies, retained-prompt/output/history tampering, unknown usage holds, missing schema, sixteen-row capacity and UI request-ID reload. No live provider or source is contacted. Full composition qualification, browser screenshots, live migration and deployment remain separate checks; consult the final handoff for actual command outcomes.

[Local command outcomes and the retained failed-run caveat](review/private-draft-recovery.md).

## Resources, migration and rollback

Apply additive migration `0027_private_draft_outbox.sql` only through separately authorized resource promotion. Runtime code never creates schema. Missing migration stops before source acquisition. At most sixteen lifetime requests retain an at-most-8192-byte prompt and bounded metadata; pre-AI failures also consume a retained claim. No deletion, refund, reset or archival endpoint is added. Future capacity/retention work must preserve existing request and spend authority.

Revert the application commit to roll back code while retaining the outbox, inbox and paid accounting tables. The former application cannot recover unsaved new checkpoints and must not regenerate their requests. Do not drop evidence tables or rewrite paid receipts. This implementation makes no live resource, policy, credential, article, GitHub or release change.
