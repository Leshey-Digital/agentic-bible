-- Local non-secret identifiers and privacy flags only. No credential columns.
CREATE TABLE measurement_settings (
  setting_group TEXT PRIMARY KEY CHECK (setting_group IN ('google','clarity','privacy','advertising')),
  values_json TEXT NOT NULL CHECK (json_valid(values_json) AND length(values_json) <= 512),
  version INTEGER NOT NULL CHECK (version >= 1),
  updated_at INTEGER NOT NULL
);
INSERT INTO measurement_settings VALUES
 ('google','{"tagId":"","ga4Id":"","enabled":false}',1,0),
 ('clarity','{"projectId":"","enabled":false}',1,0),
 ('privacy','{"previewEnabled":false,"analyticsConsent":"denied","adConsent":"denied","respectDnt":true}',1,0),
 ('advertising','{"enabled":false}',1,0);
CREATE TABLE measurement_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  setting_group TEXT NOT NULL REFERENCES measurement_settings(setting_group),
  version INTEGER NOT NULL,
  fields_json TEXT NOT NULL CHECK (json_valid(fields_json) AND length(fields_json) <= 256),
  created_at INTEGER NOT NULL,
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  UNIQUE(actor, request_key),
  UNIQUE(setting_group, version)
);
CREATE INDEX measurement_audit_recent ON measurement_audit(created_at DESC, id DESC);
