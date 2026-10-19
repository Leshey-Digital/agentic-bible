# Added requirements

- A production configuration preflight must require the explicit `production` environment and discovery mode with the exact HTTPS canonical origin `https://agenticbible.si`.
- The descriptor must identify an actual D1 binding, a non-local administrator subject trusted by HTTPS issuer/audience and keyed signed assertions, and a server-side secret-store reference for `GITHUB_CONTENT_TOKEN`. Credential values must not be present in the descriptor or public environment keys.
- Public production indexing may be enabled only at the canonical origin. Private, preview and synthetic content must remain noindex, and indexing submission outbox activation stays disabled until separately authorized and configured.
- Public environment keys must come from the explicit application allowlist; unknown, non-string, duplicated, or secret-bearing entries must be rejected.
- The check must be read-only and fail closed on missing, malformed, unknown or unsafe configuration. Synthetic test identities are not production setup evidence.
