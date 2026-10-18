-- Controlled local GitHub-maintenance outbox. No live transport or binding configured.
CREATE TABLE canonical_maintenance_writes (
 event_id TEXT PRIMARY KEY CHECK(length(event_id) BETWEEN 3 AND 80),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 state TEXT NOT NULL CHECK(state IN ('preparing','intent','dispatched','complete')),
 owner TEXT CHECK(length(owner)=36), lease_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL CHECK(created_at>=0),
 request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count BETWEEN 0 AND 40),
 intent TEXT CHECK(length(intent)<=65536), intent_hash TEXT CHECK(length(intent_hash)=64),
 receipt TEXT CHECK(length(receipt)<=4096), receipt_hash TEXT CHECK(length(receipt_hash)=64)
);
