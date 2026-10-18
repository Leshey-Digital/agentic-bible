-- Opt-in USD accounting on the existing proposal ledger. No live provider binding.
ALTER TABLE maintenance_proposals ADD COLUMN currency_policy TEXT CHECK(length(currency_policy)<=4096);
ALTER TABLE maintenance_proposals ADD COLUMN currency_policy_hash TEXT CHECK(length(currency_policy_hash)=64);
ALTER TABLE maintenance_proposals ADD COLUMN currency_reserved INTEGER CHECK(currency_reserved BETWEEN 1 AND 100000000);
ALTER TABLE maintenance_proposals ADD COLUMN currency_actual INTEGER CHECK(currency_actual BETWEEN 0 AND currency_reserved);
ALTER TABLE maintenance_proposals ADD COLUMN currency_state TEXT CHECK(currency_state IN ('reserved','settled','uncertain'));
ALTER TABLE maintenance_proposals ADD COLUMN currency_usage TEXT CHECK(length(currency_usage)<=1024);
ALTER TABLE maintenance_proposals ADD COLUMN currency_settled_at INTEGER CHECK(currency_settled_at>=created_at);
-- Configuration only; all reservations and charges remain maintenance_proposals rows.
CREATE TABLE maintenance_currency_policy (
 id INTEGER PRIMARY KEY CHECK(id=1),
 policy_json TEXT NOT NULL CHECK(length(policy_json)<=4096),
 policy_hash TEXT NOT NULL CHECK(length(policy_hash)=64),
 last_seen INTEGER NOT NULL CHECK(last_seen>=0)
);
