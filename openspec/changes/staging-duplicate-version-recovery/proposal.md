# Staging upload duplicate recovery

The pinned Wrangler retries version-create POSTs after ambiguous failures. The provider can create multiple versions for one candidate/request marker before the controller records the returned ID. The old same-UUID recovery rejects that history permanently.

Reconcile a bounded set of exact-marker versions, validate every version detail and its ASSETS-only bindings, and select deterministically. Retain an already journaled selection or this operation's active selection to recover uncertain activation without switching versions. Keep artifact byte verification, source/CI/target/current-version pins and complete served-byte verification unchanged. Reject conflicting or excessive matches before activation; never delete versions or guess across a truncated history.

Scope: release provider/controller, controlled actual-CLI regression tests and release documentation. No admin UI, maintenance, workflow enablement, live provider call, credential, merge or deployment. The owner authorized this separate public branch/draft from immutable PR34 `697d546fc5b6560fe1c38e573584c855c86c13af`.

Reject-all duplicates is safe but prevents recovery from the CLI's own retry. Choosing a list entry without verifying all matches could conceal a conflicting version. A new lock/storage service is unnecessary; existing workflow concurrency and the owner-enforced exclusive deployment writer remain prerequisites. The provider has no global compare-and-swap. Version annotations remain provenance markers under that trust boundary, not cryptographic proof of remote bytes. Complete public bytes/runtime binding must still verify before success.

Costs: controlled loopback tests only. Bound duplicate detail reads so the existing 16-call provider budget remains unchanged. No monetary enforcement or live compatibility is claimed. Independent exact-head review remains required.
