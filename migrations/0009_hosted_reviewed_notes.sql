-- Immutable admin-authored approvals. This does not enable public intake or bind a remote resource.
CREATE TABLE hosted_reviewed_notes (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK(json_valid(input_json) AND length(input_json)<=8192),
  note_json TEXT NOT NULL CHECK(json_valid(note_json) AND length(note_json)<=8192),
  fingerprint TEXT NOT NULL,
  approved_at INTEGER NOT NULL
);
-- Revocation is append-only and never rewrites the approved payload.
CREATE TABLE hosted_note_revocations (
  approval_id TEXT PRIMARY KEY REFERENCES hosted_reviewed_notes(id),
  owner_hash TEXT NOT NULL,
  revoked_at INTEGER NOT NULL
);
CREATE TABLE hosted_source_budget (
  id INTEGER PRIMARY KEY CHECK(id=1),
  day INTEGER NOT NULL,
  requests INTEGER NOT NULL CHECK(requests BETWEEN 0 AND 12)
);
