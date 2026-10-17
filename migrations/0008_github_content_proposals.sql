-- Proposal receipts only. This does not enable identity, GitHub credentials or deployment.
CREATE TABLE github_content_proposals (
  approval_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','proposed')),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count BETWEEN 0 AND 24),
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  receipt_json TEXT CHECK(receipt_json IS NULL OR (json_valid(receipt_json) AND length(receipt_json)<=4096)),
  created_at INTEGER NOT NULL
);
