# Quality-gated admission for new local article identities

## Problem and outcome

Quality assessment currently accepts only the twenty compiled reading IDs, while the isolated publication ledger already supports validated article slugs, immutable revisions, search metadata, history, rollback and replay. This prevents a trusted, complete new draft from entering that bounded local lifecycle.

Allow a syntactically valid new article identity to be assessed as part of the exact candidate and admit it to the existing isolated publisher only after the durable trusted quality decision allows it. The publisher remains capped at twenty articles, its existing operation/revision/disk bounds remain unchanged, and the canonical maintenance target allowlist remains pinned to the existing twenty IDs.

## Scope and non-goals

- Add an explicit coordinator that requires a durable quality allow receipt before any local article publication effect.
- Preserve post-publication quality flags, content-addressed revisions, history, rollback, and replay behavior supplied by the existing publication store.
- Prove the lifecycle with actual local D1 and the isolated local publication store.
- Do not change canonical Markdown, canonical Git history, maintenance target registration, live provider/source transport, hosting, deployment, identity, credentials, or licensing.
- Do not expand the finite publication, operation, revision, source, request, or storage limits.

## Alternatives

- Keep the existing ID allowlist: safe, but no new article can use the existing publisher lifecycle.
- Generalize canonical maintenance targets to arbitrary slugs: rejected because it would expand a separate canonical write boundary without a durable registration/authority protocol.
- Raise the publisher's article capacity: rejected because this change can stay inside the existing twenty-article bound.

## Dependencies, costs, and risks

The coordinator depends on the existing trusted verifier contract and D1 immutable quality ledger. Controlled tests use local fixtures and do not establish live factual verification. An allow receipt authorizes only the isolated local metadata/publication ledger; canonical article registration remains a separately reviewed future change.

## Decisions needed

None for this bounded local implementation. A future canonical identity-registration workflow requires a separately specified trust and review boundary.
