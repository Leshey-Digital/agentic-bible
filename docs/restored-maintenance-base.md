# Controlled maintenance after canonical restoration

This separate local successor preserves frozen PR41 `7aa5bfa26aee99a39e15dc3dee502565fde1c719`. Inspection before implementation found that its strict reader, restored attribution and explicitly pinned Astro/Pagefind build already work. They are reused. Two remaining gaps were confirmed: the private producer/writer parent comparison rejects a restored canonical revision, and release preparation could package a source-pinned article build with history disabled.

## Exact base, separate private history

The existing producer accepts an optional trusted `canonicalBase` port with kind `controlled-canonical-base-fixture`, an owned Git repository and an exact source commit. It has no default transport, request route, credential or schedule. The reader reconstructs the current canonical receipt and Markdown, rejects untested application blobs and verifies the fixed `main` ref before new generation. Caller data never supplies a receipt or article body as authority.

The complete canonical Markdown is explicitly marked untrusted in the fake provider input, together with source/receipt/revision/hash pins. Its bytes count toward the unchanged input/run/day/month budgets. The deterministic provider still extracts complete paragraphs from new controlled source responses; it is not a semantic edit model and the baseline is never executable instructions. Proposal fingerprints and read-only completed authority include the canonical binding. A different base cannot reuse an existing event.

Private bridge/publisher references remain append-only local technical history. They are not reset to an earlier release or relabeled as the restoration revision. The writer uses the verified canonical receipt as its immediate previous revision and the pinned source commit as expected head. A new automatic record retains the optional canonical-base reference; the strict reader verifies it against the actual immediate predecessor, parent Markdown and receipt hash. Old record profiles and old bytes remain unchanged.

## Stale bases and interruption

New or ready proposals require a current canonical base before generating or advancing the private bridge. A base moving during a provider response leaves the one generated proposal durably charged and ready, with no private activation or canonical write; retrying it cannot regenerate or rebase it. A deliberate new event and exact new pin are needed. Private publication is never canonical write authority; final writer checks and the existing expected-head Git compare-and-swap prevent a candidate from overwriting a newer canonical head even if it changes during a private build.

The original pinned base remains readable for completed historical replay and dispatched writer reconciliation. A proposal interrupted after durable readiness resumes from the same response without another generation. Lost applied writer responses reconcile the actual Git commit without another mutation. Existing source freshness and private-store retention bounds still apply; historical replay availability is not extended. Existing one-dispatch ambiguity limits remain: no remote exactly-once guarantee, blind resend or stale event repair is introduced. Retain interrupted private stores and accounting; do not reset them to recover capacity.

## Existing build/release path

The resulting exact canonical Git head is built through the existing explicit staging history selector. Candidate preparation now reconstructs canonical history at that head and requires a matching built catalog. A build with history disabled or a different source/receipt list fails before candidate output is created. Valid candidates retain their existing source/tree/manifest/asset bindings and closed release gates. This is validation in the existing pipeline, not a new release service or permission.

## Evidence and limits

`npm run test:maintenance-base` uses one actual workerd/D1 ledger for both original generations, signed review/approval, restoration, later generation and writer. The two original generation charges stay intact; the test advances only its synthetic clock to a new day rather than relaxing daily quotas. Tests cover restore → automatic maintenance → strict four-entry history → actual Astro/Pagefind build → release candidate, stale/code-mismatched pins before a new charge, movement during generation/before writer, durable proposal/D1 restart, lost applied writer response and forged canonical-base references.

Original repository article bytes, old history records and dependency lockfile remain intact. Before-fix evidence reproduces `writer_previous_revision_conflict`. Exact final-head commands/proofs and release dry runs are recorded in `.git/restored-maintenance-base-handoff.json`. Controlled test clones use ordinary ignored dependency directories so the release clean-source guard remains unchanged.

Production identity/GitHub transport, live provider/currency enforcement, remote D1, record-profile rollout, automatic release dispatch, notifications and deployment are still unconfigured. Ordinary valid publication policy remains automatic. The owner reports independent acceptance of frozen PR41 with no findings; this checkpoint still needs its own review. Before any new canonical-base record exists, rollback can return code to PR41 while retaining/exporting private ledgers and ambiguous operations. Once the new record profile exists, PR41 and earlier readers reject it: a direct code downgrade is unsupported. Keep a format-aware reader deployed or design a separately reviewed migration; never rewrite or delete canonical history to make an older reader accept it. No remote resource or live article changed.

The later [controlled operating pipeline](controlled-maintenance-pipeline.md) composes these existing base/writer/build pieces without changing the frozen PR42 source. It is default-disabled and fixture-only. The owner confirms the twenty unchanged original drafts retain source-review acceptance from PR22/23/27; licenses, live integration and acceptance of newly generated content remain distinct.
