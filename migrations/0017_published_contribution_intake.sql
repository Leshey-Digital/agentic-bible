-- Apply as one migration transaction (Wrangler migrations / D1 batch).
-- Retain child schemas and exact rows without disabling foreign-key enforcement.
-- Clear dependent rows only inside this transaction, before replacing their parent.
CREATE TABLE intake_audit_backup AS SELECT * FROM editorial_audit;
CREATE TABLE intake_corrections_backup AS SELECT * FROM correction_operations;
DELETE FROM editorial_audit;
DELETE FROM correction_operations;
CREATE TABLE submissions_published (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL UNIQUE,
  -- Membership is enforced by the compiled canonical inventory at every store entry.
  article_id TEXT NOT NULL CHECK(length(article_id) BETWEEN 1 AND 100 AND article_id NOT GLOB '*[^a-z0-9-]*'),
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
INSERT INTO submissions_published (id,request_key,fingerprint,article_id,kind,message,source_url,status,tags,version,last_event_id,created_at,updated_at)
  SELECT id,request_key,fingerprint,article_id,kind,message,source_url,status,tags,version,last_event_id,created_at,updated_at FROM submissions;
DROP TABLE submissions;
ALTER TABLE submissions_published RENAME TO submissions;
CREATE INDEX submissions_inbox ON submissions(status, created_at DESC, id DESC);
INSERT INTO editorial_audit SELECT * FROM intake_audit_backup;
INSERT INTO correction_operations SELECT * FROM intake_corrections_backup;
DROP TABLE intake_audit_backup;
DROP TABLE intake_corrections_backup;
