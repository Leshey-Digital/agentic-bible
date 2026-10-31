-- Global admission counts only, no visitor/request identifiers or event payloads.
-- Apply only to the separately approved PUBLIC_MEASUREMENT_DB; never editorial D1.
CREATE TABLE public_measurement_quota (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  policy_revision TEXT NOT NULL CHECK(policy_revision='aggregate-v1'),
  hour INTEGER NOT NULL CHECK(hour>=0),
  hour_events INTEGER NOT NULL CHECK(hour_events BETWEEN 1 AND 1000),
  month INTEGER NOT NULL CHECK(month>=0),
  month_events INTEGER NOT NULL CHECK(month_events BETWEEN 1 AND 100000),
  high_water INTEGER NOT NULL CHECK(high_water>=0)
);
