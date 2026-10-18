-- Optional server-only adapter: no key, binding or credential is provisioned.
CREATE TABLE integration_vault (
  integration TEXT PRIMARY KEY CHECK(integration='github-content'),
  key_id TEXT NOT NULL CHECK(length(key_id) BETWEEN 1 AND 64),
  metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json) AND length(metadata_json)<=32768),
  nonce TEXT NOT NULL CHECK(length(nonce)=16),
  ciphertext TEXT NOT NULL CHECK(length(ciphertext) BETWEEN 24 AND 1400)
);
-- A crash retains the lock and fails closed. No timeout takeover/automatic retry.
-- Recovery requires separately reviewed server-owner action, not a browser route.
CREATE TABLE integration_vault_locks (
  integration TEXT PRIMARY KEY CHECK(integration='github-content'),
  token TEXT NOT NULL,
  acquired_at INTEGER NOT NULL
);
