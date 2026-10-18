# Change, handoff and release workflow

Use a lightweight OpenSpec-style folder convention without requiring an external framework installation. [Current product specification](../openspec/specs/product.md) describes intended accepted product direction; implementation status must remain explicit.

For each material change create openspec/changes/<slug>/ with:
- proposal.md: problem, outcome, scope/non-goals, options, dependencies, costs, risks and decisions needed.
- tasks.md: checkable implementation/verification steps and actual status.
- spec-delta.md: added/changed/removed requirements with acceptance scenarios.

Link the change from its issue and draft PR. On acceptance, update current specs and preserve the change record. These files do not replace tests or approval.

## Handoff template
- Goal and authorized scope:
- Repository / branch / exact commit:
- Relevant issue / change / PR:
- Confirmed decisions versus proposals:
- Files and resource changes:
- Checks passed / failed / not run, with evidence:
- Reproduction steps and remaining risks:
- Dependencies or decisions needed:
- Next safe action and stopping condition:
- Rollback:

Never include credentials, private chat transcripts, customer data, or unsupported completion claims.

## Release checklist
- [ ] Exact reviewed commit and artifact recorded; applicable tests pass.
- [ ] License/submission/privacy requirements resolved for enabled features.
- [ ] Deployment authorized for the named target; resource inventory verified. For the proposed staging slice, use only agentic-bible-staging / staging.agenticbible.si; leave apex and production unchanged.
- [ ] Secrets and permissions handled through approved routes; no sensitive data in artifacts.
- [ ] Costs, rate limits, budget stops and failure alerts verified.
- [ ] SEO/analytics settings distinguish preview and production; public origin/canonicals verified.
- [ ] Ad scripts remain off unless separately approved.
- [ ] Known-good artifact identified; rollback tested; any migration is reversible or has a tested restore plan.
- [ ] Post-deploy smoke checks cover reading/search/proposals and confirm exact deployed version.
- [ ] Report actual results and remaining gaps.

Historical foundation status: the foundation had no automation, and the first application slice added validation-only CI. Observed main `6987bf2c53d8ddc9ffb34d9b89d453caf0adf213` now includes validation/artifact packaging and the separate manual [staging release workflow](../.github/workflows/release-staging.yml). Its enablement/protected-environment gates are separate from code acceptance. Follow the [current owner handoff and release hold](commit-pinned-releases.md#observed-status-and-owner-preparation-2026-10-18); this checklist does not authorize dispatch or establish live configuration.
