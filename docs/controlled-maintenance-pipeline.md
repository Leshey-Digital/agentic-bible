# Controlled hosted maintenance operating pipeline

This separate checkpoint starts from frozen PR42 `20345ad00e059f68a10cd3ceea9f6cc7024e82a4`, under independent review. Inspection found working collection, fake-provider accounting, canonical writer and history/build authorities, but demos stopped at private publication and tests manually connected the hosted review artifact. The new trusted coordinator reuses those pieces; it does not replace them or add a model framework, content overlay or release service.

The twenty original article files remain unchanged and retain their PR22/23/27 source-review acceptance. Licensing, live release approval and review of new generated prose are separate; unchanged source acceptance is not reopened.

## Explicit operating boundary

`runMaintenancePipeline(selection, context)` requires `enabled:true` plus explicit controlled pipeline/source/provider/Git/review port kinds. Missing activation fails before SQL or source/model calls. No HTTP route, cron, credential, real provider or deployment adapter invokes it. The function is a trusted Node runner boundary because the existing publisher, Git verification and Astro build use files and child processes; it is not a Workers page-view job.

Selection fixes one existing tool-use apply command and an exact canonical source commit. The admitted fingerprint binds normalized input, policy, project bytes, repository/bridge/collection/output roots and the exact base. The plan captures the verified canonical receipt when present and the current signed review-catalog identity. A first canonical revision may start from the exact original Markdown; later ones use the existing canonical-base binding, including restoration. No caller receipt or article body becomes Git authority.

Migration 0015 adds one orchestration journal, not another source/provider/writer ledger. It allows sixteen jobs and sixteen explicit attempts, one outstanding operation, a three-minute owner lease and three review build attempts. Existing source/provider/outbox budgets and conservative uncertainty rules remain authoritative and unchanged. No retry resets their keys, charges or limits.

## Durable stages

The stages are admitted → collected → generated → canonical → review-ready → review-dispatched → complete. A verified canonical commit superseded before ingestion terminates with a distinct superseded result and does not paint an older catalog.

Stable source keys resume only the existing collector's proved ready/prepared results. Generation resumes its durable saved proposal/receipt without another provider call. Writer restart uses its existing exact-base and one-dispatch reconciliation. A crash after an actual canonical effect but before the coordinator records that stage recovers the same receipt. Returned and cached canonical receipts are checked against actual Git, including local publication/source bindings, rather than accepted solely because a D1 hash matches.

Review preparation creates an isolated owned Git checkout at that receipt, runs actual Astro/Pagefind and calls the existing release candidate preparation/verification. It binds the current/retained receipt catalog to the compiled Worker. Child builds have parent-loss/deadline guards; source Git, output and aggregate storage are bounded. Sealed artifacts survive interruption and are reverified before reuse. Partial builds remain retained within the three-attempt/storage bounds; they are never presented as successful artifacts.

The explicit controlled review port uses the admitted prior catalog as its expected state. One activation dispatch is durably marked before calling it; actual signed review state must match the source, catalog hash and canonical receipt afterward. Lost replies reconcile that read, never resend blindly. A crash between marking and sending remains unconfirmed until actual external evidence resolves it. A later canonical advance during an already dispatched ingestion cannot be atomically coupled to Git; preserve the actual historical effect and let a newer reviewed build advance normally. This is no live deployment or remote exactly-once guarantee.

Completion means a controlled canonical publication and verified review ingestion. It creates no human review decision, removes no original flag and does not claim factual approval. Valid controlled publication is automatic; humans can review the resulting flagged receipt afterward. Completed historical replay verifies the original Git/artifact receipts and never activates an older catalog again.

## Failure and limits

A failure after canonical commit may leave the article committed with review ingestion pending. Inspect the durable stage and actual receipts; never report that the article is unchanged solely because the final call failed. Unknown capture/provider/dispatch outcomes retain their charges and stop. A stale pre-canonical base or an unconfirmed operation is not silently rebased, cancelled or discarded; it can block new admission until deliberately resolved. Operator abandonment/archive/retention policy is not implemented by this bounded checkpoint.

Review artifacts are bounded to 32 MiB source repositories, 64 MiB stages, 192 MiB aggregate storage and a 45-second child deadline. Candidate asset bounds remain the existing release limits. The coordinator admits no extra paid work on reads and never installs packages. Existing limited article/source/store coverage remains explicit.

Rollback before live enablement means stopping the runner and returning code to PR42 while retaining all journals, receipts, stages and ambiguous operations. Do not drop migration 0015 or erase canonical records to disguise outcomes. PR42's unsupported downgrade rule for older canonical-base readers remains in force.

## Verification and residual gaps

`npm run test:maintenance-pipeline` covers shared actual workerd/D1, owned Git, controlled provider, exact Astro/Pagefind/candidate build and the shipped signed-review Worker. It includes durable phase interruptions, lost D1/canonical/ingestion replies, concurrency, admission limits, stale/superseded review heads, forged receipts, actual SIGKILL after durable collection, and continuation from a separately approved restored base with the earlier human audit retained. Final-head command/proof results live in `.git/maintenance-pipeline-handoff.json`.

Still unavailable: a live job trigger/executor deployment, reviewed production source/provider/Git/ingestion profiles, credentials, secure provider setup, real currency enforcement, remote D1 and release activation, operator resolution/retention and notifications. Those are later scoped tasks. The controlled review adapter in tests rebinds actual built assets/Worker locally; it is not evidence of Cloudflare deployment or a production ingestion service. No paid call, remote article write, account change, deployment, indexing or license choice occurs.
