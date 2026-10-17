# Proposed release requirements

History URLs use a full verified Git commit and the correct article path. A dirty article or forged source pin fails before public build; isolated synthetic output has no misleading Git history link. Release packaging requires a clean source tree and exact tested commit, twenty articles, staging noindex, bounded complete assets and a compiled manifest binding.

Only a default-disabled, explicitly invoked owner-enabled staging workflow may create/activate versions. Verify successful main-push validation and immutable artifact identity, named account/Worker/origin, expected current version and artifact byte hashes before privileged calls. Never merge or modify GitHub content, force a deployment, migrate D1, configure secrets/routes or enable privileged app ports. Handle uncertain effects through explicit same-plan observation/retry, preserving receipts; do not blindly overwrite another release.

Rollback reuses a previously verified version and its exact source artifact, checks expected current version and verifies served bytes. Bootstrap has no previous known-good rollback target and must say so. Software tests distinguish real local build/runtime evidence from controlled provider responses and unperformed live execution.
