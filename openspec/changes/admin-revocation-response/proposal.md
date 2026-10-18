# Preserve confirmed revocation against delayed proposals

Independent PR34 review held an already completed GitHub proposal response, revoked its approval through actual D1, failed the following list read, then released the older response. PR34 painted the row as a saved draft and reenabled draft creation despite confirmed revocation. Preserve frozen PR34 `697d546fc5b6560fe1c38e573584c855c86c13af` and reproduce on desktop/mobile before changing production code.

Each row now keeps operation ownership and confirmed revocation state. Starting revocation supersedes older proposal responses. Proposal success/error may update only its current connected row/action; cleanup respects revocation/pending revocation. A failed list read does not remove the locally confirmed revocation. Existing GitHub/D1 authorization and explicit community review stay unchanged.

No release/reconciliation file, provider, dependency, schema, identity, quota, Markdown, live resource or paid operation changes. The separate PR33 release retry finding remains outside this fix and pending its own approved work. PR33/34 are not independently accepted.
