CREATE TABLE IF NOT EXISTS state_meta (
  company_id TEXT PRIMARY KEY,
  chunk_count INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS state_chunks (
  company_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (company_id, chunk_index)
);



CREATE TABLE IF NOT EXISTS global_state_meta_v2 (
  document_id TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS global_state_chunks_v2 (
  document_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (document_id, revision, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_global_state_chunks_v2_current
ON global_state_chunks_v2(document_id, revision, chunk_index);

CREATE TABLE IF NOT EXISTS company_state_meta (
  company_id TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_state_chunks (
  company_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (company_id, revision, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_company_state_chunks_current
ON company_state_chunks(company_id, revision, chunk_index);


CREATE TABLE IF NOT EXISTS company_state_patches (
  company_id TEXT NOT NULL,
  section TEXT NOT NULL,
  record_id TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, section, record_id)
);

CREATE INDEX IF NOT EXISTS idx_company_state_patches_scope
ON company_state_patches(company_id, section, record_id);

CREATE TABLE IF NOT EXISTS deleted_companies (
  company_id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backups_company_id
ON backups(company_id, id DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  company_id TEXT,
  detail TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_created
ON security_events(created_at DESC);
