# Private editorial integration checkpoint

## Milestone and acceptance boundary

The roadmap's private editorial inbox is the next runtime trial: a trusted editor can open a synthetic suggestion, retain unsaved changes while navigating, save a sourced review, create a recorded GitHub draft, and recover the outcome after restart. Public submissions, canonical publication and paid AI remain closed. A draft receipt is not proof of merge or publication.

This checkpoint is one linear integration, not three independent product releases:

| Dependency | Preserved head | Contribution |
| --- | --- | --- |
| Production recovery | `6390e84dda31f6420954f781d815062ae703b52d` | Deployed module implementation and launch evidence |
| PR53 | `b9c9d5a2d63bede992465b37b465aceee22e1ef3` | Unsaved editorial navigation protection |
| PR54 | `c69dda749e9a90176c0eca4052cda864dbe48d73` | Durable suggestion/review/draft history |
| This successor | See candidate receipt | Private inbox configuration independent of public intake |

The aggregate review targets the recovery branch. Neither main nor production is merged or deployed. PR53/54 remain preserved source reviews; their changes are already ancestors of this checkpoint.

## Demonstrated configuration gap and correction

The shipped configuration previously mounted contribution admin routes only when public-intake policy and rate-key configuration were complete. The new native regression failed with authorized inbox503 before the fix. Exact server binding `HOSTED_PRIVATE_INBOX=enabled` now mounts trust-only contribution routes after existing valid admin-trust and D1 checks. Absent or malformed values preserve previous behavior.

This flag does not force public intake off: independently complete public-intake configuration still enables that separate path. A private trial must leave `HOSTED_INTAKE_POLICY` and `HOSTED_INTAKE_RATE_KEY` absent. The flag supplies no GitHub authority. Without an existing authorized GitHub content credential, inbox/history work but source lookup and draft creation remain unavailable. No remote binding was changed.

Independent review accepted configuration SHA256 `963ebdd5955783025c036f01a4365dd1edb03f2683521648ab292c35b9f9e1ed` and contracts SHA256 `10f6b7aaa7765dcfc007208ab6730a6d9bc9e1c916db62c800a5253f4225945b`, including the trust, missing-storage and missing-GitHub boundaries. Targeted tests use disposable local D1 and controlled GitHub responses, never customer records.

## Read-only staging inventory, 2026-10-20

Target: account `c370be29e4065365de03bc8652da2cdc`, Worker `agentic-bible-staging`, https://staging.agenticbible.si. Retained version `5d532da5-b15c-4e64-8ae7-634f69831dcb`, deployment `548f69ec-060d-4c85-ba73-a6fc9ca06bbe` is unchanged.

Existing bindings: ASSETS; EDITORIAL_DB `1ca9a6f8-c0a9-4040-8a2f-e22d888a985a`; secret names HOSTED_ADMIN_TRUST, INTEGRATION_VAULT_KEY and INTEGRATION_VAULT_KEY_ID. No secret values were read. Presence of trust does not establish a working identity/gateway or authorized membership; vault presence does not establish a usable GitHub credential.

Read-only sqlite schema and migration-name queries confirm submissions, hosted_submission_reviews, hosted_reviewed_notes, hosted_note_revocations and github_content_proposals tables exist. Migration ledger contains all repository migration names through 0025_hosted_abuse_counters.sql, including both historical 0003 entries. These queries wrote zero rows and read no submission contents. Ledger presence is not an independent column-by-column schema verification.

Not present in returned binding inventory: HOSTED_PRIVATE_INBOX, GITHUB_CONTENT_TOKEN, HOSTED_INTAKE_POLICY and HOSTED_INTAKE_RATE_KEY. There is no new migration in this checkpoint.

## Concrete prerequisites before a remote trial

1. An approved source integration and release plan satisfying the current controller's canonical-main requirement; this non-production branch is intentionally unmerged and not promotion-admissible. Full saved-environment qualification under docs/local-qualified-releases.md for the exact promotion candidate. Focused integration tests and a dry run are not that receipt; the older 59-check qualification cannot qualify this source.
2. Confirm the existing staging admin gateway and membership end to end using an authorized identity. No security changes or identity provisioning are included here.
3. Resolve existing approved GitHub draft authority for this runtime's direct GITHUB_CONTENT_TOKEN port. The inventory has no such binding. Any new credential/access expansion needs specific authorization; do not infer it from vault-key presence.
4. Prepare a separately reviewed target-specific release configuration and qualification for the private binding. The current release controller in src/release/bindings.ts permits only ASSETS, D1 and the three existing secrets; its exact settings checks and generated runtime configuration do not carry HOSTED_PRIVATE_INBOX or GITHUB_CONTENT_TOKEN. Simply adding these bindings and running the current controller is not supported. No release-controller change is included here. In a later authorized activation, retain absent public-intake gates, isolated staging D1 and no paid-provider authority. Use synthetic trial records only. Confirm current active version before native promotion.
5. Resolve the existing session-authorized Assets upload transport failure for this staging release path with supported evidence. Production module serving is preserved but is not automatically a qualified replacement for this dynamic staging runtime. This turn makes no upload attempt.
6. Perform actual authenticated staging review/draft/readback and anonymous-closed checks. Controlled local responses do not establish remote GitHub or admin acceptance.

Rollback is Cloudflare native activation of the retained staging version after verifying its bindings and compatibility. This change introduces no schema migration; do not delete or rewrite history. Production remains pinned to version `28c2c556-ab43-482a-98e7-7d2aa8d6965c` with its existing apex attachment. The production BIC/Python-client block and incomplete ordinary-browser acceptance remain separate historical limitations.
