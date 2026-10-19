# Jev and admin setup implementation checkpoint

This feature follows preparation source `2e881e3724de1ddc4e0a0ccc9f05a19e9e74a7a7`, preserving its encrypted recovery changes and all earlier source ancestry. Main, staging and production remain unchanged. No GitHub Actions, live provider operation, credential configuration or resource provisioning is part of this work.

## Provider contract and capability boundary

Official references checked on 2026-10-19:

- [Typesafe launch article](https://typesafe.ai/blog/introducing-system-one-models-and-jev).
- [HTTP API](https://docs.typesafe.ai/api): fixed POST evaluation endpoint, bearer authentication, state/questions request, typed answers and token usage.
- [Models](https://docs.typesafe.ai/models): explicit version IDs, input-token pricing and free output tokens. No rate is silently imported into budget policy.
- [Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents): no prose generation.

`src/maintenance-adapters/jev.ts` implements a real protocol transport with injected dependencies; it does not send live requests by default. Its one fixed Noul question provides advisory editorial attention signals, never factual or publication authority. Model IDs are pinned explicitly. Configuration must supply an enabled flag, credential, allowed model, transport and charged-execution authority; missing/invalid dependencies stop before dispatch. Requests and streamed responses have byte/deadline/cancellation limits. Redirects, unknown response fields, invalid usage/model/probability and provider errors fail closed with redacted codes. One invocation admits at most one transport dispatch; no automatic retries occur.

Jev cannot implement the requested article prose generation. The exact missing contract is a prose-capable generation provider/model and its endpoint/authentication/request/response/usage semantics, or a separately approved supplied-content workflow. `generate()` rejects without invoking Jev. The decision adapter is not mounted into a live route, schedule, article producer or writer.

The charged-execution port is a trusted server seam, not implemented monetary enforcement. Production requires a Jev-specific tokenizer/maximum input reservation, approved rate card (including zero output price), finite run/day/month allocations, durable immediate dispatch revalidation, usage settlement and retained uncertain charges. Existing fake-provider currency tests are not relabeled as Jev billing enforcement.

## Admin behavior

The existing signed-admin setup and contributions UI now offer separate GitHub content and Jev write-only credentials. Status uses a constant mask and a server-defined controlled/provider/unverified evidence label. A controlled success never claims real connectivity. Jev checks are unavailable: the documented evaluation endpoint is billable and no documented non-billable credential check has been established. Direct test commands fail before reserving or dispatching.

Migration `0023_jev_integration_vault.sql` atomically rebuilds the two fixed-ID tables. It preserves existing GitHub ciphertext/AAD and retained crash locks; Jev has independent ownership, revision, replay, audit and locks. Ciphertext is authenticated against its integration ID, preventing cross-provider substitution. Production migration execution is not performed.

The UI preserves editorial review and GitHub draft workflows, distinguishes a review from a source change/release, shows artifact-manifest status without claiming live production serving, disables writes when state/ownership/access is unknown, clears secret input after attempts and selection changes, and requires explicit replacement confirmation. A lost mutation response requires reloading the masked revision before retrying. Secrets are never returned or put into generated assets, audit or client storage.

## Verification and review

Focused verification includes signed contract tests, actual workerd/D1 vault restart/isolation/retained-lock/AAD tests, populated SQLite migration preservation/rollback, actual hosted route tests, controlled transport/error/deadline/budget-port tests, Astro type checks and Markdown link checks. Desktop/mobile production-hosted browser coverage includes actual review persistence, independent Jev setup, write-only redaction, rotation after a lost committed response, zero-call Jev checks, evidence labels, unknown status, ownership denial, publication errors, keyboard navigation, overflow and axe.

Independent scoped review found no actionable new provider/backend/UI defect after these focused checks. This is distinct from full release qualification and live validation. The canonical writer review remains incomplete after the prior platform security denial; no retry or bypass was attempted. The exact pushed commit, complete suite results and draft PR are recorded in the task handoff/PR, after execution, rather than inferred here.

## Owner-only activation work

- Approve issuer/audience, exact identity subject mapping and membership for the selected administrator `leshey@w3africa.com`; an email alone is not identity trust. Configure key rotation/recovery and approved secret custody through the supported secure route.
- Provide the Typesafe credential, pinned model, reviewed pricing and actual numeric spend allocations. Funded account status is not a spending cap.
- Implement/review the concrete charged-execution authority and choose the prose-generation contract; establish factual-quality authority and approved source scope.
- Bind/migrate the production D1/vault and configure the existing server adapters only in a separately authorized activation. Store replacement does not issue/revoke provider credentials.
- Configure editorial@agenticbible.si delivery, contributor terms/privacy/retention/moderation and ingress controls before public intake. No email delivery is implemented by setup status.
- Complete writer continuity review and exact-byte deployment/rollback qualification under separate release authority.

Rollback: before applying migration 0023, revert the feature commit. After applying it, old code remains GitHub-only and leaves Jev records inaccessible; do not drop or rewrite records/retained locks as a retry mechanism. Restore the feature code to regain Jev setup. This code rollback does not restore or revoke external credentials and does not authorize deployment.
