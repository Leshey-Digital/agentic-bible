# Contribution-to-review history checkpoint

The roadmap calls for an on-site proposal to become a reviewed, sourced revision through a transparent editorial workflow. Existing code already implements intake, dispositions, pinned-source approvals and explicit GitHub draft creation. This milestone closes the missing return path: after reload/restart, the originating suggestion shows the editor's review provenance and historical draft outcome. It does not merge or publish a draft.

Ancestry: feat/contribution-review-history follows PR53 exact head b9c9d5a2d63bede992465b37b465aceee22e1ef3, preserving recovery6390e84 and the deployed artifact receipts. PR53's exact-head PR-triggered Actions query returned zero runs; executable Actions are intentionally absent, so no CI pass is asserted. Its saved-environment checks and corrected findings remain recorded. Main and production are unchanged.

Implemented: authenticated owner-scoped GET projection from existing review/approval/outbox tables; immutable correlation and fingerprint checks; current/stale/revoked approval states; no attempt/unconfirmed/recorded-draft outcomes; fixed-repository historical PR links; inbox rendering with explicit remote-state/publication limits. History reads neither call providers nor write state. No migration, credentials, paid AI or public-write gates changed.

Validation on final source:
- Native Worker/D1 end-to-end: synthetic submission→follow-up→source review→draft→restart/readback; stale and revoked history retains the draft; a second valid admin sees no first-owner reviews; untrusted identity403; foreign receipt URL/fingerprint503; pending outcome remains unconfirmed. Storage and outbound counts unchanged by history reads. Passed.
- Real Chromium desktop1440/mobile390: new history display, safe text/links, current→stale refresh and unavailable-state cleanup; prior draft-navigation cancel/discard/failure/race checks. Four tests passed.
- Astro/TypeScript:196files,0errors/0warnings/0hints. Markdown validation passed; broad production-hosted suite42/42 passed with no failures or skips.
- Independent bounded review accepted three production source files: submission-history75413d027c5fddabc572bc1ae4d215472273aa76c0a1bff9f21c7d671bd44ba1, contribution-admin5a139b898d465cbd0e22f3cf23708252e05d6acddaf1e100710e716a5f8a44f0, contributionscaef69f28952ad60cf9f1735f848eb5f67888e7b368d9bff81e3971dcef34bf1. A history freshness defect after disposition saves was fixed and covered; no remaining blocking findings in that scope.

Acceptance boundary: native D1 uses generated test identities and controlled GitHub responses; UI rendering uses controlled API responses. No actual admin identity, public submissions, live GitHub proposal, remote receipt polling, canonical article write or deployment is established. Stored receipts are historical evidence, not current GitHub status or publication proof. Legacy standalone reviews retain their separate interface. Full ordinary-browser production acceptance is still incomplete; confirmed BIC rejection of Python clients is not bypassed.

Fresh pre-push provider reads show no build triggers on either Agentic Bible Worker, and this branch contains no Actions workflows. Production remains deployment e046cf4a-6f57-404d-a50a-504788058ee5/version28c2c556-ab43-482a-98e7-7d2aa8d6965c. No automatic deploy path was selected. GitHub repository hook enumeration remains unavailable under the existing executor policy.

[Change proposal](../../openspec/changes/contribution-review-history/proposal.md) · [acceptance delta](../../openspec/changes/contribution-review-history/spec-delta.md) · [contract](../contribution-review-history.md).
