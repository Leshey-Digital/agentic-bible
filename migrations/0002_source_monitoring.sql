CREATE TABLE monitor_sources (
  id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  article_ids TEXT NOT NULL CHECK(json_valid(article_ids)),
  body_hash TEXT, etag TEXT, last_modified TEXT,
  checked_at INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0,
  last_run_token TEXT, mode TEXT NOT NULL DEFAULT 'fixture' CHECK(mode='fixture')
);
CREATE TABLE monitor_jobs (
  id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, source_id TEXT NOT NULL REFERENCES monitor_sources(id),
  scenario TEXT NOT NULL CHECK(scenario IN ('baseline','change','unchanged','not-modified','transient','timeout','redirect','malformed')),
  state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','retry','succeeded','dead','budget_blocked')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
  due_at INTEGER NOT NULL, lease_token TEXT, lease_until INTEGER,
  finished_token TEXT, result TEXT, error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX monitor_due ON monitor_jobs(state,due_at);
CREATE INDEX monitor_source_lock ON monitor_jobs(source_id,state,lease_until);
CREATE TABLE monitor_reservations (
  token TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES monitor_jobs(id), attempt INTEGER NOT NULL,
  day INTEGER NOT NULL, max_bytes INTEGER NOT NULL, actual_bytes INTEGER,
  outcome TEXT NOT NULL DEFAULT 'reserved' CHECK(outcome IN ('reserved','succeeded','failed','abandoned')),
  UNIQUE(job_id,attempt)
);
CREATE INDEX monitor_budget_day ON monitor_reservations(day);
CREATE TABLE source_events (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES monitor_sources(id),
  source_version INTEGER NOT NULL, old_hash TEXT NOT NULL, new_hash TEXT NOT NULL,
  token TEXT NOT NULL, observed_at INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'fixture' CHECK(mode='fixture'),
  UNIQUE(source_id,source_version)
);
CREATE TABLE publication_heads (
  article_id TEXT PRIMARY KEY, current_revision TEXT, version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE publication_candidates (
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES source_events(id), article_id TEXT NOT NULL REFERENCES publication_heads(article_id),
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','published','blocked_evidence','blocked_malformed','reverted','superseded')),
  review_flag TEXT NOT NULL DEFAULT 'none' CHECK(review_flag IN ('none','flagged','cleared')),
  reason TEXT, version INTEGER NOT NULL DEFAULT 1, last_token TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(event_id,article_id)
);
CREATE TABLE publication_revisions (
  id TEXT PRIMARY KEY REFERENCES publication_candidates(id), article_id TEXT NOT NULL REFERENCES publication_heads(article_id),
  previous_revision TEXT REFERENCES publication_revisions(id), event_id TEXT NOT NULL REFERENCES source_events(id),
  payload TEXT NOT NULL CHECK(json_valid(payload)), token TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'local-fixture-ledger' CHECK(scope='local-fixture-ledger'), created_at INTEGER NOT NULL
);
CREATE TABLE publication_actions (
  request_key TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES publication_candidates(id),
  action TEXT NOT NULL, fingerprint TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL
);
