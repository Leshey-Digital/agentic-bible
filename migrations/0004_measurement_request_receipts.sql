-- Settings-only follow-up to PR7's 0003_measurement_settings.sql.
-- PR8 separately owns 0003_monitor_batch_commands.sql; this unique 0004 name
-- neither renames nor imports that migration. Existing settings/audit rows stay intact.
CREATE TABLE measurement_request_receipts (
  actor TEXT NOT NULL,
  request_key TEXT NOT NULL CHECK(length(request_key)=36),
  fingerprint TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK(json_valid(response_json) AND length(response_json)<=32768),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at>created_at),
  PRIMARY KEY(actor,request_key)
);
CREATE INDEX measurement_receipt_expiry ON measurement_request_receipts(expires_at);
