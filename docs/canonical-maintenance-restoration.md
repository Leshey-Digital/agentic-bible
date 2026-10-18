# Controlled canonical restoration

This separate successor composes restoration checkpoint `8353a65eacee0c061978b8dcfa6c037c4091b4a2` with frozen PR40 Reload correction `52ef32c3503e86549f1d1f08bbf92d7574aed13a`, both descending from history/review PR39 `a255d81d4d08bdcd0a60a8916d514068e1373bec`. Both source heads remain unchanged; their review status does not establish independent acceptance of this composition. PR39 remains request-only and unchanged. This branch adds an explicit approval and a local controlled coordinator that can append a real Git restoration commit in owned test repositories. It does not enable a live canonical write route, provider, credential or deployment.

## Authority and operation

A `revert-requested` audit is still only a request. The signed admin must separately POST `/api/admin/maintenance/restore-approval` with `approvalId`, `requestId` and `confirm: approve-canonical-restoration`. Existing origin, CSRF marker, RSA assertion and compiled-catalog verification apply. The approval belongs to the same admin as the immutable request and must select the current receipt/catalog/source commit plus an earlier retained target. A newer decision on that receipt supersedes the approval. No decision is silently upgraded into write authority.

Migration 0014 creates immutable approvals and append-only revocations, capped at sixteen approvals. Replay uses exact original owner/input and timestamp; stored request, approval and fingerprints must agree. Before dispatch, revoked, expired, superseded or stale authority stops. Review still follows ordinary automatic publication; this extra approval is specific to an intentional restoration.

`restoreMaintenanceRevision({approvalId}, context)` is a trusted server/local function. The principal comes from the signed verifier, never request JSON or a client role flag. Context paths/transport are trusted code. `enabled:true`, an actual approved D1 row and the existing controlled-GitHub fixture port are required. There is no default fetch or credential adapter, and no shipped HTTP route invokes this coordinator. The normal approval response explicitly says `canonicalDispatchEnabled:false`.

The coordinator verifies pinned old/current/target Git records and application blobs. The exact approved source commit must still be the branch head; even an unrelated later edit needs a fresh review/source pin. GraphQL's expected-head guard protects the single atomic commit against movement after the final check. It restores the target body and original source metadata through a new revision ID, adding new approval/lineage metadata and retaining target flags plus editorial/source-recency follow-up. It never refreshes old source dates or invents a new model generation, source observation or factual approval.

Exactly three files change together: tool-use Markdown, a new immutable restoration history record and the current review pointer. The record identifies the immediate previous revision and restored-from revision/commit/receipt, including when the target is an earlier restoration. Every old record and unrelated path remains intact. Git is canonical; D1 stores private authority/outbox data, not an article-serving overlay.

## Interruption and replay

Restoration reuses the canonical outbox's sixteen-row global admission/lease and forty-request lifetime, sixteen-request invocation, response/body and time bounds. Rows progress through preparing, immutable intent, dispatched and complete. A known durable intent resumes after restart or process death; tests kill the owned process group after actual D1 intent and advance only the local test clock to expire its lease.

There is one mutation dispatch. Lost or late applied responses and a lost D1 completion reply reconcile actual Git history without another mutation. Once dispatched, an unproved outcome remains unconfirmed; a crash between marking dispatch and sending it cannot safely be distinguished from an applied-but-unobserved request. The coordinator does not blindly retry that mutation or claim success. These conservative ambiguity limits are not a remote exactly-once guarantee.

Revocation immediately before dispatch prevents the mutation. Revocation after an already applied effect cannot undo it; reconciliation records the actual historical outcome. Completed replay validates its cached receipt against actual Git objects without remote requests and never rewinds a newer head. A forged cached commit fails even if its stored hash is recomputed. Missing historical objects fail closed without lazy fetching.

## Reading, publication and remaining gaps

The strict reader supports both the unchanged automatic record profile and the new restoration profile. It verifies canonical record bytes, creation commit/parent/message, the atomic file set, target/previous lineage, exact derived Markdown and current pointer. Static history, diff, article attribution and flags remain noindex and preserve older source dates. Restored source summaries inherit from their actual target, without fabricating new source or generation accounting.

A controlled test gateway exercises signed approval, the explicit local coordinator, real Git commit, actual Astro/Pagefind rebuild and new catalog binding while preserving the private D1 audit. Its control endpoints are loopback-only test code and absent from deployment configurations. No UI click or approval endpoint alone performs a live restoration.

Real GitHub transport/protections, deployment, identity/D1/secret setup, production record profile, notification delivery, actual monetary enforcement and live release ingestion remain unconfigured/unverified. The controlled transport and local Git object store deliberately do not establish live provider compatibility. After restoration, future automatic generation must reconcile its technical canonical/publisher base; this successor does not silently rebase the private producer or add a human approval gate to ordinary valid articles.

Rollback now means returning application code to frozen PR40; no remote migration/resource was applied. If restoration records are ever enabled live, an older reader will reject the new profile, so downgrading code needs an independently reviewed format-aware plan. Never erase a canonical restoration record or reset Git to disguise its history.

## Reproduction and evidence

Use the pinned Node 24.19.0/npm 11.9.0 and existing locked dependencies. `npm run test:maintenance-restore` runs actual signed/workerd-D1/owned-Git authority, stale/CAS/atomic, revocation/supersession, restart/response-loss/process-kill, budget, tamper and historical replay cases; it is included in `validate`. `npm run test:maintenance-restore:browser` verifies desktop/mobile restoration and rebuilt history, source dates, private audit, axe, overflow and zero external browser requests. Full validation, all retained browsers/Worker restarts, both dry runs and clean release preparation are recorded at the final exact head in `.git/canonical-restoration-handoff.json`.

The first restoration browser attempt omitted the explicit Origin/request marker on a direct API test call and correctly received 403. The harness now sends the normal same-origin headers; the foreign-origin case remains denied. No assertion or timeout was weakened. Initial full local proof logs and any corrected failures remain separate from the final exact-head results. The restoration draft records the actual final-head CI run, package-pinned browser and retained artifacts after publication; local results alone do not establish terminal CI or independent acceptance.

Focused implementation evidence includes eighteen native cases and two desktop/mobile browser cases. These include an actual killed process group after durable intent, a late applied mutation after the client deadline, D1 completion-reply loss, CAS movement after the last client check, three successive restorations with an earlier restoration as target, and Git-backed rejection of a forged cached commit. Initial pre-checkpoint logs are not substituted for the final exact-head matrix.
