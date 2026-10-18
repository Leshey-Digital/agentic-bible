CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL UNIQUE,
  article_id TEXT NOT NULL CHECK(article_id IN ('ai-agent','tool-use','model-context-protocol')),
  kind TEXT NOT NULL CHECK(kind IN ('correction','source')),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 20 AND 2000),
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','follow-up','resolved','dismissed')),
  tags TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags)),
  version INTEGER NOT NULL DEFAULT 1,
  last_event_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX submissions_inbox ON submissions(status, created_at DESC, id DESC);
CREATE TABLE editorial_audit (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  tags TEXT NOT NULL CHECK(json_valid(tags)),
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_submission ON editorial_audit(submission_id, created_at, id);
CREATE TABLE rate_windows (
  client_hash TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 5),
  PRIMARY KEY(client_hash, window)
);
CREATE TABLE local_sessions (
  token_hash TEXT PRIMARY KEY,
  identity TEXT NOT NULL CHECK(identity IN ('local-editor','local-reader')),
  role TEXT NOT NULL CHECK(role IN ('admin','reader')),
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_expiry ON rate_windows(window);
CREATE INDEX session_expiry ON local_sessions(expires_at);
