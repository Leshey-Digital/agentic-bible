-- Append-only post-publication review; never overwrites canonical Markdown/history/flags.
CREATE TABLE hosted_maintenance_reviews (
 request_id TEXT PRIMARY KEY,
 owner_hash TEXT NOT NULL,
 input_json TEXT NOT NULL CHECK(json_valid(input_json) AND length(input_json)<=8192),
 fingerprint TEXT NOT NULL,
 receipt_commit TEXT NOT NULL,
 catalog_hash TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 16),
 decision TEXT NOT NULL CHECK(decision IN ('reviewed','follow-up','revert-requested')),
 target_commit TEXT,
 note TEXT NOT NULL CHECK(length(note) BETWEEN 20 AND 1000),
 created_at INTEGER NOT NULL,
 UNIQUE(receipt_commit,version)
);
