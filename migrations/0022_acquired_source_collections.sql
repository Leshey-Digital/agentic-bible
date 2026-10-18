-- Versioned original HTML/extraction capture. Legacy0012 retains its 2KiB profile.
CREATE TABLE maintenance_acquired_source_collections (
 request_key TEXT PRIMARY KEY CHECK(length(request_key)=36),
 source_id TEXT NOT NULL CHECK(length(source_id)<=64), citation_id TEXT NOT NULL CHECK(length(citation_id)<=48),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64), owner TEXT NOT NULL CHECK(length(owner)=36),
 state TEXT NOT NULL CHECK(state IN ('capturing','prepared','ready')),
 created_at INTEGER NOT NULL CHECK(created_at>=0),
 body_hash TEXT CHECK(length(body_hash)=64), body_bytes INTEGER CHECK(body_bytes BETWEEN 1 AND 32768),
 journal TEXT CHECK(length(journal)<=4096), journal_hash TEXT CHECK(length(journal_hash)=64)
);
