-- Terminal known-denial sidecar; preserve every original pipeline/proposal row.
CREATE TABLE maintenance_pipeline_quality_denials (
 event_id TEXT PRIMARY KEY REFERENCES maintenance_pipeline_jobs(event_id),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 quality_receipt TEXT NOT NULL CHECK(json_valid(quality_receipt) AND length(quality_receipt)<=4096),
 quality_receipt_hash TEXT NOT NULL CHECK(length(quality_receipt_hash)=64),
 receipt TEXT NOT NULL CHECK(json_valid(receipt) AND length(receipt)<=8192),
 receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64),
 created_at INTEGER NOT NULL CHECK(created_at>=0)
);
CREATE TRIGGER maintenance_pipeline_denial_immutable BEFORE UPDATE ON maintenance_pipeline_quality_denials
BEGIN SELECT RAISE(ABORT,'quality_denial_immutable'); END;
CREATE TRIGGER maintenance_pipeline_denial_retained BEFORE DELETE ON maintenance_pipeline_quality_denials
BEGIN SELECT RAISE(ABORT,'quality_denial_retained'); END;
