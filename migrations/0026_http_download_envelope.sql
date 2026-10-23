-- Apply as one atomic D1 batch before deploying the larger OpenAI envelope.
-- Preserve every historical reservation, constraint and unique attempt key.
CREATE TABLE http_request_reservations_envelope (
 token TEXT PRIMARY KEY, request_key TEXT NOT NULL REFERENCES http_check_jobs(request_key),
 attempt INTEGER NOT NULL CHECK(attempt BETWEEN 1 AND 3), day INTEGER NOT NULL,
 outcome TEXT NOT NULL DEFAULT 'reserved' CHECK(outcome IN ('reserved','succeeded','failed','abandoned')),
 actual_bytes INTEGER CHECK(actual_bytes BETWEEN 0 AND 1048576),
 UNIQUE(request_key,attempt)
);
INSERT INTO http_request_reservations_envelope SELECT token,request_key,attempt,day,outcome,actual_bytes FROM http_request_reservations;
DROP TABLE http_request_reservations;
ALTER TABLE http_request_reservations_envelope RENAME TO http_request_reservations;
