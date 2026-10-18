-- Additive immutable provenance for actual hosted inbox reviews. Legacy notes
-- have no binding and retain their existing format/authority.
CREATE TABLE hosted_submission_reviews (
  approval_id TEXT PRIMARY KEY REFERENCES hosted_reviewed_notes(id),
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  submission_version INTEGER NOT NULL CHECK(submission_version >= 1),
  owner_hash TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK(json_valid(input_json)),
  created_at INTEGER NOT NULL
);
CREATE INDEX hosted_submission_review_item ON hosted_submission_reviews(submission_id, submission_version);
