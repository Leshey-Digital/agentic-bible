-- One bounded orchestration journal. Existing source/provider/writer ledgers remain authoritative.
CREATE TABLE maintenance_pipeline_jobs (
 event_id TEXT PRIMARY KEY CHECK(length(event_id) BETWEEN 3 AND 80),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 input_json TEXT NOT NULL CHECK(json_valid(input_json) AND length(input_json)<=49152),
 plan_json TEXT NOT NULL CHECK(json_valid(plan_json) AND length(plan_json)<=4096),
 plan_hash TEXT NOT NULL CHECK(length(plan_hash)=64),
 phase TEXT NOT NULL CHECK(phase IN ('admitted','collected','generated','canonical','review-ready','review-dispatched','complete','superseded')),
 journal TEXT NOT NULL CHECK(json_valid(journal) AND length(journal)<=65536), journal_hash TEXT NOT NULL CHECK(length(journal_hash)=64),
 owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 16),
 build_attempts INTEGER NOT NULL DEFAULT 0 CHECK(build_attempts BETWEEN 0 AND 3),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 receipt TEXT CHECK(length(receipt)<=8192), receipt_hash TEXT CHECK(length(receipt_hash)=64)
);
