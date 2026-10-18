-- Local reviewed-correction coordinator only; existing static/Worker configs do not enable it.
CREATE TABLE correction_operations (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  submission_version INTEGER NOT NULL,
  reviewer TEXT NOT NULL CHECK(reviewer='local-editor'),
  kind TEXT NOT NULL CHECK(kind IN ('apply','rollback')),
  command_json TEXT NOT NULL CHECK(json_valid(command_json) AND length(command_json)<=32768),
  state TEXT NOT NULL CHECK(state IN ('approved','complete')),
  receipt_json TEXT CHECK(receipt_json IS NULL OR (json_valid(receipt_json) AND length(receipt_json)<=8192)),
  created_at INTEGER NOT NULL
);
