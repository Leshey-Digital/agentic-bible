# Contribution review history

Development milestone: an editor can return to a suggestion and trace their bound reviewed notes to recorded GitHub draft receipts. This does not enable public intake or publish an article. The existing signed-admin, source-preview and explicit GitHub proposal paths remain the only write authority.

`GET /api/admin/submissions/:id/reviews` is an authenticated, same-origin, no-store history read. It selects up to64 records for the verified owner's existing submission-review bindings, ordered by creation time and approval ID. Missing suggestions return404; missing/invalid identity retains existing403 behavior; non-GET methods are rejected. No migration, retention change, provider call or outbox mutation is introduced.

The projection validates immutable submission/note owner, input, revision, target, timestamp and fingerprint correlations. Historical revoked and stale records remain visible; they do not become actionable approvals. Proposed outbox receipts must match the same fingerprint, approval, source target, base/branch and fixed repository PR URL. Invalid evidence returns an unavailable response; raw JSON, owner hashes and lease tokens are not exposed. Expiry is rechecked after asynchronous reads.

The inbox displays note/citation, contribution revision, approval state, base commit and historical draft link. Its states mean:
- No recorded attempt: no outbox record exists; no claim about other external activity.
- Outcome unconfirmed: a pending outbox record may represent partial remote effects; use the existing saved approval flow to reconcile/retry.
- Draft recorded: a validated historical receipt exists. Current GitHub open/closed/merged state and live publication were not queried and are not implied.

A disposition/tag save changes the suggestion revision; confirmed and uncertain saves refresh history without discarding the editor's current fields. Failed history reads clear stale displayed results and explain the unknown outcome. Stored notes are rendered as text, never executable markup. No paid AI or public write path is added.

Scope is actual bound schema2 contribution reviews. Legacy standalone tool-use approvals remain in their existing interface. The endpoint does not expose another owner's reviews even though the shared authorized inbox can display the suggestion itself. No contributor identity, private report or email delivery system is introduced.

[Proposal and acceptance boundary](../openspec/changes/contribution-review-history/proposal.md). Development branches retain the deployed recovery ancestor; production module version and domain are unchanged. Full ordinary-browser production acceptance is still incomplete following the separately confirmed Python-client Browser Integrity Check rejections.
