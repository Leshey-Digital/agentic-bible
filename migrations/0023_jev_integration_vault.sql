-- Atomic migration required. Preserve all existing ciphertext/AAD and retained crash locks.
-- Only the fixed Typesafe Jev integration is added; no credentials or bindings.
CREATE TABLE integration_vault_next (
  integration TEXT PRIMARY KEY CHECK(integration IN ('github-content','typesafe-jev')),
  key_id TEXT NOT NULL CHECK(length(key_id) BETWEEN 1 AND 64),
  metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json) AND length(metadata_json)<=32768),
  nonce TEXT NOT NULL CHECK(length(nonce)=16),
  ciphertext TEXT NOT NULL CHECK(length(ciphertext) BETWEEN 24 AND 1400)
);
INSERT INTO integration_vault_next SELECT * FROM integration_vault;
DROP TABLE integration_vault;
ALTER TABLE integration_vault_next RENAME TO integration_vault;
CREATE TABLE integration_vault_locks_next (
  integration TEXT PRIMARY KEY CHECK(integration IN ('github-content','typesafe-jev')),
  token TEXT NOT NULL,
  acquired_at INTEGER NOT NULL
);
INSERT INTO integration_vault_locks_next SELECT * FROM integration_vault_locks;
DROP TABLE integration_vault_locks;
ALTER TABLE integration_vault_locks_next RENAME TO integration_vault_locks;
