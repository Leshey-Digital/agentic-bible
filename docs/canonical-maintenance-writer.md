# Default-disabled canonical maintenance writer

This successor preserves source collection `0a24129e34369e887273851b7e4241ec48260548` and frozen admin PR36. It connects a completed, sourced local maintenance revision to an automatic canonical commit through a controlled provider. It creates no PR/article preapproval gate and does not reuse community-correction admin authority. No shipped Worker, route, workflow, credential or real GitHub transport imports/configures it.

## Authority and projection

`writeMaintenanceRevision` requires explicit enablement, a supplied `controlled-github-maintenance-fixture` port, the original producer command, an exact canonical base commit and expected previous article revision. The port label describes trusted local test wiring, not authentication. Repository and branch are fixed to Leshey-Digital/agentic-bible / main; request data cannot choose URLs, credentials, paths, rendering code or a different repository/ref.

The new read-only `completedMaintenance` verifier checks actual D1 generation completion, the original command fingerprint, source/project hashes, current original body files and charged HTTP receipts, the strict fake response/schema/usage, conservative reservation amount, generated packet and actual immutable wiki/publisher receipt. It never invokes a provider, resumes publication or invents an admin approval. Only the existing deterministic extractive synthetic profile is supported. Source freshness stays 24 hours. A pending/stale/tampered/unknown receipt stops before GitHub.

Before a new dispatch the candidate must still be the active complete local wiki/publisher result, with no pending build. This is rechecked around dispatch. Completed canonical receipts remain historical and can be replayed after a later local revision or rollback without restoring either pointer. Local publication state and remote GitHub are not a distributed transaction: a local change after dispatch may coexist with a remote effect. The writer never force-rolls back another writer; operational reconciliation remains necessary.

The existing pure Markdown serializer is shared with the wiki builder. One atomic commit contains exactly:

1. `src/content/articles/tool-use.md`, with complete validated excerpts, citations and explicit synthetic provenance.
2. `src/content/maintenance/history/<event-sha256>.json`, an immutable descriptor binding original receipt/body hashes, producer packet/output/budget, local publication receipt, source tree, base/parent revision and review flags.
3. `src/content/maintenance/tool-use.json`, the current revision/history pointer.

All valid articles retain automatic publication and `editorial-review` flags afterward. The descriptor and Git commit provide immutable canonical history; hosted review inbox/notification and ingestion/display of these new JSON history records are separate future connections. The original GitHub file-history link remains commit-pinned. Existing repository Markdown is unchanged by local tests; only the owned controlled Git repository advances.

## Atomic Git contract

The writer uses GitHub's [createCommitOnBranch](https://docs.github.com/en/graphql/reference/commits#createcommitonbranch) / [CreateCommitOnBranchInput](https://docs.github.com/en/graphql/reference/commits#createcommitonbranchinput) contract: `expectedHeadOid` identifies the required branch head, and one mutation commits all file additions and updates the branch. [FileChanges](https://docs.github.com/en/graphql/reference/git#filechanges) supplies complete base64-encoded bytes. The client mutation ID correlates the response; local idempotency comes from the durable intent and verified history, without assuming that field is an API deduplication guarantee.

The base must have a regular original article, a complete bounded Git tree and no conflicting history record. Its application source, assets, package/configuration and other article blobs must match the tested producer project; only writer-owned article/history projection differs. This blocks writing onto an older three-entry main or an untested changed application. Unrelated files outside the application can advance without being overwritten. A later revision must match a completed writer-owned previous pointer/record and the producer's previous article revision. Human or foreign edits to canonical article/pointer state are conflicts, not automatic rebases. Exactly three fixed paths may change; path ancestors cannot be symlinks/blobs. Full tree validation supports the existing Astro bracket route names.

After a mutation the writer verifies the actual commit's single expected parent/message, complete leaf inventory and exact new blob bytes, and checks its presence in the observed canonical history. Every unrelated leaf remains unchanged. Later unrelated commits can coexist with a recovered historical result. A malicious/incorrect provider effect is detected rather than certified; a client cannot undo or prevent arbitrary writes by a compromised provider.

## Finite outbox and ambiguous outcomes

Migration `0011_canonical_maintenance_writes.sql` adds one table to existing D1. Sixteen immutable event fingerprints are retained. One owner/60-second lease is active across writers. Each event has at most forty charged requests, each invocation sixteen requests, two seconds/request and a monotonic 25-second invocation limit. Responses are capped at 256 KiB, requests at 96 KiB, Markdown/intents at 64 KiB. There is no eviction, refund, retry loop, schedule or reset endpoint. These request/storage limits are not currency enforcement.

Persist the exact intent, then atomically mark the one permitted dispatch before calling the provider. A crash between that marker and network dispatch remains ambiguous even if zero calls actually occurred. Subsequent invocations only reconcile using bounded reads of the unique event history path, actual Git objects and the pinned base. They never repeat the mutation, force a ref, change its base or regenerate. If history cannot prove the outcome, or the request bound is reached, stop for deliberate operator recovery. Completing D1 after a known Git effect may also fail; a durable complete receipt replays without network calls.

## Verification and remaining live setup

Run `npm run test:maintenance-github` (included in validate). Tests use actual local workerd/D1 and a GitHub-shaped controlled port backed by an owned real bare Git repository. Its branch transaction uses actual `git update-ref` with the expected old SHA, including competing-write and ancestor-rollback races. Fixtures use invented original paragraphs, no external retrieval, secrets or paid model calls. A separate test builds the committed canonical Git tree through actual Astro/Pagefind and verifies twenty entries, source text, review flags and commit-pinned file history. [Checkpoint evidence](review/canonical-maintenance-writer.md) distinguishes this from live compatibility.

Live GraphQL/branch-protection behavior, GitHub App identity/credentials, hosting/release integration, JSON-history/review ingestion, provider/tokenizer/rate card and approved currency caps remain unconfigured or unverified. General live-source HTML normalization/authenticity and factual/licensing validation remain absent. This controlled profile cannot authorize real factual article publication merely by adding a token. Independent review and a deliberately designed live authority/transport setup remain necessary.

Rollback reverts the new code while retaining/exporting its outbox and ambiguous operation evidence. Do not reset shared databases or rewrite canonical history to remove a local test checkpoint. No actual origin/main update, remote article publication, deployment, paid provider call, indexing, advertising or license choice occurs.
