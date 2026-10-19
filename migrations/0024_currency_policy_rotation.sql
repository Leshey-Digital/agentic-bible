-- Immutable history for safe, non-overlapping monthly currency-policy rotation.
-- Proposal rows remain the accounting authority; this table never stores or resets spend.
CREATE TABLE maintenance_currency_policy_history (
 policy_hash TEXT PRIMARY KEY CHECK(length(policy_hash)=64),
 policy_json TEXT NOT NULL CHECK(length(policy_json)<=4096),
 prior_policy_hash TEXT UNIQUE CHECK(prior_policy_hash IS NULL OR length(prior_policy_hash)=64),
 activated_at INTEGER NOT NULL CHECK(activated_at>=0)
);
INSERT INTO maintenance_currency_policy_history(policy_hash,policy_json,prior_policy_hash,activated_at)
 SELECT policy_hash,policy_json,NULL,last_seen FROM maintenance_currency_policy WHERE id=1;
INSERT OR IGNORE INTO maintenance_currency_policy_history(policy_hash,policy_json,prior_policy_hash,activated_at)
 SELECT currency_policy_hash,currency_policy,NULL,MIN(created_at) FROM maintenance_proposals
 WHERE currency_policy_hash IS NOT NULL AND currency_policy IS NOT NULL GROUP BY currency_policy_hash,currency_policy;
CREATE TRIGGER maintenance_currency_history_no_update
 BEFORE UPDATE ON maintenance_currency_policy_history BEGIN SELECT RAISE(ABORT,'immutable currency policy history'); END;
CREATE TRIGGER maintenance_currency_history_no_delete
 BEFORE DELETE ON maintenance_currency_policy_history BEGIN SELECT RAISE(ABORT,'immutable currency policy history'); END;
ALTER TABLE maintenance_proposals ADD COLUMN currency_price_id TEXT CHECK(currency_price_id IS NULL OR length(currency_price_id) BETWEEN 3 AND 80);
UPDATE maintenance_proposals SET currency_price_id=json_extract(currency_policy,'$.price.id')
 WHERE currency_policy IS NOT NULL AND json_extract(currency_policy,'$.schemaVersion')=1;
