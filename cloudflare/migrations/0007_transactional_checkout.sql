-- GLOBAL MARKET 4.2 / stockage v7
-- Ajoute la réservation idempotente des encaissements.
CREATE TABLE IF NOT EXISTS gm_checkout_requests (
  company_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  checkout_id TEXT NOT NULL,
  cashier_id TEXT NOT NULL,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '',
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_gm_checkout_company_status
ON gm_checkout_requests(company_id, status, updated_at DESC);
