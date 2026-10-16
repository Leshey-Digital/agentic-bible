-- HTTP-only metadata; fixture observations and publication tables are untouched.
CREATE TABLE http_source_state (
 source_id TEXT PRIMARY KEY,
 mode TEXT NOT NULL DEFAULT 'http' CHECK(mode='http'),
 body_hash TEXT, etag TEXT CHECK(length(etag)<=200), last_modified TEXT CHECK(length(last_modified)<=200),
 checked_at INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0,
 last_token TEXT
);
CREATE TABLE http_request_budget (
 id INTEGER PRIMARY KEY CHECK(id=1), day INTEGER NOT NULL, used INTEGER NOT NULL CHECK(used BETWEEN 0 AND 20)
);
INSERT INTO http_request_budget VALUES(1,-1,0);
CREATE TABLE http_check_jobs (
 request_key TEXT PRIMARY KEY CHECK(length(request_key)=36),
 source_id TEXT NOT NULL REFERENCES http_source_state(source_id),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','retry','succeeded','dead')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 due_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 lease_token TEXT, lease_until INTEGER, finished_token TEXT,
 result TEXT CHECK(length(result)<=2048)
);
CREATE INDEX http_check_source ON http_check_jobs(source_id,state,lease_until);
CREATE TABLE http_request_reservations (
 token TEXT PRIMARY KEY, request_key TEXT NOT NULL REFERENCES http_check_jobs(request_key),
 attempt INTEGER NOT NULL CHECK(attempt BETWEEN 1 AND 3), day INTEGER NOT NULL,
 outcome TEXT NOT NULL DEFAULT 'reserved' CHECK(outcome IN ('reserved','succeeded','failed','abandoned')),
 actual_bytes INTEGER CHECK(actual_bytes BETWEEN 0 AND 32768),
 UNIQUE(request_key,attempt)
);
