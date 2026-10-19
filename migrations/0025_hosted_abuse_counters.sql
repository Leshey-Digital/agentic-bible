-- Privacy-safe aggregate intake outcomes only; one row per outcome and UTC day.
-- Fourteen days are retained by runtime pruning. Counts saturate at one million.
CREATE TABLE hosted_abuse_counters (
  day INTEGER NOT NULL CHECK(day>=0),
  outcome TEXT NOT NULL CHECK(outcome IN ('accepted','duplicate','honeypot','rate_limited','rejected','forbidden','capacity','other_error')),
  count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 1000000),
  PRIMARY KEY(day,outcome)
);
