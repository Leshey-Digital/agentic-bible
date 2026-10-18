-- Explicit authorization is separate from the request-only review in 0013.
CREATE TABLE hosted_restoration_approvals (
 approval_id TEXT PRIMARY KEY,
 request_id TEXT NOT NULL UNIQUE REFERENCES hosted_maintenance_reviews(request_id),
 owner_hash TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json) AND length(input_json)<=1024),
 approval_json TEXT NOT NULL CHECK(json_valid(approval_json) AND length(approval_json)<=8192),
 fingerprint TEXT NOT NULL,
 approved_at INTEGER NOT NULL
);
CREATE TABLE hosted_restoration_revocations (
 approval_id TEXT PRIMARY KEY REFERENCES hosted_restoration_approvals(approval_id),
 owner_hash TEXT NOT NULL,
 revoked_at INTEGER NOT NULL
);
