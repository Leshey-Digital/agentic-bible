-- Server-owned checkpoints for at most sixteen private AI draft requests.
-- Paid response text remains in maintenance_proposals; no accounting is copied.
CREATE TABLE hosted_draft_outbox (
 request_key TEXT PRIMARY KEY CHECK(length(request_key)=36),
 owner TEXT NOT NULL CHECK(length(owner)=77),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 selection TEXT NOT NULL CHECK(length(selection)<=1024),
 created_at INTEGER NOT NULL CHECK(created_at>=0),
 prompt TEXT CHECK(length(CAST(prompt AS BLOB)) BETWEEN 1 AND 8192),
 prompt_hash TEXT CHECK(length(prompt_hash)=64),
 max_tokens INTEGER CHECK(max_tokens BETWEEN 1 AND 2048),
 event_id TEXT CHECK(length(event_id)=52),
 CHECK ((prompt IS NULL AND prompt_hash IS NULL AND max_tokens IS NULL AND event_id IS NULL)
  OR (prompt IS NOT NULL AND prompt_hash IS NOT NULL AND max_tokens IS NOT NULL AND event_id IS NOT NULL))
);
CREATE TRIGGER hosted_draft_outbox_immutable BEFORE UPDATE ON hosted_draft_outbox
 WHEN OLD.prompt IS NOT NULL OR NEW.request_key!=OLD.request_key OR NEW.owner!=OLD.owner
 OR NEW.fingerprint!=OLD.fingerprint OR NEW.selection!=OLD.selection OR NEW.created_at!=OLD.created_at
 BEGIN SELECT RAISE(ABORT,'immutable private draft checkpoint'); END;
