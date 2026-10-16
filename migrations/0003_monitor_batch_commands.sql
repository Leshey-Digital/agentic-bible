CREATE TABLE monitor_batch_commands (
  request_key TEXT PRIMARY KEY CHECK(length(request_key)=36),
  action TEXT NOT NULL CHECK(action IN ('schedule','process')),
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete')),
  plan TEXT CHECK(plan IS NULL OR json_valid(plan)),
  result TEXT CHECK(result IS NULL OR (json_valid(result) AND length(result)<=131072)),
  lease_token TEXT, lease_until INTEGER,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  CHECK((state='pending' AND result IS NULL) OR (state='complete' AND result IS NOT NULL))
);
CREATE INDEX monitor_batch_expiry ON monitor_batch_commands(expires_at);
