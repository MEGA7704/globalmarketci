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


-- GLOBAL MARKET V6.0 — D1 relationnel
-- Appliquer une seule fois AVANT la migration des données V5.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS gm_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gm_companies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, status TEXT, plan_code TEXT,
  subscription_end TEXT, shop_slug TEXT, business_type TEXT, city TEXT, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_users (
  id TEXT PRIMARY KEY, company_id TEXT, name TEXT, email TEXT, role TEXT NOT NULL, status TEXT NOT NULL,
  main_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_items (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, code TEXT, name TEXT NOT NULL, category TEXT, item_type TEXT,
  sell REAL NOT NULL DEFAULT 0, stock REAL NOT NULL DEFAULT 0, stock_type TEXT, marketplace_hidden INTEGER NOT NULL DEFAULT 0,
  search_text TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_sales (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, client_id TEXT, sale_date TEXT, total REAL NOT NULL DEFAULT 0,
  status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_payments (
  id TEXT PRIMARY KEY, company_id TEXT, order_id TEXT, client_id TEXT, method TEXT, status TEXT,
  amount REAL NOT NULL DEFAULT 0, currency TEXT, transaction_id TEXT, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_orders (
  id TEXT PRIMARY KEY, checkout_id TEXT, company_id TEXT NOT NULL, client_id TEXT NOT NULL, order_date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0, delivery_fee REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  delivery_city TEXT, delivery_neighborhood TEXT, shipping_method TEXT, payment_method TEXT,
  payment_status TEXT, validation_status TEXT, delivery_status TEXT, deleted_by_client INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, item_id TEXT, item_name TEXT, category TEXT,
  item_type TEXT, qty REAL NOT NULL DEFAULT 0, unit REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(order_id) REFERENCES gm_orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS gm_clients (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT, phone TEXT, email TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_market_clients (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, email TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_market_messages (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL, client_id TEXT, sender_type TEXT NOT NULL, sender_name TEXT,
  body TEXT NOT NULL, admin_deleted INTEGER NOT NULL DEFAULT 0, client_deleted INTEGER NOT NULL DEFAULT 0,
  read_by_admin INTEGER NOT NULL DEFAULT 0, read_by_client INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_password_reset_requests (
  id TEXT PRIMARY KEY, company_id TEXT, user_id TEXT, role TEXT, status TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gm_stock_entries (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gm_stock_outputs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gm_stock_movements (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gm_caisse_logs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gm_company_settings (
  company_id TEXT NOT NULL, section TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(company_id, section)
);
CREATE TABLE IF NOT EXISTS gm_client_order_hidden (
  client_id TEXT NOT NULL, order_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(client_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_companies_shop_slug ON gm_companies(shop_slug);
CREATE INDEX IF NOT EXISTS idx_gm_companies_status ON gm_companies(status, subscription_end);
CREATE INDEX IF NOT EXISTS idx_gm_users_company ON gm_users(company_id, role, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gm_users_email ON gm_users(email) WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_gm_items_market ON gm_items(marketplace_hidden, company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gm_items_company ON gm_items(company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gm_items_category ON gm_items(category, marketplace_hidden, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gm_items_search ON gm_items(search_text);
CREATE INDEX IF NOT EXISTS idx_gm_orders_client ON gm_orders(client_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_gm_orders_company_status ON gm_orders(company_id, validation_status, payment_status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_gm_orders_checkout ON gm_orders(checkout_id, company_id);
CREATE INDEX IF NOT EXISTS idx_gm_order_items_order ON gm_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_gm_messages_company ON gm_market_messages(company_id, admin_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gm_messages_client ON gm_market_messages(client_id, client_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gm_sales_company_date ON gm_sales(company_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_gm_payments_company_date ON gm_payments(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gm_reset_status ON gm_password_reset_requests(status, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_gm_items_nonnegative_stock
BEFORE UPDATE OF stock ON gm_items
WHEN NEW.stock < 0 AND COALESCE(OLD.stock_type,'') <> 'unlimited'
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK');
END;
