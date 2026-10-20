# Vault-backed GitHub draft transport

Connect existing encrypted integration settings to the restricted draft adapter, opt-in only. Reuse signed identity, D1 vault locking, proposal pins and outbox recovery. No new storage or provider, public intake, paid calls, credentials or deployment. Preserve current runtime and trial evidence.

A request-local transport pins vault owner/revision; each request checks that revision under the vault lock. Rotation halts the old invocation; explicit retry uses existing reconciliation. Provider revocation is detected only on explicit requests. Existing binding mode remains compatible; conflicting vault plus binding closes drafting without fallback.
