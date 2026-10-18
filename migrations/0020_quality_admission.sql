-- Append-only terminal quality decisions. A dispatched but unconfirmed assessment
-- remains held: another process cannot invoke the verifier for the same event.
CREATE TABLE maintenance_quality_admissions (
 event_id TEXT PRIMARY KEY CHECK(length(event_id) BETWEEN 3 AND 80),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 binding_hash TEXT NOT NULL CHECK(length(binding_hash)=64),
 owner TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('evaluating','complete','uncertain')),
 identity_json TEXT NOT NULL CHECK(json_valid(identity_json) AND length(identity_json)<=1024),
 created_at INTEGER NOT NULL CHECK(created_at>=0),
 report_json TEXT CHECK(json_valid(report_json) AND length(report_json)<=16384),
 receipt_json TEXT CHECK(json_valid(receipt_json) AND length(receipt_json)<=4096),
 receipt_hash TEXT CHECK(length(receipt_hash)=64),
 CHECK((state='complete' AND report_json IS NOT NULL AND receipt_json IS NOT NULL AND receipt_hash IS NOT NULL) OR (state<>'complete' AND report_json IS NULL AND receipt_json IS NULL AND receipt_hash IS NULL))
);
CREATE TRIGGER maintenance_quality_terminal_immutable BEFORE UPDATE ON maintenance_quality_admissions
WHEN OLD.state IN ('complete','uncertain') BEGIN SELECT RAISE(ABORT,'quality_terminal_immutable'); END;
CREATE TRIGGER maintenance_quality_no_delete BEFORE DELETE ON maintenance_quality_admissions
BEGIN SELECT RAISE(ABORT,'quality_audit_retained'); END;
