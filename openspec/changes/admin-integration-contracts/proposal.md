# Secure admin integration settings contracts

## Problem and outcome

Approved product direction requires write-only server-side integration setup, masked status, scoped connection tests and redacted audit. Existing measurement forms deliberately accept only non-secret IDs. Existing hosted signed admin verification can be reused, while persistent secret setup and live connections remain unauthorized.

Add an unmounted typed contract for the existing `github-content` purpose, with atomic owned replacement/rotation/replay semantics and bounded status/test projections. Prove behavior using generated signing keys and disposable in-memory fake storage. [Detailed contract and limits](../../../docs/admin-integration-contracts.md).

## Scope and non-goals

Include strict input/byte/deadline limits, direct cryptographic identity verification, existing origin/CSRF requirements, constant masks, allowlisted error/test enums, finite audit/request/test budgets, and stale completion protection. Keep production storage and scoped test execution behind explicit trusted adapter interfaces.

No route, UI, live secret binding, credential storage, provider call, OAuth, account/security change, new dependency, schema, resource, deployment or release. No analytics credentials, arbitrary URLs/scripts or fabricated caller roles. No persistent vault/readiness claim, provider-side token issuance/revocation, monetary-cap claim or change to accepted articles and publication policy.

## Options, dependencies and risks

Do nothing leaves the boundary undefined. Building a vault or provider connection now exceeds authorization and needs a storage/rotation/recovery decision. The selected contract-only option reuses existing hosted identity and keeps the runtime closed. A real adapter must later prove atomic secret/metadata/audit storage, durable replay/crash handling, access-log exclusion, fixed-endpoint transport bounds and provider permissions.

Costs: no infrastructure or network use; tests are local. Risks: consumers could mistake types and fake tests for a production vault; documentation and the absence of runtime imports keep that limit explicit. The conservative replay policy rejects duplicate input rather than retaining credential fingerprints or old responses. Pending/uncertain tests consume budget and never automatically retry.

## Decisions

The parent-authorized scope permits local contracts/tests with existing signed authority, and prohibits real setup/wiring. The single existing integration target is the smallest bounded interface. Broader provider choice, durable storage, ownership transfer, key issuance/revocation/reconciliation and live configuration remain separate decisions. Publication, merge and deployment are not part of this checkpoint.
