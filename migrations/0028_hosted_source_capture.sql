-- Bounded private raw capture for scheduled maintenance only. No live binding or migration is applied here.
CREATE TABLE hosted_maintenance_source_captures (
 request_key TEXT PRIMARY KEY CHECK(length(request_key)=36),
 event_id TEXT NOT NULL REFERENCES maintenance_pipeline_jobs(event_id),
 source_id TEXT NOT NULL CHECK(length(source_id)<=96), citation_id TEXT NOT NULL CHECK(length(citation_id)<=48),
 state TEXT NOT NULL CHECK(state IN ('capturing','ready')),
 packet TEXT NOT NULL CHECK(json_valid(packet) AND length(packet)<=24576), packet_hash TEXT NOT NULL CHECK(length(packet_hash)=64),
 raw_hash TEXT NOT NULL CHECK(length(raw_hash)=64), raw_bytes INTEGER NOT NULL CHECK(raw_bytes BETWEEN 1 AND 1048576),
 chunk_count INTEGER NOT NULL CHECK(chunk_count BETWEEN 1 AND 32),
 UNIQUE(event_id,source_id), UNIQUE(event_id,citation_id)
);
CREATE TABLE hosted_maintenance_source_chunks (
 request_key TEXT NOT NULL REFERENCES hosted_maintenance_source_captures(request_key),
 chunk_index INTEGER NOT NULL CHECK(chunk_index BETWEEN 0 AND 31),
 chunk_bytes INTEGER NOT NULL CHECK(chunk_bytes BETWEEN 1 AND 32768),
 chunk_hash TEXT NOT NULL CHECK(length(chunk_hash)=64),
 data TEXT NOT NULL CHECK(length(data) BETWEEN 4 AND 43692),
 PRIMARY KEY(request_key,chunk_index)
);
CREATE TRIGGER hosted_capture_ready_immutable BEFORE UPDATE ON hosted_maintenance_source_captures
WHEN OLD.state='ready' BEGIN SELECT RAISE(ABORT,'hosted_capture_retained'); END;
CREATE TRIGGER hosted_capture_no_delete BEFORE DELETE ON hosted_maintenance_source_captures
BEGIN SELECT RAISE(ABORT,'hosted_capture_retained'); END;
CREATE TRIGGER hosted_capture_chunk_immutable BEFORE UPDATE ON hosted_maintenance_source_chunks
BEGIN SELECT RAISE(ABORT,'hosted_capture_retained'); END;
CREATE TRIGGER hosted_capture_chunk_no_delete BEFORE DELETE ON hosted_maintenance_source_chunks
BEGIN SELECT RAISE(ABORT,'hosted_capture_retained'); END;
