# Specification delta

## Added requirements

- The trusted isolated local quality-publication flow MUST accept arbitrary valid new slugs independently of the compiled canonical target registry, up to 31 current entries, subject to existing operation, revision and disk bounds.
- A local new-identity publication MUST preserve metadata, revisions, replay receipts and rollback history under the existing immutable snapshot contract.
- Hosted runtime status MUST distinguish Jev transport availability and saved integration settings from hosted Jev dispatch mounting/configuration. Current unmounted state MUST NOT claim connectivity.
- The server-only Jev composition factory MUST require the explicit enable flag, trusted secret callback, pinned model, D1 storage, approved currency policy, model-specific token bounds and bounded transport before dispatch. Missing dependencies MUST fail before credential resolution or network access; disabled ports MUST not resolve credentials or call the provider.

## Acceptance scenarios

- Given an empty local store and trusted quality admission, when 21 distinct valid IDs are published, then all 21 are present in one snapshot and remain unrelated to the fixed canonical registry.
- Given one of those IDs, when it is revised and an ancestor rollback is committed, then the prior current state is restored while both revision records and receipts remain readable.
- Given Jev transport code and a configured write-only integration vault without a dispatch composition, when runtime status is requested, then dispatch reports `not-mounted` and `false`, with zero provider requests.
