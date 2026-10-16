-- Additive only. No route, provider, credential, cron or remote database is enabled.
CREATE TABLE indexing_enqueue_receipts (
 event_key TEXT PRIMARY KEY CHECK(length(event_key) BETWEEN 3 AND 80),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 receipt TEXT NOT NULL CHECK(json_valid(receipt) AND length(receipt)<=2048)
);
CREATE TABLE indexing_notifications (
 id TEXT PRIMARY KEY CHECK(length(id)=64),
 event_key TEXT NOT NULL REFERENCES indexing_enqueue_receipts(event_key),
 provider TEXT NOT NULL CHECK(provider='indexnow'),
 url TEXT NOT NULL CHECK(length(url)<=200),
 revision TEXT NOT NULL CHECK(length(revision)=64),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','inflight','acknowledged','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 token TEXT, acknowledgment INTEGER CHECK(acknowledgment IN (200,202)),
 UNIQUE(event_key,url)
);
