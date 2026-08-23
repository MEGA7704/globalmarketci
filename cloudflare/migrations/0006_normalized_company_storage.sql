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

-- Stockage métier historique par snapshots.
-- V6.1.6 : les noms incompatibles avec le schéma relationnel sont préfixés
-- gm_legacy_snapshot_* sur les nouvelles bases. Les anciennes bases déjà
-- migrées sont réparées automatiquement par ensureDB() avant les lectures V6.
CREATE TABLE IF NOT EXISTS gm_company_storage_meta (
  company_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  snapshot_id TEXT NOT NULL DEFAULT '',
  storage_version INTEGER NOT NULL DEFAULT 6,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gm_company_snapshots (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_snapshots_company_revision
ON gm_company_snapshots(company_id, revision DESC);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_settings (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_gm_settings_snapshot
ON gm_legacy_snapshot_settings(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_large_record_chunks (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_type, entity_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_gm_large_chunks_snapshot
ON gm_large_record_chunks(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_products (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_products_snapshot ON gm_products(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_sales (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_legacy_snapshot_sales_snapshot ON gm_legacy_snapshot_sales(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_payments (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_legacy_snapshot_payments_snapshot ON gm_legacy_snapshot_payments(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_orders (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_legacy_snapshot_orders_snapshot ON gm_legacy_snapshot_orders(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_customers (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_customers_snapshot ON gm_customers(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_market_customers (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_market_customers_snapshot ON gm_market_customers(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_password_resets (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_legacy_snapshot_password_resets_snapshot ON gm_legacy_snapshot_password_resets(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_stock_entries (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_legacy_snapshot_stock_entries_snapshot ON gm_legacy_snapshot_stock_entries(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_stock_outputs (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_legacy_snapshot_stock_outputs_snapshot ON gm_legacy_snapshot_stock_outputs(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_legacy_snapshot_stock_movements (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_legacy_snapshot_stock_movements_snapshot ON gm_legacy_snapshot_stock_movements(company_id, snapshot_id);

CREATE TABLE IF NOT EXISTS gm_cashier_logs (
  company_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, snapshot_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_cashier_logs_snapshot ON gm_cashier_logs(company_id, snapshot_id);
