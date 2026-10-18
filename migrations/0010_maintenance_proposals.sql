-- Local synthetic producer ledger only. No Worker binding or provider is configured.
CREATE TABLE maintenance_proposals (
 event_id TEXT PRIMARY KEY CHECK(length(event_id) BETWEEN 3 AND 80),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 owner TEXT NOT NULL CHECK(length(owner)=36),
 state TEXT NOT NULL CHECK(state IN ('calling','uncertain','failed','ready','complete')),
 created_at INTEGER NOT NULL CHECK(created_at>=0), day INTEGER NOT NULL,
 month TEXT NOT NULL CHECK(length(month)=7),
 input_tokens INTEGER NOT NULL CHECK(input_tokens BETWEEN 1 AND 8192),
 output_tokens INTEGER NOT NULL CHECK(output_tokens BETWEEN 1 AND 2048),
 reserved_cost INTEGER NOT NULL CHECK(reserved_cost BETWEEN 1 AND 100000000),
 actual_cost INTEGER CHECK(actual_cost BETWEEN 0 AND reserved_cost),
 response TEXT CHECK(length(response)<=4096),
 packet TEXT CHECK(length(packet)<=49152), packet_hash TEXT CHECK(length(packet_hash)=64),
 receipt TEXT CHECK(length(receipt)<=4096), error TEXT CHECK(length(error)<=80)
);
CREATE INDEX maintenance_period ON maintenance_proposals(day,month,state);
