const APP_NAME = 'GLOBAL MARKET';
const V6_SCHEMA_VERSION = '6.0';
const V6_MIGRATION_META_KEY = 'schema_version';
const V6_REALTIME_WORKER = 'global-market-realtime';
const STATE_ID = 'global_market_all';
const STATE_KEY = `company:${STATE_ID}`;
const EMPLOYEE_SESSION_COOKIE = 'GLOBAL_MARKET_SESSION';
const CLIENT_SESSION_COOKIE = 'GLOBAL_MARKET_CLIENT_SESSION';
const EMPLOYEE_SESSION_TTL = 60 * 60 * 24 * 7;
const CLIENT_SESSION_TTL = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100000;
const D1_CHUNK_MAX_BYTES = 1_500_000;
const D1_BACKUP_MAX_BYTES = 1_500_000;
const GLOBAL_CHUNK_MAX_BYTES = 400_000;
const COMPANY_CHUNK_MAX_BYTES = 240_000;
const COMPANY_BATCH_SIZE = 8;
const MAX_COMPANY_STATE_BYTES = 7_500_000;
const KV_STATE_MAX_BYTES = 20_000_000;
const MAX_STATE_BYTES = 60_000_000;
const PATCH_RECORD_MAX_BYTES = 1_250_000;
const PATCH_GLOBAL_SCOPE = '__global__';
const GLOBAL_CLIENT_SCOPE = '__global_clients__';
const LEGACY_CREDENTIAL_MIGRATION_KEY = 'security:credentials:migrated:v4';
const STATE_FALLBACK_PREFIX = 'cache:state:v563:';
const PUBLIC_PAYLOAD_CACHE_KEY = 'cache:public-payload:v563';
const CLIENT_PAYLOAD_CACHE_PREFIX = 'cache:client-payload:v563:';
const PENDING_OPS_PREFIX = 'pending-ops:v563:';
const FALLBACK_CACHE_TTL = 60 * 60 * 48;
const FALLBACK_CACHE_MAX_BYTES = 18_000_000;
let dbReadyPromise = null;
let legacyMigrationChecked = false;
let publicStateCache = null;
let publicStateCacheAt = 0;
let publicStateLoadPromise = null;
let d1WriteQueue = Promise.resolve();
const stateFallbackWriteAt = new Map();
let publicPayloadCacheWriteAt = 0;
let v6ReadyCacheValue = null;
let v6ReadyCacheAt = 0;
const clientPayloadCacheWriteAt = new Map();
const AUTH_INIT_KEY = 'security:superadmin:initialized:v2';
const SUPER_ADMIN_ID = 'superadmin_global_market';
const SENSITIVE_FIELDS = new Set([
  'password', 'passwordHash', 'passwordSalt', 'passwordIterations', 'passwordAlgo',
  '__pendingPassword', 'newPassword', 'currentPassword'
]);

const SUPER_ADMIN_PROFILE = Object.freeze({
  id: SUPER_ADMIN_ID,
  companyId: null,
  name: 'Super Admin GLOBAL MARKET',
  email: 'Identifiant protégé',
  role: 'superadmin',
  status: 'active',
  createdAt: '2026-07-25T00:00:00.000Z',
  mainAdmin: true
});

function configuredSuperAdminIdentifier(env) {
  return normalizeIdentifier(env.SUPER_ADMIN_EMAIL || '');
}

function requireSuperAdminIdentifier(env) {
  const identifier = configuredSuperAdminIdentifier(env);
  if (!identifier) {
    throw new HttpError(428, 'Configuration requise : ajoutez la variable Cloudflare SUPER_ADMIN_EMAIL.', 'SETUP_REQUIRED');
  }
  return identifier;
}

function configuredSuperAdminPasswordVersion(env) {
  return String(env.SUPER_ADMIN_PASSWORD_VERSION || '1').trim() || '1';
}

class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR', headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

const json = (obj, init = {}) => new Response(JSON.stringify(obj), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    ...(init.headers || {})
  }
});

function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ success: false, error: error.message, code: error.code }, {
      status: error.status,
      headers: error.headers
    });
  }
  console.error(error);
  const message = String(error?.message || error || '');
  if (/overload|too many requests|rate.?limit|quota exceeded|temporar(?:y|ily)|network connection lost|SQLITE_BUSY|database is locked|\bbusy\b|\blocked\b/i.test(message)) {
    return json({ success: false, error: 'Le stockage cloud est temporairement occupé. La requête sera réessayée après un court délai.', code: 'STORAGE_BUSY' }, { status: 503, headers: { 'Retry-After': '3' } });
  }
  if (/too big|too large|SQLITE_TOOBIG|maximum.*size|memory/i.test(message)) {
    return json({ success: false, error: 'Les données à enregistrer sont trop volumineuses. Réduisez les images ou captures.', code: 'STORAGE_TOO_LARGE' }, { status: 413 });
  }
  return json({ success: false, error: 'La sauvegarde n’a pas pu être terminée. Réessayez sans fermer la page.', code: 'STORAGE_WRITE_FAILED' }, { status: 500 });
}

function isTransientStorageError(error) {
  if (!error) return false;
  if (error instanceof HttpError && [408, 425, 429, 500, 502, 503, 504].includes(Number(error.status))) return true;
  const message = String(error?.message || error || '');
  return /overload|too many requests|rate.?limit|quota exceeded|temporar(?:y|ily)|network connection lost|SQLITE_BUSY|database is locked|\bbusy\b|\blocked\b/i.test(message);
}

async function withStorageRetry(task, attempts = 4) {
  let lastError = null;
  const delays = [90, 220, 520, 1050, 1800, 3000];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await task(); }
    catch (error) {
      lastError = error;
      if (!isTransientStorageError(error) || attempt === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[Math.min(attempt, delays.length - 1)] + Math.floor(Math.random() * 120)));
    }
  }
  throw lastError;
}

function fallbackStateKey(companyId = '*') {
  return `${STATE_FALLBACK_PREFIX}${encodeURIComponent(String(companyId || '*'))}`;
}

async function readStateFallback(env, companyId = '*') {
  try {
    const cached = await env.GLOBAL_MARKET_KV.get(fallbackStateKey(companyId), 'json');
    if (!cached?.state) return null;
    return normalizeState(cached.state);
  } catch (error) {
    console.warn('Cache de lecture indisponible', error?.message || error);
    return null;
  }
}

async function writeStateFallback(env, companyId, state) {
  const key = fallbackStateKey(companyId);
  const now = Date.now();
  const last = Number(stateFallbackWriteAt.get(key) || 0);
  if (now - last < 120000) return;
  const cachedState = companyId === '*' ? cleanClone(state) : scopeState(state, { role: 'admin', companyId });
  const raw = JSON.stringify({ cachedAt: new Date().toISOString(), state: cachedState });
  if (new TextEncoder().encode(raw).byteLength > FALLBACK_CACHE_MAX_BYTES) return;
  stateFallbackWriteAt.set(key, now);
  try { await env.GLOBAL_MARKET_KV.put(key, raw, { expirationTtl: FALLBACK_CACHE_TTL }); }
  catch (error) { console.warn('Cache de lecture non actualisé', error?.message || error); }
}

function pendingOpsPrefixFor(companyId) {
  return `${PENDING_OPS_PREFIX}${encodeURIComponent(String(companyId || PATCH_GLOBAL_SCOPE))}:`;
}

async function queuePendingOperations(env, operations, actor) {
  if (!operations?.length) return null;
  const companyId = String(actor?.companyId || PATCH_GLOBAL_SCOPE);
  const key = `${pendingOpsPrefixFor(companyId)}${Date.now().toString(36)}-${randomHex(6)}`;
  await env.GLOBAL_MARKET_KV.put(key, JSON.stringify({ queuedAt: new Date().toISOString(), companyId, operations }), { expirationTtl: 60 * 60 * 24 * 7 });
  return key;
}

function applyPendingOperationsToState(state, operations) {
  for (const op of operations || []) {
    const section = String(op?.section || '');
    const recordId = String(op?.recordId || '');
    if (!recordId) continue;
    if (section.startsWith('array:')) applyArrayPatch(state, section.slice(6), recordId, Boolean(op.deleted), op.value ?? null);
    else if (section.startsWith('object:')) applyObjectPatch(state, section.slice(7), recordId, Boolean(op.deleted), op.value ?? null);
    else if (section.startsWith('value:')) {
      const key = section.slice(6);
      if (op.deleted) delete state[key]; else state[key] = op.value;
    }
  }
  return normalizeState(state);
}

async function listPendingOperationEntries(env, companyId = '*') {
  const prefixes = companyId === '*'
    ? [PENDING_OPS_PREFIX]
    : [...new Set([pendingOpsPrefixFor(companyId), pendingOpsPrefixFor(GLOBAL_CLIENT_SCOPE), pendingOpsPrefixFor(PATCH_GLOBAL_SCOPE)])];
  const entries = [];
  for (const prefix of prefixes) {
    let cursor;
    let pages = 0;
    do {
      const page = await env.GLOBAL_MARKET_KV.list({ prefix, cursor, limit: 100 });
      for (const key of page.keys || []) {
        const payload = await env.GLOBAL_MARKET_KV.get(key.name, 'json');
        if (payload?.operations?.length) entries.push({ key: key.name, payload });
      }
      cursor = page.list_complete ? undefined : page.cursor;
      pages += 1;
    } while (cursor && pages < 4);
  }
  entries.sort((a, b) => String(a.payload.queuedAt || '').localeCompare(String(b.payload.queuedAt || '')));
  return entries;
}

async function applyPendingOperationQueue(env, state, companyId = '*') {
  try {
    const entries = await listPendingOperationEntries(env, companyId);
    for (const entry of entries) applyPendingOperationsToState(state, entry.payload.operations);
    return { state: normalizeState(state), entries };
  } catch (error) {
    console.warn('File de secours non relue', error?.message || error);
    return { state: normalizeState(state), entries: [] };
  }
}

async function drainPendingOperationQueue(env, entries) {
  for (const entry of (entries || []).slice(0, 12)) {
    try {
      const statements = (entry.payload.operations || []).map(op => env.GLOBAL_MARKET_D1.prepare(`INSERT INTO company_state_patches(company_id, section, record_id, deleted, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(company_id, section, record_id) DO UPDATE SET deleted=excluded.deleted, data=excluded.data, updated_at=excluded.updated_at`)
        .bind(String(op.companyId || PATCH_GLOBAL_SCOPE), String(op.section || ''), String(op.recordId || ''), op.deleted ? 1 : 0, op.deleted ? null : patchJson(op.value), String(op.updatedAt || new Date().toISOString())));
      await enqueueD1Write(async () => runD1Batches(env.GLOBAL_MARKET_D1, statements, 4));
      await env.GLOBAL_MARKET_KV.delete(entry.key);
    } catch (error) {
      if (!isTransientStorageError(error)) console.warn('Échec de reprise de la file D1', error?.message || error);
      break;
    }
  }
}

function needBindings(env) {
  if (!env.GLOBAL_MARKET_KV) throw new Error('Binding KV manquant : GLOBAL_MARKET_KV');
  if (!env.GLOBAL_MARKET_D1) throw new Error('Binding D1 manquant : GLOBAL_MARKET_D1');
}

function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) throw new HttpError(403, 'Origine de requête refusée.', 'ORIGIN_REJECTED');
}

async function readJson(request, maxBytes = 8_000_000) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > maxBytes) throw new HttpError(413, 'Requête trop volumineuse.', 'PAYLOAD_TOO_LARGE');
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Corps JSON invalide.', 'INVALID_JSON');
  }
}

function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const part = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

function setCookie(name, value, maxAge) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (typeof maxAge === 'number') attrs.push(`Max-Age=${maxAge}`);
  return attrs.join('; ');
}

function randomHex(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map(v => v.toString(16).padStart(2, '0')).join('');
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function hexToBytes(hex) {
  const clean = String(hex || '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  return bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
}

async function derivePasswordHash(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: hexToBytes(saltHex),
    iterations: Number(iterations) || PASSWORD_ITERATIONS,
    hash: 'SHA-256'
  }, key, 256);
  return bytesToHex(bits);
}

function constantTimeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function validatePassword(password, role = 'user') {
  const value = String(password || '');
  const minimum = role === 'superadmin' || role === 'admin' ? 10 : 8;
  if (value.length < minimum) {
    throw new HttpError(400, `Le mot de passe doit contenir au moins ${minimum} caractères.`, 'WEAK_PASSWORD');
  }
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new HttpError(400, 'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.', 'WEAK_PASSWORD');
  }
  return value;
}

function authKey(userId) { return `auth:user:${userId}`; }
function authIndexKey(identifier) { return `auth:index:${normalizeIdentifier(identifier)}`; }
function clientAuthKey(clientId) { return `auth:client:${clientId}`; }
function clientIndexKey(companyId, phone) { return `auth:client-index:${companyId}:${normalizePhone(phone)}`; }
function globalClientIndexKey(phone) { return clientIndexKey(GLOBAL_CLIENT_SCOPE, phone); }

async function getAuth(env, userId) {
  return env.GLOBAL_MARKET_KV.get(authKey(userId), 'json');
}

async function getClientAuth(env, clientId) {
  return env.GLOBAL_MARKET_KV.get(clientAuthKey(clientId), 'json');
}

async function writeUserCredential(env, profile, password, options = {}) {
  validatePassword(password, profile.role);
  const old = await getAuth(env, profile.id);
  const salt = randomHex(16);
  const record = {
    userId: profile.id,
    identifier: normalizeIdentifier(profile.email || profile.username),
    salt,
    iterations: PASSWORD_ITERATIONS,
    hash: await derivePasswordHash(password, salt, PASSWORD_ITERATIONS),
    version: Number(old?.version || 0) + 1,
    mustChangePassword: Boolean(options.mustChangePassword),
    bootstrapVersion: old?.bootstrapVersion || null,
    updatedAt: new Date().toISOString()
  };
  if (old?.identifier && old.identifier !== record.identifier) await env.GLOBAL_MARKET_KV.delete(authIndexKey(old.identifier));
  await env.GLOBAL_MARKET_KV.put(authKey(profile.id), JSON.stringify(record));
  await env.GLOBAL_MARKET_KV.put(authIndexKey(record.identifier), profile.id);
  return record;
}

async function writeClientCredential(env, client, password) {
  validatePassword(password, 'client');
  const old = await getClientAuth(env, client.id);
  const salt = randomHex(16);
  const record = {
    clientId: client.id,
    companyId: client.companyId,
    phone: normalizePhone(client.phone),
    salt,
    iterations: PASSWORD_ITERATIONS,
    hash: await derivePasswordHash(password, salt, PASSWORD_ITERATIONS),
    version: Number(old?.version || 0) + 1,
    updatedAt: new Date().toISOString()
  };
  if (old?.phone && old.phone !== record.phone) await env.GLOBAL_MARKET_KV.delete(clientIndexKey(client.companyId, old.phone));
  await env.GLOBAL_MARKET_KV.put(clientAuthKey(client.id), JSON.stringify(record));
  await env.GLOBAL_MARKET_KV.put(clientIndexKey(client.companyId, record.phone), client.id);
  return record;
}

async function verifyCredential(record, password) {
  if (!record?.hash || !record?.salt) {
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(password || '')));
    return false;
  }
  const candidate = await derivePasswordHash(password, record.salt, record.iterations || PASSWORD_ITERATIONS);
  return constantTimeEqual(candidate, record.hash);
}

function dbSchemaStatements(env) {
  const sql = [
    `CREATE TABLE IF NOT EXISTS state_meta (company_id TEXT PRIMARY KEY, chunk_count INTEGER NOT NULL, size_bytes INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS state_chunks (company_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (company_id, chunk_index))`,
    `CREATE TABLE IF NOT EXISTS global_state_meta_v2 (document_id TEXT PRIMARY KEY, revision TEXT NOT NULL, chunk_count INTEGER NOT NULL, size_bytes INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS global_state_chunks_v2 (document_id TEXT NOT NULL, revision TEXT NOT NULL, chunk_index INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (document_id, revision, chunk_index))`,
    `CREATE TABLE IF NOT EXISTS company_state_meta (company_id TEXT PRIMARY KEY, revision TEXT NOT NULL, chunk_count INTEGER NOT NULL, size_bytes INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS company_state_chunks (company_id TEXT NOT NULL, revision TEXT NOT NULL, chunk_index INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (company_id, revision, chunk_index))`,
    `CREATE TABLE IF NOT EXISTS company_state_patches (company_id TEXT NOT NULL, section TEXT NOT NULL, record_id TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (company_id, section, record_id))`,
    `CREATE TABLE IF NOT EXISTS deleted_companies (company_id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS backups (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, actor_id TEXT, company_id TEXT, detail TEXT, ip_hash TEXT, created_at TEXT NOT NULL)`,

    `CREATE TABLE IF NOT EXISTS gm_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS gm_companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, status TEXT, plan_code TEXT,
      subscription_end TEXT, shop_slug TEXT, business_type TEXT, city TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_users (
      id TEXT PRIMARY KEY, company_id TEXT, name TEXT, email TEXT, role TEXT NOT NULL, status TEXT NOT NULL,
      main_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_items (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, code TEXT, name TEXT NOT NULL, category TEXT, item_type TEXT,
      sell REAL NOT NULL DEFAULT 0, stock REAL NOT NULL DEFAULT 0, stock_type TEXT, marketplace_hidden INTEGER NOT NULL DEFAULT 0,
      search_text TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_sales (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, client_id TEXT, sale_date TEXT, total REAL NOT NULL DEFAULT 0,
      status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_payments (
      id TEXT PRIMARY KEY, company_id TEXT, order_id TEXT, client_id TEXT, method TEXT, status TEXT,
      amount REAL NOT NULL DEFAULT 0, currency TEXT, transaction_id TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_orders (
      id TEXT PRIMARY KEY, checkout_id TEXT, company_id TEXT NOT NULL, client_id TEXT NOT NULL, order_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0, delivery_fee REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
      delivery_city TEXT, delivery_neighborhood TEXT, shipping_method TEXT, payment_method TEXT,
      payment_status TEXT, validation_status TEXT, delivery_status TEXT, deleted_by_client INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, item_id TEXT, item_name TEXT, category TEXT,
      item_type TEXT, qty REAL NOT NULL DEFAULT 0, unit REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(order_id) REFERENCES gm_orders(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS gm_clients (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, name TEXT, phone TEXT, email TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_market_clients (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, email TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_market_messages (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, client_id TEXT, sender_type TEXT NOT NULL, sender_name TEXT,
      body TEXT NOT NULL, admin_deleted INTEGER NOT NULL DEFAULT 0, client_deleted INTEGER NOT NULL DEFAULT 0,
      read_by_admin INTEGER NOT NULL DEFAULT 0, read_by_client INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_password_reset_requests (
      id TEXT PRIMARY KEY, company_id TEXT, user_id TEXT, role TEXT, status TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gm_stock_entries (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS gm_stock_outputs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS gm_stock_movements (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS gm_caisse_logs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS gm_company_settings (
      company_id TEXT NOT NULL, section TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(company_id, section)
    )`,
    `CREATE TABLE IF NOT EXISTS gm_client_order_hidden (
      client_id TEXT NOT NULL, order_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(client_id, order_id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_global_state_chunks_v2_current ON global_state_chunks_v2(document_id, revision, chunk_index)`,
    `CREATE INDEX IF NOT EXISTS idx_company_state_chunks_current ON company_state_chunks(company_id, revision, chunk_index)`,
    `CREATE INDEX IF NOT EXISTS idx_company_state_patches_scope ON company_state_patches(company_id, section, record_id)`,
    `CREATE INDEX IF NOT EXISTS idx_backups_company_id ON backups(company_id, id DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_companies_shop_slug ON gm_companies(shop_slug)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_companies_status ON gm_companies(status, subscription_end)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_users_company ON gm_users(company_id, role, status)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_gm_users_email ON gm_users(email) WHERE email IS NOT NULL AND email <> ''`,
    `CREATE INDEX IF NOT EXISTS idx_gm_items_market ON gm_items(marketplace_hidden, company_id, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_items_company ON gm_items(company_id, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_items_category ON gm_items(category, marketplace_hidden, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_orders_client ON gm_orders(client_id, order_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_orders_company_status ON gm_orders(company_id, validation_status, payment_status, order_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_order_items_order ON gm_order_items(order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_messages_company ON gm_market_messages(company_id, admin_deleted, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_messages_client ON gm_market_messages(client_id, client_deleted, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_sales_company_date ON gm_sales(company_id, sale_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_payments_company_date ON gm_payments(company_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_gm_reset_status ON gm_password_reset_requests(status, created_at DESC)`,
    `CREATE TRIGGER IF NOT EXISTS trg_gm_items_nonnegative_stock BEFORE UPDATE OF stock ON gm_items
       WHEN NEW.stock < 0 AND COALESCE(OLD.stock_type,'') <> 'unlimited'
       BEGIN SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK'); END`
  ];
  return sql.map(statement => env.GLOBAL_MARKET_D1.prepare(statement));
}

async function ensureDB(env) {
  needBindings(env);
  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      try {
        await env.GLOBAL_MARKET_D1.prepare('SELECT key FROM gm_meta LIMIT 1').first();
        return true;
      } catch (error) {
        const message = String(error?.message || error || '');
        if (!/no such table|does not exist|missing table/i.test(message)) throw error;
        await runD1Batches(env.GLOBAL_MARKET_D1, dbSchemaStatements(env), 20);
        return true;
      }
    })().catch(error => { dbReadyPromise = null; throw error; });
  }
  await dbReadyPromise;
}

function defaultState() {
  return {
    companies: [],
    users: [{ ...SUPER_ADMIN_PROFILE }],
    items: [],
    sales: [],
    payments: [],
    orders: [],
    clients: [],
    marketClients: [],
    marketMessages: [],
    passwordResetRequests: [],
    app: { name: APP_NAME, storageVersion: 3, initializedAt: new Date().toISOString() }
  };
}

function dateOnlyPlusDays(startValue, days) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(startValue || '')) ? new Date(String(startValue) + 'T00:00:00Z') : new Date();
  return new Date(base.getTime() + Number(days || 0) * 86400000).toISOString().slice(0, 10);
}

function normalizeState(value) {
  const data = value && typeof value === 'object' ? value : {};
  for (const key of ['companies', 'users', 'items', 'sales', 'payments', 'orders', 'clients', 'marketClients', 'marketMessages', 'passwordResetRequests']) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  if (!data.app || typeof data.app !== 'object') data.app = {};
  data.app.name = APP_NAME;
  data.app.storageVersion = 4;
  data.companies = data.companies.map(company => {
    if (!company || typeof company !== 'object') return company;
    const rawPlan = String(company.planCode || company.plan || company.status || 'FREE').toUpperCase();
    const code = rawPlan.includes('BUSINESS') || rawPlan.includes('PLUS') ? 'BUSINESS' : 'FREE';
    const duration = code === 'BUSINESS' ? 365 : 21;
    const start = String(company.subscriptionStart || company.createdAt || new Date().toISOString()).slice(0, 10);
    company.planCode = code;
    company.plan = code === 'BUSINESS' ? 'Plan Business — 365 jours' : 'Plan Free — 21 jours';
    if (['FREE', 'BUSINESS', 'BUSINESS_PLUS'].includes(String(company.status || '').toUpperCase())) company.status = code;
    company.subscriptionStart = start;
    company.subscriptionEnd = dateOnlyPlusDays(start, duration);
    return company;
  });
  const index = data.users.findIndex(u => u && (u.id === SUPER_ADMIN_ID || u.role === 'superadmin'));
  if (index < 0) data.users.unshift({ ...SUPER_ADMIN_PROFILE });
  else data.users[index] = { ...data.users[index], ...SUPER_ADMIN_PROFILE };
  delete data.loginAttempts;
  return data;
}

function parseState(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed);
  } catch {
    return null;
  }
}

function parseStateStorageMarker(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.__globalMarketStorage === 'd1' ? parsed : null;
  } catch {
    return null;
  }
}

function makeStateStorageMarker(sizeBytes, updatedAt) {
  return JSON.stringify({
    __globalMarketStorage: 'd1',
    sizeBytes,
    updatedAt
  });
}

function chunksOf(text, maxBytes = D1_CHUNK_MAX_BYTES) {
  const encoder = new TextEncoder();
  const chunks = [];
  let offset = 0;
  while (offset < text.length) {
    let low = offset + 1;
    let high = text.length;
    let best = low;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (encoder.encode(text.slice(offset, middle)).byteLength <= maxBytes) {
        best = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    chunks.push(text.slice(offset, best));
    offset = best;
  }
  return chunks.length ? chunks : ['{}'];
}

async function readD1State(env, companyId) {
  const meta = await env.GLOBAL_MARKET_D1.prepare('SELECT chunk_count FROM state_meta WHERE company_id = ?').bind(companyId).first();
  if (meta?.chunk_count) {
    const result = await env.GLOBAL_MARKET_D1.prepare('SELECT data FROM state_chunks WHERE company_id = ? ORDER BY chunk_index ASC').bind(companyId).all();
    const parsed = parseState((result.results || []).map(row => row.data || '').join(''));
    if (parsed) return parsed;
  }
  try {
    const last = await env.GLOBAL_MARKET_D1.prepare('SELECT data FROM backups WHERE company_id = ? ORDER BY id DESC LIMIT 1').bind(companyId).first();
    return parseState(last?.data || '');
  } catch {
    return null;
  }
}

async function writeD1State(env, companyId, raw) {
  const chunks = chunksOf(raw);
  const now = new Date().toISOString();
  const sizeBytes = new TextEncoder().encode(raw).byteLength;
  const statements = [
    env.GLOBAL_MARKET_D1.prepare('DELETE FROM state_chunks WHERE company_id = ?').bind(companyId),
    env.GLOBAL_MARKET_D1.prepare(`INSERT INTO state_meta(company_id, chunk_count, size_bytes, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(company_id) DO UPDATE SET chunk_count=excluded.chunk_count, size_bytes=excluded.size_bytes, updated_at=excluded.updated_at`
    ).bind(companyId, chunks.length, sizeBytes, now)
  ];
  chunks.forEach((chunk, index) => statements.push(
    env.GLOBAL_MARKET_D1.prepare('INSERT INTO state_chunks(company_id, chunk_index, data) VALUES (?, ?, ?)').bind(companyId, index, chunk)
  ));
  await env.GLOBAL_MARKET_D1.batch(statements);
  if (sizeBytes <= D1_BACKUP_MAX_BYTES) {
    await env.GLOBAL_MARKET_D1.prepare('INSERT INTO backups(company_id, data, created_at) VALUES (?, ?, ?)').bind(companyId, raw, now).run();
    await env.GLOBAL_MARKET_D1.prepare(`DELETE FROM backups WHERE company_id = ? AND id NOT IN (
      SELECT id FROM backups WHERE company_id = ? ORDER BY id DESC LIMIT 20
    )`).bind(companyId, companyId).run();
  }
  return { chunkCount: chunks.length, sizeBytes, historicalBackup: sizeBytes <= D1_BACKUP_MAX_BYTES };
}


async function runD1Batches(db, statements, batchSize = COMPANY_BATCH_SIZE) {
  for (let index = 0; index < statements.length; index += batchSize) {
    const batch = statements.slice(index, index + batchSize);
    let lastError = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await db.batch(batch);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        const message = String(error?.message || error || '');
        const temporary = /SQLITE_BUSY|database is locked|\bbusy\b|\blocked\b|overload|temporar(?:y|ily)|too many requests|rate.?limit/i.test(message);
        if (!temporary || attempt === 5) throw error;
        const delays = [120, 300, 700, 1400, 2800, 5200];
        await new Promise(resolve => setTimeout(resolve, delays[attempt] + Math.floor(Math.random() * 180)));
      }
    }
    if (lastError) throw lastError;
  }
}

function enqueueD1Write(task) {
  const run = d1WriteQueue.then(task, task);
  d1WriteQueue = run.catch(() => undefined);
  return run;
}

async function writeGlobalStateV2(env, raw) {
  const sizeBytes = new TextEncoder().encode(raw).byteLength;
  const revision = `${Date.now().toString(36)}_${randomHex(8)}`;
  const chunks = chunksOf(raw, GLOBAL_CHUNK_MAX_BYTES);
  if (chunks.length + 3 > 50) {
    throw new HttpError(413, 'La base globale dépasse la capacité de sauvegarde du plan Cloudflare actuel. Réduisez les images et captures.', 'GLOBAL_STATE_TOO_LARGE');
  }
  const inserts = chunks.map((chunk, chunkIndex) => env.GLOBAL_MARKET_D1.prepare(
    'INSERT INTO global_state_chunks_v2(document_id, revision, chunk_index, data) VALUES (?, ?, ?, ?)'
  ).bind(STATE_ID, revision, chunkIndex, chunk));
  await runD1Batches(env.GLOBAL_MARKET_D1, inserts);
  const updatedAt = new Date().toISOString();
  await env.GLOBAL_MARKET_D1.prepare(`INSERT INTO global_state_meta_v2(document_id, revision, chunk_count, size_bytes, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET revision=excluded.revision, chunk_count=excluded.chunk_count,
      size_bytes=excluded.size_bytes, updated_at=excluded.updated_at`
  ).bind(STATE_ID, revision, chunks.length, sizeBytes, updatedAt).run();
  try {
    await env.GLOBAL_MARKET_D1.prepare(
      'DELETE FROM global_state_chunks_v2 WHERE document_id = ? AND revision <> ?'
    ).bind(STATE_ID, revision).run();
  } catch (error) {
    console.warn('Nettoyage différé des anciennes révisions globales', error?.message || error);
  }
  return { revision, chunkCount: chunks.length, sizeBytes, historicalBackup: false };
}

async function readGlobalStateV2(env) {
  const meta = await env.GLOBAL_MARKET_D1.prepare(
    'SELECT revision, chunk_count FROM global_state_meta_v2 WHERE document_id = ?'
  ).bind(STATE_ID).first();
  if (!meta?.revision) return null;
  const result = await env.GLOBAL_MARKET_D1.prepare(
    'SELECT data FROM global_state_chunks_v2 WHERE document_id = ? AND revision = ? ORDER BY chunk_index ASC'
  ).bind(STATE_ID, meta.revision).all();
  if ((result.results || []).length !== Number(meta.chunk_count || 0)) return null;
  return parseState((result.results || []).map(row => row.data || '').join(''));
}

function companySnapshotFromState(state, companyId) {
  return scopeState(state, { role: 'admin', companyId });
}

async function writeCompanySnapshot(env, companyId, state) {
  await ensureDB(env);
  const snapshot = companySnapshotFromState(state, companyId);
  for (const user of snapshot.users || []) stripCredentialFields(user);
  for (const client of snapshot.marketClients || []) stripCredentialFields(client);
  snapshot.app = { ...(snapshot.app || {}), updatedAt: new Date().toISOString() };
  const raw = JSON.stringify(snapshot);
  const sizeBytes = new TextEncoder().encode(raw).byteLength;
  if (sizeBytes > MAX_COMPANY_STATE_BYTES) {
    throw new HttpError(413, 'Les données de cette entreprise sont trop volumineuses pour une sauvegarde fiable. Réduisez surtout les anciennes captures et les images.', 'COMPANY_STATE_TOO_LARGE');
  }
  const revision = `${Date.now().toString(36)}_${randomHex(8)}`;
  const chunks = chunksOf(raw, COMPANY_CHUNK_MAX_BYTES);
  const inserts = chunks.map((chunk, chunkIndex) => env.GLOBAL_MARKET_D1.prepare(
    'INSERT INTO company_state_chunks(company_id, revision, chunk_index, data) VALUES (?, ?, ?, ?)'
  ).bind(companyId, revision, chunkIndex, chunk));

  // Les petits lots évitent d'envoyer plusieurs mégaoctets dans un seul db.batch().
  await runD1Batches(env.GLOBAL_MARKET_D1, inserts);
  const updatedAt = new Date().toISOString();
  await env.GLOBAL_MARKET_D1.prepare(`INSERT INTO company_state_meta(company_id, revision, chunk_count, size_bytes, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision, chunk_count=excluded.chunk_count,
      size_bytes=excluded.size_bytes, updated_at=excluded.updated_at`
  ).bind(companyId, revision, chunks.length, sizeBytes, updatedAt).run();

  // Le pointeur est déjà publié : le nettoyage ne doit jamais bloquer la sauvegarde.
  try {
    await env.GLOBAL_MARKET_D1.prepare(
      'DELETE FROM company_state_chunks WHERE company_id = ? AND revision <> ?'
    ).bind(companyId, revision).run();
  } catch (error) {
    console.warn('Nettoyage différé des anciennes révisions entreprise', companyId, error?.message || error);
  }
  return { companyId, revision, chunkCount: chunks.length, sizeBytes, storage: 'd1-company' };
}

async function readCompanySnapshots(env, companyId = null) {
  await ensureDB(env);
  const query = companyId
    ? env.GLOBAL_MARKET_D1.prepare(`SELECT c.company_id, c.chunk_index, c.data, m.chunk_count
        FROM company_state_chunks c
        INNER JOIN company_state_meta m ON m.company_id = c.company_id AND m.revision = c.revision
        WHERE c.company_id = ?
        ORDER BY c.company_id ASC, c.chunk_index ASC`).bind(companyId)
    : env.GLOBAL_MARKET_D1.prepare(`SELECT c.company_id, c.chunk_index, c.data, m.chunk_count
        FROM company_state_chunks c
        INNER JOIN company_state_meta m ON m.company_id = c.company_id AND m.revision = c.revision
        ORDER BY c.company_id ASC, c.chunk_index ASC`);
  const result = await query.all();
  const groups = new Map();
  for (const row of result.results || []) {
    if (!groups.has(row.company_id)) groups.set(row.company_id, { count: Number(row.chunk_count || 0), chunks: [] });
    groups.get(row.company_id).chunks.push(row.data || '');
  }
  const snapshots = [];
  for (const [id, group] of groups) {
    if (group.chunks.length !== group.count) continue;
    const parsed = parseState(group.chunks.join(''));
    if (parsed) snapshots.push({ companyId: id, state: parsed });
  }
  return snapshots;
}

function applyCompanySnapshot(globalState, companyId, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return globalState;
  return mergeScopedState(globalState, snapshot, { role: 'admin', companyId });
}

function removeCompanyOperationalData(state, companyId) {
  const compacted = cleanClone(state);
  for (const key of COMPANY_ARRAY_KEYS) {
    if (key === 'payments' || key === 'passwordResetRequests') continue;
    compacted[key] = (compacted[key] || []).filter(row => row?.companyId !== companyId);
  }
  for (const key of COMPANY_OBJECT_KEYS) {
    if (compacted[key] && typeof compacted[key] === 'object') delete compacted[key][companyId];
  }
  const clientIds = new Set((state.marketClients || []).filter(row => row?.companyId === companyId).map(row => row.id));
  if (compacted.clientDeletedOrders && typeof compacted.clientDeletedOrders === 'object') {
    for (const clientId of clientIds) delete compacted.clientDeletedOrders[clientId];
  }
  return compacted;
}

async function compactGlobalBaseAfterCompanySave(env, state, companyId) {
  try {
    const compacted = removeCompanyOperationalData(state, companyId);
    await saveState(env, compacted);
  } catch (error) {
    // La sauvegarde entreprise est déjà durable. Une compaction ratée ne doit jamais
    // transformer une sauvegarde réussie en erreur 503 côté utilisateur.
    console.warn('Compaction globale différée non effectuée', companyId, error?.message || error);
  }
}

function stripCredentialFields(object) {
  if (!object || typeof object !== 'object') return false;
  let changed = false;
  for (const field of SENSITIVE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(object, field)) {
      delete object[field];
      changed = true;
    }
  }
  return changed;
}

function containsCredentialFields(value, depth = 0) {
  if (depth > 8 || !value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => containsCredentialFields(item, depth + 1));
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_FIELDS.has(key)) return true;
    if (containsCredentialFields(child, depth + 1)) return true;
  }
  return false;
}

async function migrateLegacyCredentials(env, state) {
  let changed = false;
  for (const user of state.users || []) {
    if (!user || user.id === SUPER_ADMIN_ID) {
      changed = stripCredentialFields(user) || changed;
      continue;
    }
    const existing = await getAuth(env, user.id);
    if (!existing && user.passwordHash && user.passwordSalt) {
      const record = {
        userId: user.id,
        identifier: normalizeIdentifier(user.email || user.username),
        salt: String(user.passwordSalt),
        iterations: Number(user.passwordIterations || PASSWORD_ITERATIONS),
        hash: String(user.passwordHash),
        version: 1,
        mustChangePassword: Boolean(user.mustChangePassword),
        updatedAt: new Date().toISOString()
      };
      await env.GLOBAL_MARKET_KV.put(authKey(user.id), JSON.stringify(record));
      if (record.identifier) await env.GLOBAL_MARKET_KV.put(authIndexKey(record.identifier), user.id);
    } else if (!existing && typeof user.password === 'string' && user.password) {
      await writeUserCredential(env, user, user.password, { mustChangePassword: Boolean(user.mustChangePassword) });
    } else if (existing?.identifier) {
      await env.GLOBAL_MARKET_KV.put(authIndexKey(existing.identifier), user.id);
    }
    changed = stripCredentialFields(user) || changed;
  }
  for (const client of state.marketClients || []) {
    if (!client) continue;
    const existing = await getClientAuth(env, client.id);
    if (!existing && client.passwordHash && client.passwordSalt) {
      const record = {
        clientId: client.id,
        companyId: client.companyId,
        phone: normalizePhone(client.phone),
        salt: String(client.passwordSalt),
        iterations: Number(client.passwordIterations || PASSWORD_ITERATIONS),
        hash: String(client.passwordHash),
        version: 1,
        updatedAt: new Date().toISOString()
      };
      await env.GLOBAL_MARKET_KV.put(clientAuthKey(client.id), JSON.stringify(record));
      await env.GLOBAL_MARKET_KV.put(clientIndexKey(client.companyId, record.phone), client.id);
    } else if (!existing && typeof client.password === 'string' && client.password) {
      await writeClientCredential(env, client, client.password);
    }
    changed = stripCredentialFields(client) || changed;
  }
  return changed;
}

async function ensureLegacyCredentialsMigrated(env, state) {
  if (legacyMigrationChecked) return false;
  const completed = await env.GLOBAL_MARKET_KV.get(LEGACY_CREDENTIAL_MIGRATION_KEY);
  if (completed) {
    legacyMigrationChecked = true;
    return false;
  }
  const changed = await migrateLegacyCredentials(env, state);
  await env.GLOBAL_MARKET_KV.put(LEGACY_CREDENTIAL_MIGRATION_KEY, new Date().toISOString());
  legacyMigrationChecked = true;
  return changed;
}

async function saveState(env, state) {
  await ensureDB(env);
  const normalized = normalizeState(state);
  for (const user of normalized.users) stripCredentialFields(user);
  for (const client of normalized.marketClients) stripCredentialFields(client);
  normalized.app.updatedAt = new Date().toISOString();
  const raw = JSON.stringify(normalized);
  const sizeBytes = new TextEncoder().encode(raw).byteLength;
  if (sizeBytes > MAX_STATE_BYTES) {
    throw new HttpError(413, 'La base de données globale est trop volumineuse. Réduisez les images et captures enregistrées.', 'STATE_TOO_LARGE');
  }

  // D1 versionné est la source durable. Aucun PUT répété sur la même clé KV :
  // cela supprime la limite KV d'une écriture par seconde qui provoquait des échecs.
  const d1 = await writeGlobalStateV2(env, raw);
  return { state: normalized, d1, storage: 'd1-versioned' };
}

async function loadStatePrimary(env, companyId = '*') {
  await ensureDB(env);
  let state = await readGlobalStateV2(env);
  if (!state) {
    const kvRaw = await env.GLOBAL_MARKET_KV.get(STATE_KEY);
    const marker = parseStateStorageMarker(kvRaw);
    state = marker ? null : parseState(kvRaw);
    if (!state) state = await readD1State(env, STATE_ID);
    if (!state) state = defaultState();
  }
  state = normalizeState(state);
  await ensureLegacyCredentialsMigrated(env, state);
  const snapshots = await readCompanySnapshots(env, companyId === '*' ? null : companyId);
  for (const entry of snapshots) state = applyCompanySnapshot(state, entry.companyId, entry.state);
  state = await applyStoredStatePatches(env, state, companyId);
  state = await applyDeletedCompanies(env, state, companyId);
  return normalizeState(state);
}

async function loadStateLegacy(env, companyId = '*') {
  let primaryState = null;
  let lastError = null;
  try {
    primaryState = await withStorageRetry(() => loadStatePrimary(env, companyId), 4);
  } catch (error) {
    lastError = error;
    if (!isTransientStorageError(error)) throw error;
  }

  let state = primaryState || await readStateFallback(env, companyId);
  if (!state && companyId !== '*') state = await readStateFallback(env, '*');
  if (!state) throw lastError || new HttpError(503, 'Le stockage cloud est temporairement indisponible.', 'STORAGE_BUSY', { 'Retry-After': '2' });

  const pending = await applyPendingOperationQueue(env, state, companyId);
  state = pending.state;

  if (primaryState) {
    await writeStateFallback(env, companyId, state);
    // Reprise opportuniste non bloquante : la lecture reste prioritaire.
    if (pending.entries.length) drainPendingOperationQueue(env, pending.entries).catch(error => console.warn('Reprise D1 différée', error?.message || error));
  }
  return normalizeState(state);
}

async function ensureSuperAdminCredential(env, state) {
  const identifier = requireSuperAdminIdentifier(env);
  const desiredBootstrapVersion = configuredSuperAdminPasswordVersion(env);
  const existing = await getAuth(env, SUPER_ADMIN_ID);
  // Une mise à jour du code ne doit jamais invalider un identifiant déjà fonctionnel.
  // Le secret initial est exigé uniquement lors de la toute première initialisation.
  const needsCredentialSync = !existing?.hash;

  if (!needsCredentialSync) {
    if (existing.identifier && existing.identifier !== identifier) await env.GLOBAL_MARKET_KV.delete(authIndexKey(existing.identifier));
    if (existing.identifier !== identifier) {
      existing.identifier = identifier;
      existing.updatedAt = new Date().toISOString();
      await env.GLOBAL_MARKET_KV.put(authKey(SUPER_ADMIN_ID), JSON.stringify(existing));
    }
    await env.GLOBAL_MARKET_KV.put(authIndexKey(identifier), SUPER_ADMIN_ID);
    if (!(await env.GLOBAL_MARKET_KV.get(AUTH_INIT_KEY))) await env.GLOBAL_MARKET_KV.put(AUTH_INIT_KEY, new Date().toISOString());
    return existing;
  }

  const initialPassword = String(env.SUPER_ADMIN_INITIAL_PASSWORD || '');
  if (!initialPassword) {
    throw new HttpError(428, 'Configuration requise : ajoutez le secret Cloudflare SUPER_ADMIN_INITIAL_PASSWORD.', 'SETUP_REQUIRED');
  }

  const publicProfile = state.users.find(u => u.id === SUPER_ADMIN_ID) || { ...SUPER_ADMIN_PROFILE };
  const credentialProfile = { ...publicProfile, email: identifier };
  const auth = await writeUserCredential(env, credentialProfile, initialPassword, { mustChangePassword: false });
  auth.bootstrapVersion = desiredBootstrapVersion;
  auth.updatedAt = new Date().toISOString();
  await env.GLOBAL_MARKET_KV.put(authKey(SUPER_ADMIN_ID), JSON.stringify(auth));
  await env.GLOBAL_MARKET_KV.put(authIndexKey(identifier), SUPER_ADMIN_ID);
  await env.GLOBAL_MARKET_KV.put(AUTH_INIT_KEY, new Date().toISOString());
  await audit(
    env,
    existing?.hash ? 'SUPERADMIN_CREDENTIAL_RESYNCED' : 'SUPERADMIN_INITIALIZED',
    SUPER_ADMIN_ID,
    null,
    existing?.hash ? 'Synchronisation sécurisée du mot de passe Super Admin depuis le secret Cloudflare' : 'Initialisation unique du compte Super Admin',
    ''
  );
  return auth;
}

async function audit(env, eventType, actorId, companyId, detail, ip) {
  try {
    await ensureDB(env);
    const ipHash = ip ? (await sha256Hex(ip)).slice(0, 32) : '';
    await env.GLOBAL_MARKET_D1.prepare(
      'INSERT INTO security_events(event_type, actor_id, company_id, detail, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(eventType, actorId || null, companyId || null, String(detail || '').slice(0, 1000), ipHash || null, new Date().toISOString()).run();
  } catch (error) {
    console.warn('Audit non enregistré', error);
  }
}

function requestIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

async function rateKeyHash(value) {
  return (await sha256Hex(value)).slice(0, 40);
}

async function getRateRecord(env, key) {
  return (await env.GLOBAL_MARKET_KV.get(key, 'json')) || { count: 0, resetAt: 0 };
}

async function assertLoginRateAllowed(env, ip, identifier) {
  const now = Date.now();
  const ipKey = `rate:login:ip:${await rateKeyHash(ip)}`;
  const accountKey = `rate:login:account:${await rateKeyHash(normalizeIdentifier(identifier))}`;
  const [ipRec, accountRec] = await Promise.all([getRateRecord(env, ipKey), getRateRecord(env, accountKey)]);
  const normalize = rec => rec.resetAt > now ? rec : { count: 0, resetAt: now + 15 * 60 * 1000 };
  const i = normalize(ipRec);
  const a = normalize(accountRec);
  if (i.count >= 30 || a.count >= 5) {
    const retryAt = Math.max(i.count >= 30 ? i.resetAt : 0, a.count >= 5 ? a.resetAt : 0);
    const retry = Math.max(1, Math.ceil((retryAt - now) / 1000));
    throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.', 'RATE_LIMITED', { 'Retry-After': String(retry) });
  }
  return { ipKey, accountKey, ipRec: i, accountRec: a };
}

async function recordLoginFailure(env, rate) {
  const ttl = 15 * 60;
  rate.ipRec.count += 1;
  rate.accountRec.count += 1;
  await Promise.all([
    env.GLOBAL_MARKET_KV.put(rate.ipKey, JSON.stringify(rate.ipRec), { expirationTtl: ttl }),
    env.GLOBAL_MARKET_KV.put(rate.accountKey, JSON.stringify(rate.accountRec), { expirationTtl: ttl })
  ]);
}

async function clearLoginRate(env, rate) {
  await Promise.all([env.GLOBAL_MARKET_KV.delete(rate.ipKey), env.GLOBAL_MARKET_KV.delete(rate.accountKey)]);
}

function companyStatus(company) {
  if (!company) return 'blocked';
  if (['blocked', 'suspended'].includes(company.status)) return company.status;
  const today = new Date().toISOString().slice(0, 10);
  if (company.subscriptionEnd && company.subscriptionEnd < today) return 'expired';
  return company.status || company.planCode || 'FREE';
}

function isCashierInAllowedHours(user, now = new Date()) {
  if (user?.role !== 'caisse') return true;
  const valid = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
  const startText = valid(user.caisseStartTime) ? user.caisseStartTime : '07:00';
  const endText = valid(user.caisseEndTime) ? user.caisseEndTime : '22:00';
  const toMinutes = v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const start = toMinutes(startText), end = toMinutes(endText), current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  return start < end ? current >= start && current <= end : current >= start || current <= end;
}

function publicSessionView(session) {
  if (!session) return null;
  return {
    userId: session.userId,
    companyId: session.companyId,
    role: session.role,
    loginAt: session.loginAt,
    expiresAt: session.expiresAt,
    csrfToken: session.csrfToken
  };
}

function publicClientSessionView(session) {
  if (!session) return null;
  return {
    clientId: session.clientId,
    companyId: session.companyId,
    expiresAt: session.expiresAt,
    csrfToken: session.csrfToken
  };
}

async function createEmployeeSession(env, user, auth) {
  const sid = randomHex(32);
  const ttl = user.role === 'caisse' ? Math.max(5, Number(user.sessionMinutes || 60)) * 60 : EMPLOYEE_SESSION_TTL;
  const session = {
    userId: user.id,
    companyId: user.companyId || null,
    role: user.role,
    authVersion: Number(auth.version || 1),
    csrfToken: randomHex(24),
    loginAt: Date.now(),
    expiresAt: Date.now() + ttl * 1000
  };
  await env.GLOBAL_MARKET_KV.put(`session:${sid}`, JSON.stringify(session), { expirationTtl: ttl });
  return { sid, ttl, session };
}

async function getEmployeeSession(request, env, requireCsrf = false) {
  const sid = getCookie(request, EMPLOYEE_SESSION_COOKIE);
  if (!sid) throw new HttpError(401, 'Connexion requise.', 'UNAUTHENTICATED');
  const session = await env.GLOBAL_MARKET_KV.get(`session:${sid}`, 'json');
  if (!session || Number(session.expiresAt || 0) <= Date.now()) {
    if (sid) await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);
    throw new HttpError(401, 'Session expirée. Reconnectez-vous.', 'SESSION_EXPIRED');
  }
  if (requireCsrf) {
    assertSameOrigin(request);
    const csrf = request.headers.get('X-CSRF-Token') || '';
    if (!csrf || !constantTimeEqual(csrf, session.csrfToken)) throw new HttpError(403, 'Jeton de sécurité invalide.', 'CSRF_REJECTED');
  }
  const state = await loadState(env, session.role === 'superadmin' ? '*' : session.companyId);
  const user = state.users.find(u => u.id === session.userId);
  const auth = user ? await getAuth(env, user.id) : null;
  if (!user || user.status !== 'active' || !auth || Number(auth.version) !== Number(session.authVersion)) {
    await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);
    throw new HttpError(401, 'Session invalidée. Reconnectez-vous.', 'SESSION_INVALIDATED');
  }
  if (user.role !== session.role || (user.companyId || null) !== (session.companyId || null)) {
    await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);
    throw new HttpError(401, 'Session incohérente.', 'SESSION_INVALIDATED');
  }
  return { sid, session, state, user, auth };
}

async function createClientSession(env, client, auth) {
  const sid = randomHex(32);
  const session = {
    clientId: client.id,
    companyId: client.companyId,
    authVersion: Number(auth.version || 1),
    csrfToken: randomHex(24),
    expiresAt: Date.now() + CLIENT_SESSION_TTL * 1000
  };
  await env.GLOBAL_MARKET_KV.put(`client-session:${sid}`, JSON.stringify(session), { expirationTtl: CLIENT_SESSION_TTL });
  return { sid, session };
}

async function getClientSession(request, env, requireCsrf = false, suppliedState = null) {
  const sid = getCookie(request, CLIENT_SESSION_COOKIE);
  if (!sid) throw new HttpError(401, 'Connexion client requise.', 'CLIENT_UNAUTHENTICATED');
  const session = await env.GLOBAL_MARKET_KV.get(`client-session:${sid}`, 'json');
  if (!session || Number(session.expiresAt || 0) <= Date.now()) {
    if (sid) await env.GLOBAL_MARKET_KV.delete(`client-session:${sid}`);
    throw new HttpError(401, 'Session client expirée.', 'CLIENT_SESSION_EXPIRED');
  }
  if (requireCsrf) {
    assertSameOrigin(request);
    const csrf = request.headers.get('X-CSRF-Token') || '';
    if (!csrf || !constantTimeEqual(csrf, session.csrfToken)) throw new HttpError(403, 'Jeton de sécurité client invalide.', 'CSRF_REJECTED');
  }
  // Le compte client GLOBAL MARKET n'appartient plus à une boutique particulière.
  // On charge donc l'état global afin de retrouver le même client et ses commandes multi-boutiques.
  const state = suppliedState || await loadState(env, '*');
  const client = state.marketClients.find(c => c.id === session.clientId);
  const auth = client ? await getClientAuth(env, client.id) : null;
  if (!client || !auth || Number(auth.version) !== Number(session.authVersion)) {
    await env.GLOBAL_MARKET_KV.delete(`client-session:${sid}`);
    throw new HttpError(401, 'Session client invalidée.', 'CLIENT_SESSION_INVALIDATED');
  }
  return { sid, session, state, client, auth };
}

function requireRole(user, roles) {
  if (!roles.includes(user?.role)) throw new HttpError(403, 'Action non autorisée pour ce profil.', 'FORBIDDEN');
}

function cleanClone(value) {
  const cloned = structuredClone(value);
  const walk = current => {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) return current.forEach(walk);
    for (const key of Object.keys(current)) {
      if (SENSITIVE_FIELDS.has(key)) delete current[key];
      else walk(current[key]);
    }
  };
  walk(cloned);
  return cloned;
}

const COMPANY_ARRAY_KEYS = [
  'items', 'sales', 'orders', 'clients', 'marketClients', 'marketMessages', 'stockEntries', 'stockOutputs',
  'stockMovements', 'caisseLogs', 'passwordResetRequests', 'payments'
];
const COMPANY_OBJECT_KEYS = ['categories', 'monthlyObligations', 'obligations', 'cartClearedAt', 'cartValidatedAt'];

function scopeState(state, user) {
  const safe = cleanClone(state);
  delete safe.loginAttempts;
  if (user.role === 'superadmin') return safe;
  const companyId = user.companyId;
  const result = { app: safe.app || {}, companies: safe.companies.filter(c => c.id === companyId), users: safe.users.filter(u => u.companyId === companyId) };
  for (const key of COMPANY_ARRAY_KEYS) {
    if (key === 'payments') {
      result[key] = [];
      continue;
    }
    result[key] = (safe[key] || []).filter(row => row && row.companyId === companyId);
  }
  for (const key of COMPANY_OBJECT_KEYS) {
    result[key] = safe[key] && typeof safe[key] === 'object' ? { [companyId]: safe[key][companyId] } : {};
  }
  const clientIds = new Set((result.marketClients || []).map(c => c.id));
  result.clientDeletedOrders = {};
  for (const [clientId, rows] of Object.entries(safe.clientDeletedOrders || {})) if (clientIds.has(clientId)) result.clientDeletedOrders[clientId] = rows;
  return result;
}

function replaceCompanyRows(globalRows, incomingRows, companyId) {
  const keep = (globalRows || []).filter(row => row?.companyId !== companyId);
  const scoped = (incomingRows || []).filter(row => row && (row.companyId === companyId || !row.companyId)).map(row => ({ ...row, companyId }));
  return keep.concat(scoped);
}

function safeCompanyUpdate(existing, incoming) {
  const protectedFields = new Set(['id', 'status', 'plan', 'planCode', 'subscriptionStart', 'subscriptionEnd', 'createdAt']);
  const updated = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) if (!protectedFields.has(key)) updated[key] = value;
  return updated;
}

function mergeScopedState(globalState, incoming, user) {
  if (containsCredentialFields(incoming)) throw new HttpError(400, 'Les mots de passe ne doivent jamais être enregistrés dans les données de l’application.', 'CREDENTIALS_IN_STATE');
  if (user.role === 'superadmin') {
    const merged = normalizeState(cleanClone(incoming));
    const superProfile = globalState.users.find(u => u.id === SUPER_ADMIN_ID) || SUPER_ADMIN_PROFILE;
    const index = merged.users.findIndex(u => u.id === SUPER_ADMIN_ID);
    if (index < 0) merged.users.unshift({ ...superProfile, ...SUPER_ADMIN_PROFILE });
    else merged.users[index] = { ...merged.users[index], ...SUPER_ADMIN_PROFILE };
    return merged;
  }
  const companyId = user.companyId;
  const merged = normalizeState(globalState);
  const incomingCompany = (incoming.companies || []).find(c => c.id === companyId);
  if (user.role === 'admin' && incomingCompany) {
    const index = merged.companies.findIndex(c => c.id === companyId);
    if (index >= 0) merged.companies[index] = safeCompanyUpdate(merged.companies[index], incomingCompany);
  }
  const operationalForCashier = new Set(['items', 'sales', 'orders', 'stockEntries', 'stockOutputs', 'stockMovements', 'caisseLogs']);
  for (const key of COMPANY_ARRAY_KEYS) {
    if (['users', 'passwordResetRequests', 'payments'].includes(key)) continue;
    if (user.role === 'caisse' && !operationalForCashier.has(key)) continue;
    if (Array.isArray(incoming[key])) merged[key] = replaceCompanyRows(merged[key], incoming[key], companyId);
  }
  if (user.role === 'admin') {
    for (const key of COMPANY_OBJECT_KEYS) {
      if (incoming[key] && typeof incoming[key] === 'object') {
        merged[key] = merged[key] && typeof merged[key] === 'object' ? merged[key] : {};
        merged[key][companyId] = incoming[key][companyId];
      }
    }
    const allowedClientIds = new Set((merged.marketClients || []).filter(c => c.companyId === companyId).map(c => c.id));
    merged.clientDeletedOrders = merged.clientDeletedOrders || {};
    for (const [clientId, rows] of Object.entries(incoming.clientDeletedOrders || {})) if (allowedClientIds.has(clientId)) merged.clientDeletedOrders[clientId] = rows;
  }
  return merged;
}


function patchJson(value) {
  const raw = JSON.stringify(value === undefined ? null : cleanClone(value));
  const size = new TextEncoder().encode(raw).byteLength;
  if (size > PATCH_RECORD_MAX_BYTES) {
    throw new HttpError(413, 'Un élément à enregistrer est trop volumineux. Réduisez la taille de l’image ou de la pièce jointe.', 'PATCH_RECORD_TOO_LARGE');
  }
  return raw;
}

function applyArrayPatch(state, key, recordId, deleted, value) {
  if (!Array.isArray(state[key])) state[key] = [];
  const index = state[key].findIndex(row => String(row?.id || '') === String(recordId));
  if (deleted) {
    if (index >= 0) state[key].splice(index, 1);
    return;
  }
  const incoming = value && typeof value === 'object' ? value : {};
  if (key === 'companies' && incoming.__partialCompanyPatch) {
    const partial = incoming.value && typeof incoming.value === 'object' ? incoming.value : {};
    if (index >= 0) state[key][index] = { ...state[key][index], ...partial, id: recordId };
    else state[key].push({ ...partial, id: recordId });
    return;
  }
  if (index >= 0) state[key][index] = incoming;
  else state[key].push(incoming);
}

function applyObjectPatch(state, key, recordId, deleted, value) {
  if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
  if (deleted) delete state[key][recordId];
  else state[key][recordId] = value;
}

async function applyStoredStatePatches(env, state, companyId = '*') {
  await ensureDB(env);
  const query = companyId === '*'
    ? env.GLOBAL_MARKET_D1.prepare('SELECT company_id, section, record_id, deleted, data FROM company_state_patches ORDER BY updated_at ASC')
    : env.GLOBAL_MARKET_D1.prepare('SELECT company_id, section, record_id, deleted, data FROM company_state_patches WHERE company_id IN (?, ?) ORDER BY updated_at ASC').bind(companyId, PATCH_GLOBAL_SCOPE);
  const result = await query.all();
  for (const row of result.results || []) {
    const deleted = Number(row.deleted || 0) === 1;
    let value = null;
    if (!deleted && row.data) {
      try { value = JSON.parse(row.data); } catch { continue; }
    }
    if (String(row.section).startsWith('array:')) {
      applyArrayPatch(state, String(row.section).slice(6), row.record_id, deleted, value);
    } else if (String(row.section).startsWith('object:')) {
      applyObjectPatch(state, String(row.section).slice(7), row.record_id, deleted, value);
    } else if (String(row.section).startsWith('value:')) {
      const key = String(row.section).slice(6);
      if (deleted) delete state[key]; else state[key] = value;
    }
  }
  return normalizeState(state);
}


async function applyDeletedCompanies(env, state, companyId = '*') {
  await ensureDB(env);
  const result = companyId === '*'
    ? await env.GLOBAL_MARKET_D1.prepare('SELECT company_id FROM deleted_companies').all()
    : await env.GLOBAL_MARKET_D1.prepare('SELECT company_id FROM deleted_companies WHERE company_id = ?').bind(companyId).all();
  for (const row of result.results || []) removeCompanyDataFromState(state, row.company_id);
  return state;
}

async function markCompanyDeleted(env, companyId) {
  const now = new Date().toISOString();
  await env.GLOBAL_MARKET_D1.batch([
    env.GLOBAL_MARKET_D1.prepare(`INSERT INTO deleted_companies(company_id, deleted_at) VALUES (?, ?)
      ON CONFLICT(company_id) DO UPDATE SET deleted_at=excluded.deleted_at`).bind(companyId, now),
    env.GLOBAL_MARKET_D1.prepare('DELETE FROM company_state_chunks WHERE company_id = ?').bind(companyId),
    env.GLOBAL_MARKET_D1.prepare('DELETE FROM company_state_meta WHERE company_id = ?').bind(companyId),
    env.GLOBAL_MARKET_D1.prepare('DELETE FROM company_state_patches WHERE company_id = ?').bind(companyId)
  ]);
}

async function writePatchStatements(env, statements) {
  if (!statements.length) return { patchCount: 0, storage: 'd1-delta' };
  const result = await enqueueD1Write(async () => {
    await runD1Batches(env.GLOBAL_MARKET_D1, statements, 4);
    return { patchCount: statements.length, storage: 'd1-delta' };
  });
  invalidatePublicStateCache();
  return result;
}


function allowedDeltaArrayKeys(role) {
  if (role === 'superadmin' || role === 'system') return new Set(['companies', 'users', ...COMPANY_ARRAY_KEYS]);
  if (role === 'caisse') return new Set(['items', 'sales', 'orders', 'stockEntries', 'stockOutputs', 'stockMovements', 'caisseLogs']);
  return new Set(['companies', 'items', 'sales', 'orders', 'clients', 'marketClients', 'marketMessages', 'stockEntries', 'stockOutputs', 'stockMovements', 'caisseLogs']);
}

async function persistStateDeltaLegacy(env, delta, actor) {
  await ensureDB(env);
  if (!delta || typeof delta !== 'object') throw new HttpError(400, 'Modification de sauvegarde invalide.', 'INVALID_DELTA');
  if (containsCredentialFields(delta)) throw new HttpError(400, 'Les mots de passe ne doivent jamais être enregistrés dans les données de l’application.', 'CREDENTIALS_IN_STATE');
  const role = actor?.role || 'caisse';
  const actorCompanyId = String(actor?.companyId || '');
  const isSuper = role === 'superadmin';
  const isAdmin = isSuper || role === 'admin' || role === 'system';
  const allowedArrays = allowedDeltaArrayKeys(role);
  const now = new Date().toISOString();
  const statements = [];
  const operations = [];
  const upsertPatch = (companyId, section, recordId, value) => {
    const raw = patchJson(value);
    operations.push({ companyId, section, recordId: String(recordId), deleted: false, value: cleanClone(value), updatedAt: now });
    statements.push(env.GLOBAL_MARKET_D1.prepare(`INSERT INTO company_state_patches(company_id, section, record_id, deleted, data, updated_at)
      VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(company_id, section, record_id) DO UPDATE SET deleted=0, data=excluded.data, updated_at=excluded.updated_at`
    ).bind(companyId, section, String(recordId), raw, now));
  };
  const deletePatch = (companyId, section, recordId) => {
    operations.push({ companyId, section, recordId: String(recordId), deleted: true, value: null, updatedAt: now });
    statements.push(env.GLOBAL_MARKET_D1.prepare(`INSERT INTO company_state_patches(company_id, section, record_id, deleted, data, updated_at)
      VALUES (?, ?, ?, 1, NULL, ?)
      ON CONFLICT(company_id, section, record_id) DO UPDATE SET deleted=1, data=NULL, updated_at=excluded.updated_at`
    ).bind(companyId, section, String(recordId), now));
  };

  for (const [key, changes] of Object.entries(delta.arrays || {})) {
    if (!allowedArrays.has(key)) continue;
    const section = `array:${key}`;
    for (const source of Array.isArray(changes?.upserts) ? changes.upserts : []) {
      if (!source || typeof source !== 'object' || !source.id) continue;
      let targetCompanyId = key === 'companies' ? String(source.id) : String(source.companyId || actorCompanyId);
      if (!isSuper) targetCompanyId = actorCompanyId;
      if (!targetCompanyId) continue;
      let value = cleanClone(source);
      if (key === 'companies') {
        if (!isAdmin || (!isSuper && String(source.id) !== actorCompanyId)) continue;
        if (!isSuper && role !== 'system') {
          const protectedFields = new Set(['id', 'status', 'plan', 'planCode', 'subscriptionStart', 'subscriptionEnd', 'createdAt']);
          const partial = {};
          for (const [field, fieldValue] of Object.entries(value)) if (!protectedFields.has(field)) partial[field] = fieldValue;
          value = { __partialCompanyPatch: true, value: partial };
        }
      } else {
        value.companyId = targetCompanyId;
      }
      upsertPatch(targetCompanyId, section, source.id, value);
    }
    for (const deletion of Array.isArray(changes?.deletes) ? changes.deletes : []) {
      const recordId = String(deletion?.id || '');
      if (!recordId || key === 'companies') continue;
      let targetCompanyId = isSuper ? String(deletion?.companyId || '') : actorCompanyId;
      if (!targetCompanyId) continue;
      deletePatch(targetCompanyId, section, recordId);
    }
  }

  if (isAdmin) {
    for (const [key, changes] of Object.entries(delta.objects || {})) {
      const section = `object:${key}`;
      for (const source of Array.isArray(changes?.upserts) ? changes.upserts : []) {
        const recordId = String(source?.recordId || '');
        if (!recordId) continue;
        let targetCompanyId = isSuper ? String(source?.companyId || recordId) : actorCompanyId;
        if (!targetCompanyId) continue;
        upsertPatch(targetCompanyId, section, recordId, source.value);
      }
      for (const deletion of Array.isArray(changes?.deletes) ? changes.deletes : []) {
        const recordId = String(deletion?.recordId || '');
        if (!recordId) continue;
        let targetCompanyId = isSuper ? String(deletion?.companyId || recordId) : actorCompanyId;
        if (!targetCompanyId) continue;
        deletePatch(targetCompanyId, section, recordId);
      }
    }
  }

  if (isSuper) {
    for (const [key, value] of Object.entries(delta.values || {})) upsertPatch(PATCH_GLOBAL_SCOPE, `value:${key}`, key, value);
  }
  try {
    return await writePatchStatements(env, statements);
  } catch (error) {
    if (!isTransientStorageError(error)) throw error;
    const queueKey = await queuePendingOperations(env, operations, { role, companyId: actorCompanyId || PATCH_GLOBAL_SCOPE });
    invalidatePublicStateCache();
    return { patchCount: operations.length, storage: 'kv-write-ahead-fallback', queued: true, queueKey };
  }
}


function buildStateDeltaForPersistence(before, after) {
  const delta = { arrays: {}, objects: {}, values: {} };
  const arrayKeys = new Set(['companies', 'users', ...COMPANY_ARRAY_KEYS]);
  for (const key of arrayKeys) {
    const oldRows = Array.isArray(before?.[key]) ? before[key] : [];
    const newRows = Array.isArray(after?.[key]) ? after[key] : [];
    const oldMap = new Map(oldRows.filter(row => row?.id).map(row => [String(row.id), row]));
    const newMap = new Map(newRows.filter(row => row?.id).map(row => [String(row.id), row]));
    const upserts = [], deletes = [];
    for (const [id, row] of newMap) {
      const old = oldMap.get(id);
      if (!old || JSON.stringify(old) !== JSON.stringify(row)) upserts.push(row);
    }
    for (const [id, row] of oldMap) {
      if (!newMap.has(id)) deletes.push({ id, companyId: String(row?.companyId || (key === 'companies' ? row.id : '')) });
    }
    if (upserts.length || deletes.length) delta.arrays[key] = { upserts, deletes };
  }
  const objectKeys = new Set([...COMPANY_OBJECT_KEYS, 'clientDeletedOrders']);
  for (const key of objectKeys) {
    const oldObj = before?.[key] && typeof before[key] === 'object' ? before[key] : {};
    const newObj = after?.[key] && typeof after[key] === 'object' ? after[key] : {};
    const upserts = [], deletes = [];
    for (const recordId of new Set([...Object.keys(oldObj), ...Object.keys(newObj)])) {
      let companyId = recordId;
      if (key === 'clientDeletedOrders') {
        const client = [...(after?.marketClients || []), ...(before?.marketClients || [])].find(row => String(row?.id || '') === String(recordId));
        companyId = String(client?.companyId || '');
      }
      if (!Object.prototype.hasOwnProperty.call(newObj, recordId)) {
        deletes.push({ recordId, companyId });
      } else if (!Object.prototype.hasOwnProperty.call(oldObj, recordId) || JSON.stringify(oldObj[recordId]) !== JSON.stringify(newObj[recordId])) {
        upserts.push({ recordId, companyId, value: newObj[recordId] });
      }
    }
    if (upserts.length || deletes.length) delta.objects[key] = { upserts, deletes };
  }
  return delta;
}

async function getEmployeeSessionLight(request, env) {
  const sid = getCookie(request, EMPLOYEE_SESSION_COOKIE);
  if (!sid) throw new HttpError(401, 'Connexion requise.', 'UNAUTHENTICATED');
  const session = await env.GLOBAL_MARKET_KV.get(`session:${sid}`, 'json');
  if (!session || Number(session.expiresAt || 0) <= Date.now()) {
    if (sid) await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);
    throw new HttpError(401, 'Session expirée. Reconnectez-vous.', 'SESSION_EXPIRED');
  }
  const auth = await getAuth(env, session.userId);
  if (!auth || Number(auth.version || 0) !== Number(session.authVersion || 0)) {
    await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);
    throw new HttpError(401, 'Session invalidée. Reconnectez-vous.', 'SESSION_INVALIDATED');
  }
  const user = { id: session.userId, companyId: session.companyId || null, role: session.role, status: 'active' };
  return { sid, session, user, auth };
}


async function deleteKvSessionsForCompany(env, companyId) {
  for (const prefix of ['session:', 'client-session:']) {
    let cursor;
    do {
      const page = await env.GLOBAL_MARKET_KV.list({ prefix, cursor });
      const matching = [];
      for (const key of page.keys || []) {
        const session = await env.GLOBAL_MARKET_KV.get(key.name, 'json');
        if (session?.companyId === companyId) matching.push(key.name);
      }
      await Promise.all(matching.map(key => env.GLOBAL_MARKET_KV.delete(key)));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
}

function removeCompanyDataFromState(state, companyId) {
  const clientIds = new Set((state.marketClients || []).filter(client => client?.companyId === companyId).map(client => client.id));
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) {
      if (key === 'companies') state[key] = value.filter(company => company?.id !== companyId);
      else if (key === 'users') state[key] = value.filter(user => user?.role === 'superadmin' || user?.companyId !== companyId);
      else state[key] = value.filter(row => row?.companyId !== companyId);
      continue;
    }
    if (!value || typeof value !== 'object' || key === 'app') continue;
    if (Object.prototype.hasOwnProperty.call(value, companyId)) delete value[companyId];
    if (key === 'clientDeletedOrders') {
      for (const clientId of clientIds) delete value[clientId];
    }
  }
  return state;
}

async function handleDeleteCompany(request, env) {
  const ctx = await getEmployeeSession(request, env, true);
  requireRole(ctx.user, ['superadmin']);
  const body = await readJson(request, 30_000);
  const companyId = String(body.companyId || '').trim();
  const company = ctx.state.companies.find(item => item?.id === companyId);
  if (!company) throw new HttpError(404, 'Entreprise introuvable.', 'COMPANY_NOT_FOUND');

  const expectedName = String(company.name || '').trim();
  const providedName = String(body.companyName || '').trim();
  if (!expectedName || providedName !== expectedName || String(body.confirmation || '').trim().toUpperCase() !== 'SUPPRIMER') {
    throw new HttpError(400, 'Confirmation de suppression incorrecte.', 'DELETE_CONFIRMATION_INVALID');
  }

  const companyUsers = (ctx.state.users || []).filter(user => user?.companyId === companyId && user.role !== 'superadmin');
  const companyClients = (ctx.state.marketClients || []).filter(client => client?.companyId === companyId);

  for (const user of companyUsers) {
    const auth = await getAuth(env, user.id);
    if (auth?.identifier) await env.GLOBAL_MARKET_KV.delete(authIndexKey(auth.identifier));
    await env.GLOBAL_MARKET_KV.delete(authKey(user.id));
  }
  for (const client of companyClients) {
    const auth = await getClientAuth(env, client.id);
    const phone = auth?.phone || normalizePhone(client.phone);
    if (phone) await env.GLOBAL_MARKET_KV.delete(clientIndexKey(companyId, phone));
    await env.GLOBAL_MARKET_KV.delete(clientAuthKey(client.id));
  }

  removeCompanyDataFromState(ctx.state, companyId);
  if(await v6IsReady(env)) await v6DeleteCompanyCascade(env,companyId); else await markCompanyDeleted(env, companyId);
  const saved = { state: ctx.state };
  await deleteKvSessionsForCompany(env, companyId);
  await audit(
    env,
    'COMPANY_DELETED',
    ctx.user.id,
    companyId,
    `Compte entreprise supprimé : ${expectedName}. Utilisateurs : ${companyUsers.length}. Clients boutique : ${companyClients.length}.`,
    requestIp(request)
  );

  return json({
    success: true,
    message: `Le compte entreprise « ${expectedName} » a été supprimé.`,
    deleted: { companyId, companyName: expectedName, users: companyUsers.length, marketClients: companyClients.length },
    data: scopeState(saved.state, ctx.user)
  });
}


const DEFAULT_MARKET_DELIVERY_CITIES = [
  { name: 'DIABO' }, { name: 'BOUAKE' }, { name: 'YAMOUSSOUKRO' }, { name: 'ABIDJAN' },
  { name: 'ABENGOUROU' }, { name: 'MAN' }, { name: 'MANKONO' }, { name: 'KOROGHO' }, { name: 'KATIOLA' }
];
const DEFAULT_MARKET_LOCAL_NEIGHBORHOODS = [
  { id: 'retrait-boutique', name: 'RETRAIT A LA BOUTIQUE', pickup: true },
  { id: 'quartier-1', name: 'QUARTIER 1' }, { id: 'quartier-2', name: 'QUARTIER 2' }, { id: 'quartier-3', name: 'QUARTIER 3' },
  { id: 'quartier-4', name: 'QUARTIER 4' }, { id: 'quartier-5', name: 'QUARTIER 5' }, { id: 'quartier-6', name: 'QUARTIER 6' },
  { id: 'quartier-7', name: 'QUARTIER 7' }, { id: 'quartier-8', name: 'QUARTIER 8' }, { id: 'quartier-9', name: 'QUARTIER 9' }
];
const DEFAULT_MARKET_SHIPPING_METHODS = [
  { id: 'retrait-boutique', name: 'RETRAIT A LA BOUTIQUE', fee: 0 },
  { id: 'jumia-ci', name: 'JUMIA CI', fee: 0 }, { id: 'utb-transport', name: 'UTB TRANSPORT', fee: 0 },
  { id: 'avs-transport', name: 'AVS TRANSPORT', fee: 0 }, { id: 'autres', name: 'AUTRES', fee: 0 }
];
function marketDeliveryToken(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
}
function marketShippingMethodId(value) {
  return marketDeliveryToken(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'mode-expedition';
}
function inferCompanyHomeCity(company) {
  const source = marketDeliveryToken(company?.marketDeliveryConfig?.homeCity || company?.city || company?.address || '');
  const known = DEFAULT_MARKET_DELIVERY_CITIES.find(row => source.includes(marketDeliveryToken(row.name)));
  if (known) return known.name;
  const raw = String(company?.city || company?.address || '').split(',')[0].trim();
  if (raw && raw.length <= 50 && !/\d/.test(raw)) return marketDeliveryToken(raw);
  return 'DIABO';
}
function isPickupShippingMethod(method) {
  const token = marketDeliveryToken(method?.name);
  return token.includes('RETRAIT') && token.includes('BOUTIQUE');
}
function isPickupNeighborhood(neighborhood) {
  return isPickupShippingMethod(neighborhood) || String(neighborhood?.id || '') === 'retrait-boutique';
}
function normalizeMarketDeliveryConfig(company) {
  const raw = company?.marketDeliveryConfig && typeof company.marketDeliveryConfig === 'object' ? company.marketDeliveryConfig : {};
  const homeCity = marketDeliveryToken(raw.homeCity || inferCompanyHomeCity(company));
  let cities = (Array.isArray(raw.cities) ? raw.cities : DEFAULT_MARKET_DELIVERY_CITIES).slice(0, 10)
    .map(row => ({ name: marketDeliveryToken(row?.name) }))
    .filter(row => row.name);
  const citySeen = new Set();
  cities = cities.filter(row => { const key = marketDeliveryToken(row.name); if (citySeen.has(key)) return false; citySeen.add(key); return true; });
  if (homeCity && !citySeen.has(homeCity)) cities = [{ name: homeCity }, ...cities].slice(0, 10);

  const pickupNeighborhood = { id: 'retrait-boutique', name: 'RETRAIT A LA BOUTIQUE', pickup: true };
  const rawNeighborhoods = Array.isArray(raw.neighborhoods) && raw.neighborhoods.length ? raw.neighborhoods : DEFAULT_MARKET_LOCAL_NEIGHBORHOODS;
  const neighborhoods = [pickupNeighborhood];
  const neighborhoodSeen = new Set([marketDeliveryToken(pickupNeighborhood.name)]);
  for (const row of rawNeighborhoods) {
    const name = marketDeliveryToken(row?.name);
    if (!name || isPickupNeighborhood(row) || neighborhoodSeen.has(name)) continue;
    neighborhoodSeen.add(name);
    neighborhoods.push({ id: String(row?.id || marketShippingMethodId(name)), name });
    if (neighborhoods.length >= 10) break;
  }
  for (const row of DEFAULT_MARKET_LOCAL_NEIGHBORHOODS) {
    if (neighborhoods.length >= 10) break;
    const name = marketDeliveryToken(row.name);
    if (isPickupNeighborhood(row) || neighborhoodSeen.has(name)) continue;
    neighborhoodSeen.add(name); neighborhoods.push({ id: row.id, name });
  }

  const rawMethods = (Array.isArray(raw.methods) && raw.methods.length ? raw.methods : DEFAULT_MARKET_SHIPPING_METHODS)
    .map(row => ({ id: String(row?.id || marketShippingMethodId(row?.name)).trim(), name: marketDeliveryToken(row?.name), fee: Math.max(0, Math.round(Number(row?.fee || 0))) }))
    .filter(row => row.name);
  const pickup = { id: 'retrait-boutique', name: 'RETRAIT A LA BOUTIQUE', fee: 0 };
  const methods = [pickup];
  const methodSeen = new Set([pickup.id]);
  for (const row of rawMethods) {
    if (isPickupShippingMethod(row) || String(row.id) === 'retrait-boutique') continue;
    const id = String(row.id || marketShippingMethodId(row.name));
    if (methodSeen.has(id)) continue;
    methodSeen.add(id); methods.push({ id, name: row.name, fee: row.fee });
    if (methods.length >= 10) break;
  }
  return { homeCity, cities, neighborhoods, methods };
}
function marketDeliveryRateForSubtotal(subtotal) {
  subtotal = Number(subtotal || 0);
  return subtotal <= 0 ? 0 : subtotal <= 4999 ? 0.10 : subtotal <= 24999 ? 0.05 : subtotal <= 99999 ? 0.02 : 0.015;
}
function calculateMarketDelivery(company, subtotal, requestedCity, requestedMethodRef, requestedNeighborhood) {
  const config = normalizeMarketDeliveryConfig(company);
  const cityToken = marketDeliveryToken(requestedCity);
  const city = config.cities.find(row => marketDeliveryToken(row.name) === cityToken);
  if (!city) throw new HttpError(400, `La boutique ${company?.name || ''} ne livre pas actuellement à ${requestedCity}.`, 'DELIVERY_CITY_UNAVAILABLE');
  const local = cityToken === marketDeliveryToken(config.homeCity);

  if (local) {
    let neighborhood = config.neighborhoods.find(row => String(row.id) === String(requestedNeighborhood || ''));
    if (!neighborhood) neighborhood = config.neighborhoods.find(row => marketDeliveryToken(row.name) === marketDeliveryToken(requestedNeighborhood));
    if (!neighborhood) throw new HttpError(400, 'Choisissez un quartier de livraison pour la ville de la boutique.', 'DELIVERY_NEIGHBORHOOD_REQUIRED');
    const pickup = isPickupNeighborhood(neighborhood);
    const rate = pickup ? 0 : marketDeliveryRateForSubtotal(subtotal);
    const cityFee = pickup ? 0 : Math.round(Number(subtotal || 0) * rate);
    return {
      city: city.name, homeCity: config.homeCity,
      neighborhoodId: neighborhood.id, neighborhoodName: neighborhood.name,
      methodId: pickup ? 'retrait-boutique' : 'livraison-locale',
      methodName: pickup ? 'RETRAIT A LA BOUTIQUE' : 'LIVRAISON LOCALE',
      cityFee, methodFee: 0, deliveryFeeRate: rate, deliveryFee: cityFee,
      local: true, pickup
    };
  }

  const availableMethods = config.methods.filter(row => !isPickupShippingMethod(row));
  let method = availableMethods.find(row => String(row.id) === String(requestedMethodRef || ''));
  if (!method) method = availableMethods.find(row => marketDeliveryToken(row.name) === marketDeliveryToken(requestedMethodRef));
  if (!method) method = availableMethods[0];
  if (!method) throw new HttpError(400, `Aucun moyen d’expédition n’est configuré pour ${company?.name || 'cette boutique'}.`, 'SHIPPING_METHOD_UNAVAILABLE');
  const methodFee = Math.max(0, Math.round(Number(method.fee || 0)));
  return {
    city: city.name, homeCity: config.homeCity,
    neighborhoodId: '', neighborhoodName: '',
    methodId: method.id, methodName: method.name,
    cityFee: 0, methodFee, deliveryFeeRate: 0, deliveryFee: methodFee,
    local: false, pickup: false
  };
}

function publicCompany(company) {
  if (!company) return null;
  const allowed = ['id', 'name', 'activity', 'phone', 'email', 'address', 'businessType', 'shopSlug', 'shopBanner', 'shopColor', 'marketWaveBusinessLink', 'marketUsdtTrc20', 'marketDeliveryConfig', 'status', 'plan', 'planCode', 'subscriptionEnd'];
  return Object.fromEntries(allowed.map(k => [k, company[k]]));
}

function publicItem(item) {
  const allowed = ['id', 'companyId', 'code', 'name', 'cat', 'detail', 'marketplaceDesc', 'marketplacePromo', 'sell', 'type', 'stockType', 'stock', 'photo', 'marketplaceHidden'];
  return Object.fromEntries(allowed.map(k => [k, item[k]]));
}

async function loadPublicStateCached(env) {
  const now = Date.now();
  if (publicStateCache && now - publicStateCacheAt < 3500) return cleanClone(publicStateCache);
  if (!publicStateLoadPromise) {
    publicStateLoadPromise = loadState(env, '*').then(state => {
      publicStateCache = cleanClone(state);
      publicStateCacheAt = Date.now();
      return publicStateCache;
    }).finally(() => { publicStateLoadPromise = null; });
  }
  return cleanClone(await publicStateLoadPromise);
}

function invalidatePublicStateCache() {
  publicStateCache = null;
  publicStateCacheAt = 0;
}

async function cachePublicPayload(env, payload, clientId = '') {
  const base = { companies: payload.companies || [], items: payload.items || [], marketClients: [], orders: [], marketMessages: [], clientDeletedOrders: {}, app: payload.app || {}, clientSession: null };
  const now = Date.now();
  if (now - publicPayloadCacheWriteAt > 120000) {
    const raw = JSON.stringify(base);
    if (new TextEncoder().encode(raw).byteLength <= FALLBACK_CACHE_MAX_BYTES) {
      publicPayloadCacheWriteAt = now;
      try { await env.GLOBAL_MARKET_KV.put(PUBLIC_PAYLOAD_CACHE_KEY, raw, { expirationTtl: FALLBACK_CACHE_TTL }); } catch {}
    }
  }
  if (clientId) {
    const last = Number(clientPayloadCacheWriteAt.get(clientId) || 0);
    if (now - last > 90000) {
      const raw = JSON.stringify(payload);
      if (new TextEncoder().encode(raw).byteLength <= FALLBACK_CACHE_MAX_BYTES) {
        clientPayloadCacheWriteAt.set(clientId, now);
        try { await env.GLOBAL_MARKET_KV.put(`${CLIENT_PAYLOAD_CACHE_PREFIX}${clientId}`, raw, { expirationTtl: FALLBACK_CACHE_TTL }); } catch {}
      }
    }
  }
}

async function publicLoadPayload(request, env) {
  let state = null;
  let loadError = null;
  try { state = await loadPublicStateCached(env); }
  catch (error) { loadError = error; if (!isTransientStorageError(error)) throw error; }

  if (!state) {
    const sid = getCookie(request, CLIENT_SESSION_COOKIE);
    const session = sid ? await env.GLOBAL_MARKET_KV.get(`client-session:${sid}`, 'json') : null;
    if (session?.clientId && Number(session.expiresAt || 0) > Date.now()) {
      const clientCached = await env.GLOBAL_MARKET_KV.get(`${CLIENT_PAYLOAD_CACHE_PREFIX}${session.clientId}`, 'json');
      if (clientCached) return clientCached;
    }
    const publicCached = await env.GLOBAL_MARKET_KV.get(PUBLIC_PAYLOAD_CACHE_KEY, 'json');
    if (publicCached) return publicCached;
    throw loadError || new HttpError(503, 'Catalogue momentanément indisponible.', 'STORAGE_BUSY', { 'Retry-After': '2' });
  }

  const payload = {
    companies: state.companies.map(publicCompany),
    items: state.items.map(publicItem),
    marketClients: [],
    orders: [],
    marketMessages: [],
    clientDeletedOrders: {},
    app: state.app || {}
  };
  let clientId = '';
  try {
    const clientAuth = await getClientSession(request, env, false, state);
    clientId = clientAuth.client.id;
    payload.marketClients = [cleanClone(clientAuth.client)];
    payload.orders = state.orders.filter(o => o.clientId === clientAuth.client.id).map(cleanClone);
    payload.marketMessages = (state.marketMessages || []).filter(m => m.clientId === clientAuth.client.id && !m.clientDeleted).map(cleanClone);
    payload.clientDeletedOrders[clientAuth.client.id] = (state.clientDeletedOrders || {})[clientAuth.client.id] || [];
    payload.clientSession = publicClientSessionView(clientAuth.session);
  } catch {
    payload.clientSession = null;
  }
  await cachePublicPayload(env, payload, clientId);
  return payload;
}

function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '@#$%!?';
  const pick = chars => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const all = upper + lower + digits + specials;
  let value = pick(upper) + pick(lower) + pick(digits) + pick(specials);
  while (value.length < 14) value += pick(all);
  return value.split('').sort(() => (crypto.getRandomValues(new Uint32Array(1))[0] % 3) - 1).join('');
}

async function handleLogin(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 20_000);
  const identifier = normalizeIdentifier(body.identifier || body.email);
  const password = String(body.password || '');
  const requestedRole = String(body.role || '');
  if (!identifier || !password) throw new HttpError(400, 'Identifiant et mot de passe obligatoires.', 'MISSING_CREDENTIALS');
  const ip = requestIp(request);
  const rate = await assertLoginRateAllowed(env, ip, identifier);
  const state = await loadState(env);
  const superIdentifier = configuredSuperAdminIdentifier(env);
  if (superIdentifier && identifier === superIdentifier) await ensureSuperAdminCredential(env, state);
  const indexedId = await env.GLOBAL_MARKET_KV.get(authIndexKey(identifier));
  const user = state.users.find(u => u.id === indexedId) || state.users.find(u => normalizeIdentifier(u.email || u.username) === identifier);
  const auth = user ? await getAuth(env, user.id) : null;
  const valid = user && user.status === 'active' && await verifyCredential(auth, password);
  if (!valid) {
    await recordLoginFailure(env, rate);
    await audit(env, 'LOGIN_FAILED', user?.id || '', user?.companyId || null, 'Échec de connexion', ip);
    await new Promise(resolve => setTimeout(resolve, 250));
    throw new HttpError(401, 'Identifiant ou mot de passe incorrect.', 'INVALID_CREDENTIALS');
  }
  if (requestedRole === 'caisse' && user.role !== 'caisse') throw new HttpError(403, 'Profil incorrect : sélectionnez Administrateur.', 'ROLE_MISMATCH');
  if (requestedRole === 'admin' && !['admin', 'superadmin'].includes(user.role)) throw new HttpError(403, 'Profil incorrect : sélectionnez La Caisse.', 'ROLE_MISMATCH');
  if (user.role === 'caisse' && !isCashierInAllowedHours(user)) throw new HttpError(403, 'Accès caisse refusé hors de la plage horaire autorisée.', 'OUTSIDE_ALLOWED_HOURS');
  if (user.companyId) {
    const company = state.companies.find(c => c.id === user.companyId);
    const status = companyStatus(company);
    if (['expired', 'blocked', 'suspended'].includes(status)) throw new HttpError(403, `Accès entreprise ${status}.`, 'COMPANY_ACCESS_BLOCKED');
  }
  await clearLoginRate(env, rate);
  const created = await createEmployeeSession(env, user, auth);
  await audit(env, 'LOGIN_SUCCESS', user.id, user.companyId, 'Connexion réussie', ip);
  return json({
    success: true,
    session: publicSessionView(created.session),
    mustChangePassword: Boolean(auth.mustChangePassword),
    data: scopeState(state, user)
  }, {
    headers: { 'Set-Cookie': setCookie(EMPLOYEE_SESSION_COOKIE, created.sid, created.ttl) }
  });
}

async function handleRegisterCompany(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 100_000);
  const ip = requestIp(request);
  const rateKey = `rate:register:${await rateKeyHash(ip)}`;
  const rec = await getRateRecord(env, rateKey);
  if (rec.resetAt > Date.now() && rec.count >= 5) throw new HttpError(429, 'Trop de créations de compte. Réessayez plus tard.', 'RATE_LIMITED');
  const name = String(body.name || '').trim();
  const email = normalizeIdentifier(body.email);
  const password = validatePassword(body.password, 'admin');
  if (!name || !email) throw new HttpError(400, 'Raison sociale et e-mail obligatoires.', 'MISSING_FIELDS');
  const state = await loadState(env);
  if (await env.GLOBAL_MARKET_KV.get(authIndexKey(email)) || state.users.some(u => normalizeIdentifier(u.email) === email)) {
    throw new HttpError(409, 'Cet e-mail est déjà utilisé.', 'EMAIL_EXISTS');
  }
  const cid = `ent_${crypto.randomUUID()}`;
  const uid = `usr_${crypto.randomUUID()}`;
  const now = new Date();
  const end = new Date(now.getTime() + 21 * 86400000).toISOString().slice(0, 10);
  const slug = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || cid;
  const company = {
    id: cid, name, legalForm: String(body.legalForm || ''), rccm: String(body.rccm || ''),
    taxAccount: String(body.taxAccount || ''), activity: String(body.activity || ''),
    owner: String(body.owner || ''), address: String(body.address || ''), phone: String(body.phone || ''),
    email, businessType: String(body.businessType || 'boutique'), status: 'FREE', planCode: 'FREE',
    plan: 'Plan Free — 21 jours', subscriptionStart: now.toISOString().slice(0, 10), subscriptionEnd: end,
    createdAt: now.toISOString(), notes: '', shopSlug: slug, shopBanner: 'Boutique officielle', shopColor: '#024644'
  };
  const user = { id: uid, companyId: cid, name: company.owner || 'Administrateur principal', email, role: 'admin', status: 'active', createdAt: now.toISOString(), mainAdmin: true };
  state.companies.push(company);
  state.users.push(user);
  await writeUserCredential(env, user, password);
  await persistStateDelta(env, { arrays: {
    companies: { upserts: [company], deletes: [] },
    users: { upserts: [user], deletes: [] }
  } }, { role: 'system', companyId: cid });
  const auth = await getAuth(env, user.id);
  const created = await createEmployeeSession(env, user, auth);
  await env.GLOBAL_MARKET_KV.put(rateKey, JSON.stringify({ count: (rec.count || 0) + 1, resetAt: Date.now() + 3600000 }), { expirationTtl: 3600 });
  await audit(env, 'COMPANY_REGISTERED', user.id, company.id, company.name, ip);
  return json({
    success: true,
    session: publicSessionView(created.session),
    data: scopeState(state, user)
  }, {
    status: 201,
    headers: { 'Set-Cookie': setCookie(EMPLOYEE_SESSION_COOKIE, created.sid, created.ttl) }
  });
}

async function handlePasswordChange(request, env) {
  const ctx = await getEmployeeSession(request, env, true);
  const body = await readJson(request, 30_000);
  const newPassword = validatePassword(body.newPassword, ctx.user.role);
  if (body.currentPassword && !(await verifyCredential(ctx.auth, String(body.currentPassword)))) {
    throw new HttpError(401, 'Mot de passe actuel incorrect.', 'CURRENT_PASSWORD_INVALID');
  }
  await writeUserCredential(env, ctx.user, newPassword, { mustChangePassword: false });
  ctx.user.mustChangePassword = false;
  await persistStateDelta(env, { arrays: { users: { upserts: [ctx.user], deletes: [] } } }, { role: 'system', companyId: ctx.user.companyId || PATCH_GLOBAL_SCOPE });
  await env.GLOBAL_MARKET_KV.delete(`session:${ctx.sid}`);
  await audit(env, 'PASSWORD_CHANGED', ctx.user.id, ctx.user.companyId, 'Toutes les sessions ont été invalidées', requestIp(request));
  return json({ success: true, reloginRequired: true }, {
    headers: { 'Set-Cookie': setCookie(EMPLOYEE_SESSION_COOKIE, '', 0) }
  });
}

async function handlePasswordResetRequest(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 30_000);
  const identifier = normalizeIdentifier(body.identifier || body.email);
  const role = String(body.role || 'caisse');
  const ip = requestIp(request);
  const key = `rate:reset-request:${await rateKeyHash(`${ip}:${identifier}`)}`;
  const rec = await getRateRecord(env, key);
  if (rec.resetAt > Date.now() && rec.count >= 3) throw new HttpError(429, 'Trop de demandes. Réessayez plus tard.', 'RATE_LIMITED');
  const state = await loadState(env);
  const user = state.users.find(u => normalizeIdentifier(u.email || u.username) === identifier);
  if (user && user.role !== 'superadmin' && user.role === role) {
    state.passwordResetRequests = state.passwordResetRequests || [];
    if (!state.passwordResetRequests.some(r => r.userId === user.id && r.status === 'pending')) {
      state.passwordResetRequests.push({
        id: `rst_${crypto.randomUUID()}`, companyId: user.companyId, userId: user.id, userName: user.name || '',
        email: user.email, role: user.role, phone: String(body.phone || ''), reason: String(body.reason || 'Mot de passe oublié'),
        status: 'pending', createdAt: new Date().toISOString()
      });
      const latestRequest = state.passwordResetRequests[state.passwordResetRequests.length - 1];
      await persistStateDelta(env, { arrays: { passwordResetRequests: { upserts: [latestRequest], deletes: [] } } }, { role: 'system', companyId: user.companyId });
    }
  }
  await env.GLOBAL_MARKET_KV.put(key, JSON.stringify({ count: (rec.count || 0) + 1, resetAt: Date.now() + 3600000 }), { expirationTtl: 3600 });
  return json({ success: true, message: 'Si le compte existe, la demande a été transmise.' });
}

async function handleCreateUser(request, env) {
  const ctx = await getEmployeeSession(request, env, true);
  requireRole(ctx.user, ['admin', 'superadmin']);
  const body = await readJson(request, 50_000);
  const companyId = ctx.user.role === 'superadmin' ? String(body.companyId || '') : ctx.user.companyId;
  const company = ctx.state.companies.find(c => c.id === companyId);
  if (!company) throw new HttpError(404, 'Entreprise introuvable.', 'COMPANY_NOT_FOUND');
  const role = body.role === 'admin' ? 'admin' : 'caisse';
  const email = normalizeIdentifier(body.email);
  const password = validatePassword(body.password, role);
  if (!email) throw new HttpError(400, 'E-mail obligatoire.', 'MISSING_EMAIL');
  if (await env.GLOBAL_MARKET_KV.get(authIndexKey(email)) || ctx.state.users.some(u => normalizeIdentifier(u.email) === email)) throw new HttpError(409, 'Cet e-mail est déjà utilisé.', 'EMAIL_EXISTS');
  const user = {
    id: `usr_${crypto.randomUUID()}`, companyId, name: String(body.name || ''), email, role, status: 'active',
    sessionMinutes: 0, caisseStartTime: role === 'caisse' ? String(body.caisseStartTime || '07:00') : '',
    caisseEndTime: role === 'caisse' ? String(body.caisseEndTime || '22:00') : '', createdAt: new Date().toISOString()
  };
  ctx.state.users.push(user);
  await writeUserCredential(env, user, password, { mustChangePassword: Boolean(body.mustChangePassword) });
  await persistStateDelta(env, { arrays: { users: { upserts: [user], deletes: [] } } }, { role: 'system', companyId });
  await audit(env, 'USER_CREATED', ctx.user.id, companyId, user.id, requestIp(request));
  return json({ success: true, user: cleanClone(user) }, { status: 201 });
}

async function handleUpdateUser(request, env) {
  const ctx = await getEmployeeSession(request, env, true);
  requireRole(ctx.user, ['admin', 'superadmin']);
  const body = await readJson(request, 50_000);
  const target = ctx.state.users.find(u => u.id === body.userId);
  if (!target || target.role === 'superadmin') throw new HttpError(404, 'Utilisateur introuvable.', 'USER_NOT_FOUND');
  if (ctx.user.role !== 'superadmin' && target.companyId !== ctx.user.companyId) throw new HttpError(403, 'Utilisateur hors de votre entreprise.', 'FORBIDDEN');
  const oldEmail = normalizeIdentifier(target.email);
  const previousRole = target.role;
  const previousStatus = target.status;
  const newEmail = normalizeIdentifier(body.email || target.email);
  if (newEmail !== oldEmail && (await env.GLOBAL_MARKET_KV.get(authIndexKey(newEmail)) || ctx.state.users.some(u => u.id !== target.id && normalizeIdentifier(u.email) === newEmail))) {
    throw new HttpError(409, 'Cet e-mail est déjà utilisé.', 'EMAIL_EXISTS');
  }
  if (body.name !== undefined) target.name = String(body.name);
  target.email = newEmail;
  if (body.role !== undefined) target.role = body.role === 'admin' ? 'admin' : 'caisse';
  if (body.status !== undefined) target.status = body.status === 'blocked' ? 'blocked' : 'active';
  target.caisseStartTime = target.role === 'caisse' ? String(body.caisseStartTime || target.caisseStartTime || '07:00') : '';
  target.caisseEndTime = target.role === 'caisse' ? String(body.caisseEndTime || target.caisseEndTime || '22:00') : '';
  const auth = await getAuth(env, target.id);
  if (body.password) await writeUserCredential(env, target, body.password, { mustChangePassword: Boolean(body.mustChangePassword) });
  else if (auth && auth.identifier !== newEmail) {
    await env.GLOBAL_MARKET_KV.delete(authIndexKey(auth.identifier));
    auth.identifier = newEmail;
    auth.version = Number(auth.version || 1) + 1;
    auth.updatedAt = new Date().toISOString();
    await env.GLOBAL_MARKET_KV.put(authKey(target.id), JSON.stringify(auth));
    await env.GLOBAL_MARKET_KV.put(authIndexKey(newEmail), target.id);
  }
  if (body.mustChangePassword !== undefined && !body.password && auth) {
    auth.mustChangePassword = Boolean(body.mustChangePassword);
    auth.version = Number(auth.version || 1) + 1;
    await env.GLOBAL_MARKET_KV.put(authKey(target.id), JSON.stringify(auth));
  }
  target.mustChangePassword = body.password ? Boolean(body.mustChangePassword) : Boolean(body.mustChangePassword ?? target.mustChangePassword);
  if (target.role !== previousRole || target.status !== previousStatus) {
    const latestAuth = await getAuth(env, target.id);
    if (latestAuth) {
      latestAuth.version = Number(latestAuth.version || 1) + 1;
      latestAuth.updatedAt = new Date().toISOString();
      await env.GLOBAL_MARKET_KV.put(authKey(target.id), JSON.stringify(latestAuth));
    }
  }
  await persistStateDelta(env, { arrays: { users: { upserts: [target], deletes: [] } } }, { role: 'system', companyId: target.companyId });
  await audit(env, 'USER_UPDATED', ctx.user.id, target.companyId, target.id, requestIp(request));
  return json({ success: true, user: cleanClone(target) });
}

async function handleDeleteUser(request, env) {
  const ctx = await getEmployeeSession(request, env, true);
  requireRole(ctx.user, ['admin', 'superadmin']);
  const body = await readJson(request, 20_000);
  const target = ctx.state.users.find(u => u.id === body.userId);
  if (!target || target.role === 'superadmin' || target.id === ctx.user.id) throw new HttpError(400, 'Suppression de cet utilisateur refusée.', 'DELETE_REFUSED');
  if (ctx.user.role !== 'superadmin' && target.companyId !== ctx.user.companyId) throw new HttpError(403, 'Utilisateur hors de votre entreprise.', 'FORBIDDEN');
  const remaining = ctx.state.users.filter(u => u.companyId === target.companyId && u.id !== target.id);
  if (!remaining.length) throw new HttpError(400, 'Impossible de supprimer le dernier utilisateur.', 'LAST_USER');
  const auth = await getAuth(env, target.id);
  if (auth?.identifier) await env.GLOBAL_MARKET_KV.delete(authIndexKey(auth.identifier));
  await env.GLOBAL_MARKET_KV.delete(authKey(target.id));
  ctx.state.users = ctx.state.users.filter(u => u.id !== target.id);
  await persistStateDelta(env, { arrays: { users: { upserts: [], deletes: [{ id: target.id, companyId: target.companyId }] } } }, { role: 'system', companyId: target.companyId });
  await audit(env, 'USER_DELETED', ctx.user.id, target.companyId, target.id, requestIp(request));
  return json({ success: true });
}

async function handleResetUserPassword(request, env) {
  const ctx = await getEmployeeSession(request, env, true);
  requireRole(ctx.user, ['admin', 'superadmin']);
  const body = await readJson(request, 30_000);
  const target = ctx.state.users.find(u => u.id === body.userId);
  if (!target || target.role === 'superadmin') throw new HttpError(404, 'Utilisateur introuvable.', 'USER_NOT_FOUND');
  if (ctx.user.role === 'admin' && (target.companyId !== ctx.user.companyId || target.role !== 'caisse')) {
    throw new HttpError(403, 'Un administrateur d’entreprise peut réinitialiser uniquement un compte Caisse de son entreprise.', 'FORBIDDEN');
  }
  if (ctx.user.role === 'superadmin' && target.role !== 'admin') throw new HttpError(403, 'Le Super Admin réinitialise ici uniquement les comptes Administrateur.', 'FORBIDDEN');
  const tempPassword = generateTempPassword();
  await writeUserCredential(env, target, tempPassword, { mustChangePassword: true });
  target.status = 'active';
  target.mustChangePassword = true;
  if (body.requestId) {
    const reset = (ctx.state.passwordResetRequests || []).find(r => r.id === body.requestId && r.userId === target.id);
    if (reset) {
      reset.status = 'done'; reset.doneAt = new Date().toISOString(); reset.doneBy = ctx.user.id;
    }
  }
  const resetChanges = body.requestId ? (ctx.state.passwordResetRequests || []).filter(r => r.id === body.requestId) : [];
  await persistStateDelta(env, { arrays: {
    users: { upserts: [target], deletes: [] },
    passwordResetRequests: { upserts: resetChanges, deletes: [] }
  } }, { role: 'system', companyId: target.companyId });
  await audit(env, 'PASSWORD_RESET', ctx.user.id, target.companyId, target.id, requestIp(request));
  return json({ success: true, temporaryPassword: tempPassword });
}

async function handlePublicClientRegister(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 50_000);
  const state = await loadState(env, '*');
  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone);
  const email = normalizeIdentifier(body.email);
  const password = validatePassword(body.password, 'client');
  if (!name || !phone) throw new HttpError(400, 'Nom et téléphone obligatoires.', 'MISSING_FIELDS');
  if (await env.GLOBAL_MARKET_KV.get(globalClientIndexKey(phone))) throw new HttpError(409, 'Ce téléphone possède déjà un compte client GLOBAL MARKET.', 'PHONE_EXISTS');
  if ((state.marketClients || []).some(c => normalizePhone(c?.phone) === phone)) {
    throw new HttpError(409, 'Ce téléphone est déjà inscrit. Utilisez la connexion pour récupérer votre compte client GLOBAL MARKET.', 'PHONE_EXISTS');
  }
  const client = {
    id: `clt_${crypto.randomUUID()}`,
    companyId: GLOBAL_CLIENT_SCOPE,
    scope: 'global',
    name, phone, email,
    createdAt: new Date().toISOString()
  };
  state.marketClients.push(client);
  await writeClientCredential(env, client, password);
  await persistStateDelta(env, { arrays: { marketClients: { upserts: [client], deletes: [] } } }, { role: 'system', companyId: GLOBAL_CLIENT_SCOPE });
  const created = await createClientSession(env, client, await getClientAuth(env, client.id));
  return json({ success: true, client: cleanClone(client), session: publicClientSessionView(created.session) }, {
    status: 201,
    headers: { 'Set-Cookie': setCookie(CLIENT_SESSION_COOKIE, created.sid, CLIENT_SESSION_TTL) }
  });
}

async function handlePublicClientLogin(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 30_000);
  const phone = normalizePhone(body.phone);
  const password = String(body.password || '');
  const ip = requestIp(request);
  const rate = await assertLoginRateAllowed(env, ip, `client:global:${phone}`);
  const state = await loadState(env, '*');
  let clientId = await env.GLOBAL_MARKET_KV.get(globalClientIndexKey(phone));
  let client = state.marketClients.find(c => c.id === clientId);
  let auth = client ? await getClientAuth(env, client.id) : null;

  // Compatibilité : un ancien compte client créé dans une boutique peut être converti
  // automatiquement en compte GLOBAL MARKET lors de sa première connexion réussie.
  if (!client) {
    const legacyCandidates = (state.marketClients || []).filter(c => normalizePhone(c?.phone) === phone);
    for (const candidate of legacyCandidates) {
      const candidateAuth = await getClientAuth(env, candidate.id);
      if (candidateAuth && await verifyCredential(candidateAuth, password)) {
        const oldCompanyId = candidate.companyId;
        candidate.companyId = GLOBAL_CLIENT_SCOPE;
        candidate.scope = 'global';
        client = candidate;
        auth = candidateAuth;
        if (oldCompanyId && oldCompanyId !== GLOBAL_CLIENT_SCOPE) await env.GLOBAL_MARKET_KV.delete(clientIndexKey(oldCompanyId, phone));
        await env.GLOBAL_MARKET_KV.put(globalClientIndexKey(phone), candidate.id);
        candidateAuth.companyId = GLOBAL_CLIENT_SCOPE;
        await env.GLOBAL_MARKET_KV.put(clientAuthKey(candidate.id), JSON.stringify(candidateAuth));
        await persistStateDelta(env, { arrays: { marketClients: { upserts: [candidate], deletes: [] } } }, { role: 'system', companyId: GLOBAL_CLIENT_SCOPE });
        break;
      }
    }
  }
  if (!client || !(await verifyCredential(auth, password))) {
    await recordLoginFailure(env, rate);
    throw new HttpError(401, 'Téléphone ou mot de passe incorrect.', 'INVALID_CREDENTIALS');
  }
  await clearLoginRate(env, rate);
  const created = await createClientSession(env, client, auth);
  return json({ success: true, client: cleanClone(client), session: publicClientSessionView(created.session) }, {
    headers: { 'Set-Cookie': setCookie(CLIENT_SESSION_COOKIE, created.sid, CLIENT_SESSION_TTL) }
  });
}

async function handlePublicOrder(request, env) {
  assertSameOrigin(request);
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 8_000_000);
  const state = ctx.state;
  const client = ctx.client;
  const cart = Array.isArray(body.cart) ? body.cart : [];
  if (!cart.length || cart.length > 100) throw new HttpError(400, 'Panier vide ou invalide.', 'INVALID_CART');

  const grouped = new Map();
  for (const line of cart) {
    const item = state.items.find(i => i.id === line.itemId && !i.marketplaceHidden);
    if (!item) throw new HttpError(400, 'Un article du panier est introuvable.', 'ITEM_NOT_FOUND');
    const company = state.companies.find(c => c.id === item.companyId);
    if (!company) throw new HttpError(400, 'La boutique d’un article est introuvable.', 'COMPANY_NOT_FOUND');
    const qty = Math.max(1, Math.min(10000, Number(line.qty || 1)));
    const isProduct = !['service', 'services', 'prestation'].includes(String(item.type || '').toLowerCase());
    if (isProduct && item.stockType !== 'unlimited' && Number(item.stock || 0) < qty) throw new HttpError(409, `Stock insuffisant pour : ${item.name}`, 'INSUFFICIENT_STOCK');
    const unit = Number(item.sell || 0);
    const orderLine = { itemId: item.id, item: item.name, category: item.cat || '', type: isProduct ? 'Produit' : 'Service', qty, unit, total: unit * qty };
    if (!grouped.has(item.companyId)) grouped.set(item.companyId, { company, lines: [], changedItems: [] });
    grouped.get(item.companyId).lines.push(orderLine);
  }

  const method = String(body.paymentMethod || 'PAIEMENT À LA LIVRAISON').slice(0, 50);
  if (grouped.size > 1 && method !== 'PAIEMENT À LA LIVRAISON') {
    throw new HttpError(400, 'Pour une commande contenant plusieurs boutiques, utilisez le paiement à la livraison.', 'MULTI_SHOP_PAYMENT_RESTRICTED');
  }
  const payOnDelivery = method === 'PAIEMENT À LA LIVRAISON';
  const paymentRef = String(body.paymentRef || '').trim().slice(0, 200);
  if (!payOnDelivery && !paymentRef) throw new HttpError(400, 'Identifiant de transaction obligatoire pour un paiement immédiat.', 'PAYMENT_REFERENCE_REQUIRED');

  const deliveryCity = String(body.deliveryCity || '').trim().slice(0, 80);
  const deliveryNeighborhood = String(body.deliveryNeighborhood || '').trim().slice(0, 100);
  const deliveryAddressDetail = String(body.deliveryAddressDetail || '').trim().slice(0, 500);
  const shippingByCompany = new Map((Array.isArray(body.shippingByCompany) ? body.shippingByCompany : []).slice(0, 100).map(row => [String(row?.companyId || ''), String(row?.methodId || row?.method || '')]));
  const configuredDeliveryRequested = Boolean(deliveryCity);

  const checkoutId = `achat_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const createdOrders = [];
  let grandTotal = 0;

  // Valider tous les lots avant de modifier le stock ou d'enregistrer une commande.
  // Le minimum hors ville est appliqué au TOTAL GÉNÉRAL du checkout, jamais séparément par boutique.
  const preparedGroups = [];
  let hasOutsideDelivery = false;
  let preparedGrandTotal = 0;
  for (const [companyId, group] of grouped) {
    const orderItems = group.lines;
    const subtotal = orderItems.reduce((sum, line) => sum + line.total, 0);
    let deliveryFeeRate = marketDeliveryRateForSubtotal(subtotal);
    let deliveryFee = Math.round(subtotal * deliveryFeeRate);
    let deliveryCityForOrder = '';
    let deliveryAddressForOrder = '';
    let deliveryNeighborhoodForOrder = '';
    let shippingMethod = '';
    let shippingMethodId = '';
    let shippingCityFee = deliveryFee;
    let shippingMethodFee = 0;
    if (configuredDeliveryRequested) {
      const delivery = calculateMarketDelivery(group.company, subtotal, deliveryCity, shippingByCompany.get(String(companyId)) || '', deliveryNeighborhood);
      deliveryFeeRate = delivery.deliveryFeeRate;
      deliveryFee = delivery.deliveryFee;
      deliveryCityForOrder = delivery.city;
      deliveryAddressForOrder = deliveryAddressDetail;
      shippingMethod = delivery.methodName;
      shippingMethodId = delivery.methodId;
      shippingCityFee = delivery.cityFee;
      shippingMethodFee = delivery.methodFee;
      deliveryNeighborhoodForOrder = delivery.neighborhoodName || '';
      if (!delivery.local) hasOutsideDelivery = true;
      if (!delivery.pickup && !deliveryAddressForOrder) throw new HttpError(400, 'Le détail sur l’adresse de livraison est obligatoire.', 'DELIVERY_ADDRESS_REQUIRED');
    }
    preparedGrandTotal += subtotal + deliveryFee;
    preparedGroups.push({ companyId, group, orderItems, subtotal, deliveryFeeRate, deliveryFee, deliveryCityForOrder, deliveryAddressForOrder, deliveryNeighborhoodForOrder, shippingMethod, shippingMethodId, shippingCityFee, shippingMethodFee });
  }

  if (configuredDeliveryRequested && hasOutsideDelivery && preparedGrandTotal < 10000) {
    throw new HttpError(400, `Toute commande hors de la ville de la boutique doit avoir un total général d’au moins 10 000 FCFA. Total actuel : ${Math.round(preparedGrandTotal).toLocaleString('fr-FR')} FCFA.`, 'OUTSIDE_CITY_MINIMUM_ORDER');
  }

  for (const prepared of preparedGroups) {
    const { companyId, group, orderItems, subtotal, deliveryFeeRate, deliveryFee, deliveryCityForOrder, deliveryAddressForOrder, deliveryNeighborhoodForOrder, shippingMethod, shippingMethodId, shippingCityFee, shippingMethodFee } = prepared;
    for (const line of orderItems) {
      const item = state.items.find(i => i.id === line.itemId && i.companyId === companyId);
      if (line.type === 'Produit' && item?.stockType !== 'unlimited') item.stock = Number(item.stock || 0) - line.qty;
      if (item) group.changedItems.push(item);
    }
    const total = subtotal + deliveryFee;
    grandTotal += total;
    const order = {
      id: `cmd_${crypto.randomUUID()}`,
      checkoutId,
      companyId,
      shopName: group.company?.name || 'Boutique',
      clientId: client.id,
      client: client.name,
      clientPhone: client.phone,
      clientEmail: client.email || '',
      date: now,
      items: orderItems,
      item: orderItems.map(x => x.item).join(', '),
      qty: orderItems.reduce((a, x) => a + x.qty, 0),
      subtotal, deliveryFeeRate, deliveryFee, total,
      deliveryCity: deliveryCityForOrder,
      deliveryNeighborhood: deliveryNeighborhoodForOrder,
      deliveryAddressDetail: deliveryAddressForOrder,
      shippingMethod, shippingMethodId, shippingCityFee, shippingMethodFee,
      paymentMethod: method,
      paymentTiming: payOnDelivery ? 'delivery' : 'now',
      paymentStatus: payOnDelivery ? 'À payer à la livraison' : 'Paiement déclaré par le client',
      paymentCurrency: method === 'USDT TRC20' ? 'USD' : 'FCFA',
      paymentAmount: method === 'USDT TRC20' ? Number((total / 600).toFixed(2)) : total,
      transactionId: payOnDelivery ? '' : paymentRef,
      paymentProofType: payOnDelivery ? 'none' : String(body.paymentProofType || 'transaction_id').slice(0, 50),
      paymentRef: payOnDelivery ? '' : paymentRef,
      paymentCaptureName: String(body.paymentCaptureName || '').slice(0, 200),
      paymentCaptureData: String(body.paymentCaptureData || '').slice(0, 6_000_000),
      validationStatus: 'En attente de validation',
      deliveryStatus: 'En attente de validation',
      afterSaleStatus: '',
      delivery: 'En attente de validation',
      source: 'commande GLOBAL MARKET multi-boutiques client connecté'
    };
    state.orders.push(order);
    createdOrders.push(order);
    await persistStateDelta(env, { arrays: {
      items: { upserts: group.changedItems, deletes: [] },
      orders: { upserts: [order], deletes: [] }
    } }, { role: 'system', companyId });
  }
  return json({ success: true, checkoutId, orders: createdOrders.map(cleanClone), grandTotal }, { status: 201 });
}

async function handlePublicOrderCancel(request, env) {
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 20_000);
  const order = ctx.state.orders.find(o => o.id === body.orderId && o.clientId === ctx.client.id);
  if (!order) throw new HttpError(404, 'Commande introuvable.', 'ORDER_NOT_FOUND');
  if (String(order.paymentStatus || '').toLowerCase().includes('confirm')) {
    throw new HttpError(409, 'Une commande dont le paiement a été confirmé ne peut plus être annulée.', 'ORDER_PAYMENT_CONFIRMED');
  }
  if (String(order.validationStatus || '').toLowerCase().includes('annul')) return json({ success: true, order: cleanClone(order) });
  const changedItems = [];
  if (!order.stockRestored) {
    for (const line of Array.isArray(order.items) ? order.items : []) {
      const item = ctx.state.items.find(i => i.id === line.itemId && i.companyId === order.companyId);
      if (item && String(line.type || '').toLowerCase() === 'produit' && item.stockType !== 'unlimited') {
        item.stock = Number(item.stock || 0) + Number(line.qty || 0);
        changedItems.push(item);
      }
    }
    order.stockRestored = true;
  }
  order.validationStatus = 'Annuler';
  order.deliveryStatus = 'Aucune action';
  order.afterSaleStatus = 'Annulée par le client';
  order.delivery = 'Commande annulée';
  order.clientCancelled = true;
  order.cancelledAt = new Date().toISOString();
  order.cancelledBy = 'client';
  order.marketplaceReported = false;
  await persistStateDelta(env, { arrays: {
    items: { upserts: changedItems, deletes: [] },
    orders: { upserts: [order], deletes: [] }
  } }, { role: 'system', companyId: order.companyId });
  return json({ success: true, order: cleanClone(order) });
}

async function handlePublicOrderDelete(request, env) {
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 20_000);
  const order = ctx.state.orders.find(o => o.id === body.orderId && o.clientId === ctx.client.id);
  if (!order) throw new HttpError(404, 'Commande introuvable.', 'ORDER_NOT_FOUND');
  if (String(order.paymentStatus || '').toLowerCase().includes('confirm')) {
    throw new HttpError(409, 'Une commande payée et confirmée ne peut plus être supprimée.', 'ORDER_PAYMENT_CONFIRMED');
  }
  if (!String(order.validationStatus || '').toLowerCase().includes('annul')) {
    throw new HttpError(409, 'Annulez d’abord la commande avant de la supprimer.', 'ORDER_NOT_CANCELLED');
  }
  await persistStateDelta(env, { arrays: { orders: { upserts: [], deletes: [{ id: order.id, companyId: order.companyId }] } } }, { role: 'system', companyId: order.companyId });
  return json({ success: true });
}

async function handlePublicOrderPayment(request, env) {
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 30_000);
  const order = ctx.state.orders.find(o => o.id === body.orderId && o.clientId === ctx.client.id);
  if (!order) throw new HttpError(404, 'Commande introuvable.', 'ORDER_NOT_FOUND');
  const validation = String(order.validationStatus || '').toLowerCase();
  if (!validation.includes('valid')) throw new HttpError(409, 'Le paiement est disponible uniquement après validation de la commande par la boutique.', 'ORDER_NOT_VALIDATED');
  if (validation.includes('annul')) throw new HttpError(409, 'Cette commande est annulée.', 'ORDER_CANCELLED');
  if (String(order.paymentStatus || '').toLowerCase().includes('confirm')) throw new HttpError(409, 'Le paiement de cette commande est déjà confirmé.', 'PAYMENT_ALREADY_CONFIRMED');
  const method = String(body.method || '').trim().toUpperCase();
  if (!['WAVE', 'USDT TRC20', 'USDTTRC20'].includes(method)) throw new HttpError(400, 'Moyen de paiement invalide.', 'INVALID_PAYMENT_METHOD');
  const transactionId = String(body.transactionId || '').trim().slice(0, 200);
  if (!transactionId) throw new HttpError(400, 'ID de la transaction obligatoire.', 'TRANSACTION_ID_REQUIRED');
  order.paymentMethod = method.startsWith('USDT') ? 'USDT TRC20' : 'WAVE';
  order.transactionId = transactionId;
  order.paymentRef = transactionId;
  order.paymentProofType = 'transaction_id';
  order.paymentStatus = 'Paiement déclaré par le client';
  order.clientPaymentSubmittedAt = new Date().toISOString();
  await persistStateDelta(env, { arrays: { orders: { upserts: [order], deletes: [] } } }, { role: 'system', companyId: order.companyId });
  return json({ success: true, order: cleanClone(order) });
}

async function handlePublicClientProfileUpdate(request, env) {
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 50_000);
  const client = ctx.client;
  const oldPhone = normalizePhone(client.phone);
  const newName = String(body.name ?? client.name ?? '').trim().slice(0, 160);
  const newPhone = normalizePhone(body.phone ?? client.phone);
  const newEmail = normalizeIdentifier(body.email ?? client.email);
  const currentPassword = String(body.currentPassword || '');
  const newPasswordRaw = String(body.newPassword || '');
  if (!newName || !newPhone) throw new HttpError(400, 'Nom et identifiant / téléphone obligatoires.', 'MISSING_FIELDS');
  const changingPhone = newPhone !== oldPhone;
  const changingPassword = Boolean(newPasswordRaw);
  if (changingPhone || changingPassword) {
    if (!currentPassword || !(await verifyCredential(ctx.auth, currentPassword))) throw new HttpError(401, 'Mot de passe actuel incorrect.', 'CURRENT_PASSWORD_INVALID');
  }
  if (changingPhone) {
    const existingId = await env.GLOBAL_MARKET_KV.get(globalClientIndexKey(newPhone));
    if (existingId && existingId !== client.id) throw new HttpError(409, 'Cet identifiant / téléphone est déjà utilisé.', 'PHONE_EXISTS');
    if ((ctx.state.marketClients || []).some(c => c.id !== client.id && normalizePhone(c.phone) === newPhone)) throw new HttpError(409, 'Cet identifiant / téléphone est déjà utilisé.', 'PHONE_EXISTS');
  }
  client.name = newName;
  client.phone = newPhone;
  client.email = newEmail;
  client.updatedAt = new Date().toISOString();
  let newAuth = ctx.auth;
  if (changingPhone || changingPassword) {
    const passwordToWrite = changingPassword ? validatePassword(newPasswordRaw, 'client') : currentPassword;
    newAuth = await writeClientCredential(env, client, passwordToWrite);
  }
  await persistStateDelta(env, { arrays: { marketClients: { upserts: [client], deletes: [] } } }, { role: 'system', companyId: GLOBAL_CLIENT_SCOPE });
  if (changingPhone || changingPassword) {
    await env.GLOBAL_MARKET_KV.delete(`client-session:${ctx.sid}`);
    const created = await createClientSession(env, client, newAuth);
    return json({ success: true, client: cleanClone(client), session: publicClientSessionView(created.session) }, { headers: { 'Set-Cookie': setCookie(CLIENT_SESSION_COOKIE, created.sid, CLIENT_SESSION_TTL) } });
  }
  return json({ success: true, client: cleanClone(client), session: publicClientSessionView(ctx.session) });
}

async function handlePublicClientResetRequest(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 30_000);
  const phone = normalizePhone(body.phone || body.identifier);
  const ip = requestIp(request);
  const key = `rate:client-reset-request:${await rateKeyHash(`${ip}:${phone}`)}`;
  const rec = await getRateRecord(env, key);
  if (rec.resetAt > Date.now() && rec.count >= 3) throw new HttpError(429, 'Trop de demandes. Réessayez plus tard.', 'RATE_LIMITED');
  const state = await loadState(env, '*');
  const client = (state.marketClients || []).find(c => normalizePhone(c.phone) === phone);
  if (client) {
    state.passwordResetRequests = state.passwordResetRequests || [];
    let req = state.passwordResetRequests.find(r => r.role === 'client' && r.userId === client.id && r.status === 'pending');
    if (!req) {
      req = {
        id: `rst_${crypto.randomUUID()}`, companyId: GLOBAL_CLIENT_SCOPE, userId: client.id,
        userName: client.name || '', email: client.email || '', role: 'client', phone: client.phone || phone,
        reason: String(body.reason || 'Mot de passe oublié').slice(0, 300), status: 'pending', createdAt: new Date().toISOString()
      };
      await persistStateDelta(env, { arrays: { passwordResetRequests: { upserts: [req], deletes: [] } } }, { role: 'system', companyId: GLOBAL_CLIENT_SCOPE });
    }
  }
  await env.GLOBAL_MARKET_KV.put(key, JSON.stringify({ count: (rec.count || 0) + 1, resetAt: Date.now() + 3600000 }), { expirationTtl: 3600 });
  return json({ success: true, message: 'Si le compte existe, la demande de réinitialisation a été transmise au Super Admin GLOBAL MARKET.' });
}

async function handleSuperResetClientPassword(request, env) {
  const ctx = await getEmployeeSession(request, env, true);
  requireRole(ctx.user, ['superadmin']);
  const body = await readJson(request, 30_000);
  const client = (ctx.state.marketClients || []).find(c => c.id === body.clientId);
  if (!client) throw new HttpError(404, 'Compte client introuvable.', 'CLIENT_NOT_FOUND');
  const tempPassword = generateTempPassword();
  await writeClientCredential(env, client, tempPassword);
  const reset = (ctx.state.passwordResetRequests || []).find(r => r.id === body.requestId && r.role === 'client' && r.userId === client.id);
  if (reset) {
    reset.status = 'done'; reset.doneAt = new Date().toISOString(); reset.doneBy = ctx.user.id;
  }
  await persistStateDelta(env, { arrays: {
    marketClients: { upserts: [client], deletes: [] },
    passwordResetRequests: { upserts: reset ? [reset] : [], deletes: [] }
  } }, { role: 'system', companyId: GLOBAL_CLIENT_SCOPE });
  return json({ success: true, temporaryPassword: tempPassword });
}

async function handlePublicMessageSend(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 50_000);
  const state = await loadState(env, '*');
  const companyId = String(body.companyId || '').trim();
  const company = state.companies.find(c => c.id === companyId);
  if (!company) throw new HttpError(404, 'Boutique introuvable.', 'COMPANY_NOT_FOUND');
  const text = String(body.message || '').trim().slice(0, 3000);
  if (!text) throw new HttpError(400, 'Message obligatoire.', 'MESSAGE_REQUIRED');
  let client = null;
  try { client = (await getClientSession(request, env, false)).client; } catch {}
  const message = {
    id: `msg_${crypto.randomUUID()}`, companyId, clientId: client?.id || '',
    clientName: client?.name || String(body.name || 'Visiteur').trim().slice(0, 160),
    clientPhone: client?.phone || normalizePhone(body.phone), clientEmail: client?.email || normalizeIdentifier(body.email),
    senderType: 'client', senderName: client?.name || String(body.name || 'Visiteur').trim().slice(0, 160),
    body: text, createdAt: new Date().toISOString(), adminDeleted: false, clientDeleted: false, readByAdmin: false, readByClient: true
  };
  await persistStateDelta(env, { arrays: { marketMessages: { upserts: [message], deletes: [] } } }, { role: 'system', companyId });
  return json({ success: true, message: cleanClone(message) }, { status: 201 });
}

async function handlePublicMessageDelete(request, env) {
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 50_000);
  const ids = new Set((Array.isArray(body.ids) ? body.ids : [body.id]).map(String).filter(Boolean).slice(0, 200));
  const changed = [];
  for (const msg of ctx.state.marketMessages || []) {
    if (ids.has(String(msg.id)) && msg.clientId === ctx.client.id) {
      msg.clientDeleted = true; msg.clientDeletedAt = new Date().toISOString(); changed.push(msg);
    }
  }
  const byCompany = new Map();
  for (const msg of changed) {
    if (!byCompany.has(msg.companyId)) byCompany.set(msg.companyId, []);
    byCompany.get(msg.companyId).push(msg);
  }
  for (const [companyId, rows] of byCompany) {
    await persistStateDelta(env, { arrays: { marketMessages: { upserts: rows, deletes: [] } } }, { role: 'system', companyId });
  }
  return json({ success: true, count: changed.length });
}


/* ==========================================================================\n   GLOBAL MARKET V6.0 — stockage relationnel D1 + API ciblée + temps réel DO\n   Les anciennes tables JSON sont conservées uniquement pour la migration.\n   ========================================================================== */
function v6Now() { return new Date().toISOString(); }
function v6JsonParse(raw, fallback = {}) { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function v6Payload(row) { return v6JsonParse(row?.payload_json, {}); }
function v6Bool(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0 || value == null) return 0;
  const text = String(value).trim().toLowerCase();
  return ['1','true','yes','oui','on'].includes(text) ? 1 : 0;
}
function v6Created(row) { return String(row?.createdAt || row?.date || row?.created_at || v6Now()); }
function v6Updated(row) { return String(row?.updatedAt || row?.updated_at || v6Now()); }
function v6SearchText(row) { return [row?.name,row?.code,row?.cat,row?.category,row?.detail,row?.marketplaceDesc].filter(Boolean).join(' ').toLowerCase().slice(0,4000); }
function v6ReadDb(request, env, strong = false) {
  const bookmark = request?.headers?.get?.('X-D1-Bookmark') || (strong ? 'first-primary' : 'first-unconstrained');
  return typeof env.GLOBAL_MARKET_D1.withSession === 'function' ? env.GLOBAL_MARKET_D1.withSession(bookmark) : env.GLOBAL_MARKET_D1;
}
function v6AttachBookmark(response, db) {
  try { const bookmark = db?.getBookmark?.(); if (bookmark) response.headers.set('X-D1-Bookmark', bookmark); } catch {}
  response.headers.set('X-Global-Market-Storage', 'D1-RELATIONAL-V6');
  return response;
}
async function v6MetaGet(env, key) { await ensureDB(env); const row = await env.GLOBAL_MARKET_D1.prepare('SELECT value FROM gm_meta WHERE key=?').bind(key).first(); return row?.value ?? null; }
async function v6MetaSet(env, key, value) { const now=v6Now(); await env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_meta(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(key,String(value),now).run(); if(key===V6_MIGRATION_META_KEY){v6ReadyCacheValue=String(value)===V6_SCHEMA_VERSION;v6ReadyCacheAt=Date.now();} }
async function v6IsReady(env, force=false) { const now=Date.now(); if(!force && v6ReadyCacheValue!==null && now-v6ReadyCacheAt<60000)return v6ReadyCacheValue; const ready=(await v6MetaGet(env,V6_MIGRATION_META_KEY))===V6_SCHEMA_VERSION;v6ReadyCacheValue=ready;v6ReadyCacheAt=now;return ready; }

function v6CompanyFromRow(row) { if(!row)return null; return {...v6Payload(row),id:row.id,name:row.name,email:row.email||'',phone:row.phone||'',status:row.status||'',planCode:row.plan_code||'',subscriptionEnd:row.subscription_end||'',shopSlug:row.shop_slug||'',businessType:row.business_type||''}; }
function v6UserFromRow(row) { if(!row)return null; return {...v6Payload(row),id:row.id,companyId:row.company_id||null,name:row.name||'',email:row.email||'',role:row.role,status:row.status,mainAdmin:Boolean(row.main_admin)}; }
function v6ItemFromRow(row) { if(!row)return null; return {...v6Payload(row),id:row.id,companyId:row.company_id,code:row.code||'',name:row.name||'',cat:row.category||'',type:row.item_type||'',sell:Number(row.sell||0),stock:Number(row.stock||0),stockType:row.stock_type||'',marketplaceHidden:Boolean(row.marketplace_hidden)}; }
function v6OrderFromRow(row) { if(!row)return null; return {...v6Payload(row),id:row.id,checkoutId:row.checkout_id||'',companyId:row.company_id,clientId:row.client_id,date:row.order_date,subtotal:Number(row.subtotal||0),deliveryFee:Number(row.delivery_fee||0),total:Number(row.total||0),deliveryCity:row.delivery_city||'',deliveryNeighborhood:row.delivery_neighborhood||'',shippingMethod:row.shipping_method||'',paymentMethod:row.payment_method||'',paymentStatus:row.payment_status||'',validationStatus:row.validation_status||'',deliveryStatus:row.delivery_status||''}; }
function v6ClientFromRow(row) { if(!row)return null; return {...v6Payload(row),id:row.id,companyId:row.company_id,name:row.name||'',phone:row.phone||'',email:row.email||''}; }
function v6MarketClientFromRow(row) { if(!row)return null; return {...v6Payload(row),id:row.id,companyId:GLOBAL_CLIENT_SCOPE,scope:'global',name:row.name||'',phone:row.phone||'',email:row.email||''}; }
function v6MessageFromRow(row) { if(!row)return null; return {...v6Payload(row),id:row.id,companyId:row.company_id,clientId:row.client_id||'',senderType:row.sender_type,senderName:row.sender_name||'',body:row.body,adminDeleted:Boolean(row.admin_deleted),clientDeleted:Boolean(row.client_deleted),readByAdmin:Boolean(row.read_by_admin),readByClient:Boolean(row.read_by_client),createdAt:row.created_at}; }
function v6GenericFromRow(row) { return row ? v6Payload(row) : null; }

function v6DataUri(value) { return /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(value||'')); }
async function v6ExternalizeMedia(env, ownerType, ownerId, field, value) {
  const match=v6DataUri(value); if(!match) return value;
  const mime=match[1].slice(0,100); const raw=String(value||'');
  if (env.GLOBAL_MARKET_MEDIA) {
    const bin=atob(match[2].replace(/\s+/g,'')); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const ext=(mime.split('/')[1]||'bin').replace(/[^a-z0-9]/gi,'').slice(0,8)||'bin';
    const key=`${ownerType}/${ownerId}/${field}-${crypto.randomUUID()}.${ext}`;
    await env.GLOBAL_MARKET_MEDIA.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:'public, max-age=31536000'}});
    return `/api/v6/media/${encodeURIComponent(key)}`;
  }
  if (env.GLOBAL_MARKET_KV && raw.length <= 22_000_000) {
    const key=`v610:media:${encodeURIComponent(String(ownerType))}:${encodeURIComponent(String(ownerId))}:${encodeURIComponent(String(field))}`;
    try {
      await env.GLOBAL_MARKET_KV.put(key,raw);
      return `/api/v6/media-kv/${encodeURIComponent(String(ownerType))}/${encodeURIComponent(String(ownerId))}/${encodeURIComponent(String(field))}`;
    } catch (error) { console.warn('[V6.1] média KV non externalisé',ownerType,ownerId,error?.message||error); }
  }
  return value;
}

function v610DecodeDataUri(raw){
  const m=v6DataUri(raw); if(!m)return null;
  const bin=atob(m[2].replace(/\s+/g,'')); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return {mime:m[1].slice(0,100),bytes};
}
async function handleV610KvMedia(request,env,ownerType,ownerId,field){
  const cacheKey=new Request(request.url,{method:'GET'}); try{const hit=await caches.default.match(cacheKey);if(hit)return hit}catch{}
  const key=`v610:media:${encodeURIComponent(String(ownerType))}:${encodeURIComponent(String(ownerId))}:${encodeURIComponent(String(field))}`;
  const raw=await env.GLOBAL_MARKET_KV.get(key); if(!raw)throw new HttpError(404,'Média introuvable.','MEDIA_NOT_FOUND');
  const decoded=v610DecodeDataUri(raw); if(!decoded) return Response.redirect(new URL(raw,request.url).href,302);
  const response=new Response(decoded.bytes,{headers:{'Content-Type':decoded.mime,'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800'}});
  try{await caches.default.put(cacheKey,response.clone())}catch{} return response;
}
async function handleV610ItemPhoto(request,env,itemId){
  const cacheKey=new Request(request.url,{method:'GET'}); try{const hit=await caches.default.match(cacheKey);if(hit)return hit}catch{}
  await ensureDB(env); const row=await env.GLOBAL_MARKET_D1.prepare(`SELECT CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.photo') ELSE NULL END AS photo FROM gm_items WHERE id=? LIMIT 1`).bind(String(itemId||'')).first();
  const raw=String(row?.photo||''); if(!raw)throw new HttpError(404,'Image produit introuvable.','MEDIA_NOT_FOUND');
  if(/^https?:\/\//i.test(raw)||raw.startsWith('/api/')) return Response.redirect(new URL(raw,request.url).href,302);
  const decoded=v610DecodeDataUri(raw); if(!decoded)throw new HttpError(404,'Image produit invalide.','MEDIA_NOT_FOUND');
  const response=new Response(decoded.bytes,{headers:{'Content-Type':decoded.mime,'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800'}});
  try{await caches.default.put(cacheKey,response.clone())}catch{} return response;
}
function v610CatalogItemFromRow(row){
  return {id:row.id,companyId:row.company_id,code:row.code||'',name:row.name||'',cat:row.category||'',type:row.item_type||'',sell:Number(row.sell||0),stock:Number(row.stock||0),stockType:row.stock_type||'',marketplaceHidden:Boolean(row.marketplace_hidden),detail:row.detail||'',marketplaceDesc:row.marketplace_desc||'',marketplacePromo:row.marketplace_promo||'',photo:row.photo||''};
}
function v610PublicCompanyFromRow(row){
  let delivery={}; try{delivery=row.market_delivery_config?JSON.parse(row.market_delivery_config):{}}catch{}
  return {id:row.id,name:row.name||'',email:row.email||'',phone:row.phone||'',status:row.status||'',planCode:row.plan_code||'',subscriptionEnd:row.subscription_end||'',shopSlug:row.shop_slug||'',businessType:row.business_type||'',address:row.address||row.city||'',activity:row.activity||'',shopBanner:row.shop_banner||'',shopColor:row.shop_color||'',marketWaveBusinessLink:row.wave_link||'',marketUsdtTrc20:row.usdt_trc20||'',marketDeliveryConfig:delivery};
}
async function v610SelectPublicCompanies(db,companyIds=null){
  let where='',bind=[]; if(Array.isArray(companyIds)&&companyIds.length){where=`WHERE c.id IN (${companyIds.map(()=>'?').join(',')})`;bind=companyIds;}
  const rows=await db.prepare(`SELECT c.id,c.name,c.email,c.phone,c.status,c.plan_code,c.subscription_end,c.shop_slug,c.business_type,c.city,
    CASE WHEN json_valid(c.payload_json) THEN COALESCE(json_extract(c.payload_json,'$.address'),c.city,'') ELSE COALESCE(c.city,'') END AS address,
    CASE WHEN json_valid(c.payload_json) THEN COALESCE(json_extract(c.payload_json,'$.activity'),'') ELSE '' END AS activity,
    CASE WHEN json_valid(c.payload_json) THEN COALESCE(json_extract(c.payload_json,'$.shopBanner'),'') ELSE '' END AS shop_banner,
    CASE WHEN json_valid(c.payload_json) THEN COALESCE(json_extract(c.payload_json,'$.shopColor'),'') ELSE '' END AS shop_color,
    CASE WHEN json_valid(c.payload_json) THEN COALESCE(json_extract(c.payload_json,'$.marketWaveBusinessLink'),'') ELSE '' END AS wave_link,
    CASE WHEN json_valid(c.payload_json) THEN COALESCE(json_extract(c.payload_json,'$.marketUsdtTrc20'),'') ELSE '' END AS usdt_trc20,
    CASE WHEN json_valid(c.payload_json) THEN COALESCE(json_extract(c.payload_json,'$.marketDeliveryConfig'),'{}') ELSE '{}' END AS market_delivery_config
    FROM gm_companies c ${where} ORDER BY c.name COLLATE NOCASE ASC`).bind(...bind).all();
  return (rows.results||[]).map(v610PublicCompanyFromRow);
}
async function v610FastLegacyState(env){
  try{const state=await readStateFallback(env,'*');if(state&&(state.items?.length||state.users?.length||state.companies?.length))return state}catch{}
  return null;
}
async function v610FastPublicPayload(env){
  try{const p=await env.GLOBAL_MARKET_KV.get(PUBLIC_PAYLOAD_CACHE_KEY,'json');if(p&&(p.items?.length||p.companies?.length))return p}catch{}
  const state=await v610FastLegacyState(env); if(!state)return null;
  return {companies:(state.companies||[]).map(publicCompany),items:(state.items||[]).map(publicItem),marketClients:[],orders:[],marketMessages:[],clientDeletedOrders:{},app:state.app||{}};
}
async function v610LegacyCatalogFast(request,env){
  const payload=await v610FastPublicPayload(env); const url=new URL(request.url),p=v6CatalogParams(url); if(!payload)return {items:[],companies:[],pagination:{page:p.page,pageSize:p.pageSize,total:0,pages:1},categories:[],migrationPending:true,source:'fast-cache-miss-v610',authoritativeEmpty:false};
  const companies=Array.isArray(payload.companies)?payload.companies:[], cmap=new Map(companies.map(c=>[String(c.id),c]));
  let rows=(Array.isArray(payload.items)?payload.items:[]).filter(i=>cmap.has(String(i.companyId||''))&&v6Bool(i.marketplaceHidden)===0);
  if(p.q)rows=rows.filter(i=>v6SearchText(i).includes(p.q)); if(p.category)rows=rows.filter(i=>String(i.cat||i.category||'')===p.category); if(p.companyId)rows=rows.filter(i=>String(i.companyId||'')===p.companyId);
  if(p.type==='product')rows=rows.filter(i=>!['service','services','prestation'].includes(String(i.type||'').toLowerCase())); if(p.type==='service')rows=rows.filter(i=>['service','services','prestation'].includes(String(i.type||'').toLowerCase()));
  if(p.sort==='priceAsc')rows.sort((a,b)=>Number(a.sell||0)-Number(b.sell||0));else if(p.sort==='priceDesc')rows.sort((a,b)=>Number(b.sell||0)-Number(a.sell||0));else if(p.sort==='name')rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr'));else rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const total=rows.length,pages=Math.max(1,Math.ceil(total/p.pageSize)),page=Math.min(p.page,pages),items=rows.slice((page-1)*p.pageSize,page*p.pageSize).map(publicItem),ids=new Set(items.map(i=>String(i.companyId||''))),categories=[...new Set(rows.map(i=>String(i.cat||i.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  return {items,companies:companies.filter(c=>ids.has(String(c.id||''))).map(publicCompany),pagination:{page,pageSize:p.pageSize,total,pages},categories,migrationPending:true,source:'kv-fast-legacy-v610',authoritativeEmpty:false};
}
let V610_CORE_HYDRATE_PROMISE=null,V610_MIGRATION_PROMISE=null;
async function v610HydrateCoreFromState(env,state){
  if(!state)return {hydrated:false}; const keys=['companies','users','items','marketClients']; let count=0,buf=[];
  for(const key of keys){for(const row of Array.isArray(state[key])?state[key]:[]){if(!row?.id)continue;buf.push(...await v6UpsertStatements(env,key,row));count++;if(buf.length>=20){await runD1Batches(env.GLOBAL_MARKET_D1,buf,20);buf=[];}}}
  if(buf.length)await runD1Batches(env.GLOBAL_MARKET_D1,buf,20); await v6MetaSet(env,'v610_core_hydrated',JSON.stringify({at:v6Now(),count})); return {hydrated:true,count};
}
function v610ScheduleCoreHydration(env,executionCtx){
  if(V610_CORE_HYDRATE_PROMISE)return; V610_CORE_HYDRATE_PROMISE=(async()=>{const state=await v610FastLegacyState(env);if(state)await v610HydrateCoreFromState(env,state);})().catch(e=>console.warn('[V6.1] hydratation coeur différée',e?.message||e)).finally(()=>{V610_CORE_HYDRATE_PROMISE=null});
  if(executionCtx?.waitUntil)executionCtx.waitUntil(V610_CORE_HYDRATE_PROMISE);
}
function v610ScheduleFullMigration(env,executionCtx){
  if(V610_MIGRATION_PROMISE)return; V610_MIGRATION_PROMISE=(async()=>{try{if(await v6IsReady(env))return;const lock=await env.GLOBAL_MARKET_KV.get('v610:auto-migration-lock');if(lock)return;await env.GLOBAL_MARKET_KV.put('v610:auto-migration-lock',String(Date.now()),{expirationTtl:120});try{await v6MigrateLegacy(env)}finally{await env.GLOBAL_MARKET_KV.delete('v610:auto-migration-lock')}}catch(e){console.warn('[V6.1] migration complète différée',e?.message||e)}})().finally(()=>{V610_MIGRATION_PROMISE=null});
  if(executionCtx?.waitUntil)executionCtx.waitUntil(V610_MIGRATION_PROMISE);
}
async function v610FindLegacyUserFast(env,indexedId,identifier){
  const state=await v610FastLegacyState(env); let user=(state?.users||[]).find(u=>String(u.id)===String(indexedId||'')||normalizeIdentifier(u.email||u.username)===identifier)||null; let company=user?.companyId?(state?.companies||[]).find(c=>String(c.id)===String(user.companyId)):null;
  if(!user&&indexedId){try{const r=await env.GLOBAL_MARKET_D1.prepare(`SELECT company_id,data FROM company_state_patches WHERE section='array:users' AND record_id=? AND deleted=0 ORDER BY updated_at DESC LIMIT 1`).bind(indexedId).first();if(r?.data){user=JSON.parse(r.data);if(!user.companyId)user.companyId=r.company_id;}}catch{}}
  if(user?.companyId&&!company){try{const r=await env.GLOBAL_MARKET_D1.prepare(`SELECT data FROM company_state_patches WHERE section='array:companies' AND record_id=? AND deleted=0 ORDER BY updated_at DESC LIMIT 1`).bind(user.companyId).first();if(r?.data)company=JSON.parse(r.data)}catch{} }
  if(user?.companyId&&!company){try{const snaps=await readCompanySnapshots(env,user.companyId);const st=snaps?.[0]?.state;company=(st?.companies||[]).find(c=>String(c.id)===String(user.companyId))||null}catch{} }
  return {user,company};
}
async function v610MinimalEmployeeData(db,user){
  const state=defaultState();state.app={name:APP_NAME,storageVersion:6,architecture:'D1 relational V6.1 progressive'};
  if(user.role==='superadmin'){
    state.companies=await v610SelectPublicCompanies(db); const ur=await db.prepare('SELECT id,company_id,name,email,role,status,main_admin,created_at,updated_at FROM gm_users ORDER BY created_at DESC LIMIT 5000').all();state.users=(ur.results||[]).map(r=>({id:r.id,companyId:r.company_id||null,name:r.name||'',email:r.email||'',role:r.role,status:r.status,mainAdmin:Boolean(r.main_admin)}));
  }else{
    const cr=await db.prepare(`SELECT id,name,email,phone,status,plan_code,subscription_end,shop_slug,business_type,city,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.address'),city,'') ELSE COALESCE(city,'') END address,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.activity'),'') ELSE '' END activity,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.shopBanner'),'') ELSE '' END shop_banner,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.shopColor'),'') ELSE '' END shop_color,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.marketWaveBusinessLink'),'') ELSE '' END wave_link,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.marketUsdtTrc20'),'') ELSE '' END usdt_trc20,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.marketDeliveryConfig'),'{}') ELSE '{}' END market_delivery_config FROM gm_companies WHERE id=?`).bind(user.companyId).first(); if(cr)state.companies=[v610PublicCompanyFromRow(cr)];
    const ur=await db.prepare('SELECT id,company_id,name,email,role,status,main_admin FROM gm_users WHERE company_id=? ORDER BY created_at').bind(user.companyId).all();state.users=(ur.results||[]).map(r=>({id:r.id,companyId:r.company_id||null,name:r.name||'',email:r.email||'',role:r.role,status:r.status,mainAdmin:Boolean(r.main_admin)}));
  }
  return normalizeState(state);
}


// V6.1.1 — restauration historique complète sans écraser les écritures relationnelles récentes.
const V611_RECONCILE_META_KEY='historical_reconcile_v611';
let V611_RECONCILE_PROMISE=null;
const V611_TABLES={companies:'gm_companies',users:'gm_users',items:'gm_items',sales:'gm_sales',payments:'gm_payments',orders:'gm_orders',clients:'gm_clients',marketClients:'gm_market_clients',marketMessages:'gm_market_messages',passwordResetRequests:'gm_password_reset_requests',stockEntries:'gm_stock_entries',stockOutputs:'gm_stock_outputs',stockMovements:'gm_stock_movements',caisseLogs:'gm_caisse_logs'};
const V611_KEYS=['companies','users','marketClients','clients','items','sales','orders','payments','marketMessages','passwordResetRequests','stockEntries','stockOutputs','stockMovements','caisseLogs'];
function v611MergeRows(primary=[],legacy=[]){
  const map=new Map();
  for(const row of Array.isArray(legacy)?legacy:[])if(row?.id!=null)map.set(String(row.id),cleanClone(row));
  for(const row of Array.isArray(primary)?primary:[])if(row?.id!=null)map.set(String(row.id),cleanClone(row));
  return [...map.values()];
}
function v611MergeStatePreferD1(primary,legacy){
  const a=normalizeState(primary||defaultState()),b=normalizeState(legacy||defaultState()),out=cleanClone(b);
  for(const key of new Set([...Object.keys(b),...Object.keys(a)])){
    if(Array.isArray(a[key])||Array.isArray(b[key]))out[key]=v611MergeRows(a[key]||[],b[key]||[]);
    else if(a[key]&&typeof a[key]==='object'&&!Array.isArray(a[key]))out[key]={...(b[key]||{}),...(a[key]||{})};
    else if(a[key]!==undefined)out[key]=a[key];
  }
  out.app={...(b.app||{}),...(a.app||{}),storageVersion:6,historyBridge:'v6.1.1'};
  return normalizeState(out);
}
async function v611ExistingIds(env,table,ids){
  const found=new Set(),all=[...new Set((ids||[]).map(String).filter(Boolean))];
  for(let i=0;i<all.length;i+=80){const chunk=all.slice(i,i+80),marks=chunk.map(()=>'?').join(',');if(!chunk.length)continue;const r=await env.GLOBAL_MARKET_D1.prepare(`SELECT id FROM ${table} WHERE id IN (${marks})`).bind(...chunk).all();for(const row of r.results||[])found.add(String(row.id));}
  return found;
}
async function v611InsertMissingFromLegacy(env,legacy,{scope='*',mark=false}={}){
  if(!legacy)return {inserted:0,rows:0};await ensureDB(env);let inserted=0,rows=0,buffer=[];
  for(const key of V611_KEYS){
    const table=V611_TABLES[key],source=(Array.isArray(legacy[key])?legacy[key]:[]).filter(row=>row?.id);
    if(!table||!source.length)continue;
    const existing=await v611ExistingIds(env,table,source.map(x=>x.id));
    for(const row of source){
      rows++;if(existing.has(String(row.id)))continue;
      if(key==='users'&&normalizeIdentifier(row.email)){const same=await env.GLOBAL_MARKET_D1.prepare('SELECT id FROM gm_users WHERE lower(email)=? LIMIT 1').bind(normalizeIdentifier(row.email)).first();if(same)continue;}
      if(key==='marketClients'&&normalizePhone(row.phone)){const same=await env.GLOBAL_MARKET_D1.prepare('SELECT id FROM gm_market_clients WHERE phone=? LIMIT 1').bind(normalizePhone(row.phone)).first();if(same)continue;}
      buffer.push(...await v6UpsertStatements(env,key,row));inserted++;if(buffer.length>=24){await runD1Batches(env.GLOBAL_MARKET_D1,buffer,24);buffer=[];}
    }
  }
  if(buffer.length)await runD1Batches(env.GLOBAL_MARKET_D1,buffer,24);
  // Les réglages historiques sont insérés uniquement s'ils n'existent pas déjà en V6.
  for(const section of [...COMPANY_OBJECT_KEYS,'clientDeletedOrders']){
    const obj=legacy[section]&&typeof legacy[section]==='object'?legacy[section]:{};const st=[];
    for(const [companyId,value] of Object.entries(obj))st.push(env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_company_settings(company_id,section,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(company_id,section) DO NOTHING`).bind(companyId,section,JSON.stringify(value??null),v6Now()));
    if(st.length)await runD1Batches(env.GLOBAL_MARKET_D1,st,24);
  }
  const result={at:v6Now(),scope,rows,inserted};if(mark)await v6MetaSet(env,V611_RECONCILE_META_KEY,JSON.stringify(result));return result;
}
async function v611HistoricalReconcileDone(env){return Boolean(await v6MetaGet(env,V611_RECONCILE_META_KEY));}
function v611ScheduleHistoricalReconcile(env,executionCtx){
  if(V611_RECONCILE_PROMISE)return V611_RECONCILE_PROMISE;
  V611_RECONCILE_PROMISE=(async()=>{try{
    if(await v611HistoricalReconcileDone(env))return {already:true};
    const lock=await env.GLOBAL_MARKET_KV.get('v611:historical-reconcile-lock');if(lock)return {locked:true};
    await env.GLOBAL_MARKET_KV.put('v611:historical-reconcile-lock',String(Date.now()),{expirationTtl:180});
    try{const legacy=await loadStateLegacy(env,'*');return await v611InsertMissingFromLegacy(env,legacy,{scope:'*',mark:true});}
    finally{await env.GLOBAL_MARKET_KV.delete('v611:historical-reconcile-lock');}
  }catch(error){console.warn('[V6.1.1] restauration historique différée',error?.message||error);return {error:String(error?.message||error||'')};}})().finally(()=>{V611_RECONCILE_PROMISE=null});
  if(executionCtx?.waitUntil)executionCtx.waitUntil(V611_RECONCILE_PROMISE);return V611_RECONCILE_PROMISE;
}

function v611CompanyHistoryKey(companyId){return `v611:company-history:${encodeURIComponent(String(companyId||''))}`;}
function v611ClientHistoryKey(clientId){return `v611:client-history:${encodeURIComponent(String(clientId||''))}`;}
async function v611CompanyHistoryDone(env,companyId){return Boolean(companyId&&await env.GLOBAL_MARKET_KV.get(v611CompanyHistoryKey(companyId)));}
async function v611ClientHistoryDone(env,clientId){return Boolean(clientId&&await env.GLOBAL_MARKET_KV.get(v611ClientHistoryKey(clientId)));}
async function v611MarkCompanyHistory(env,companyId,result){if(companyId)await env.GLOBAL_MARKET_KV.put(v611CompanyHistoryKey(companyId),JSON.stringify({at:v6Now(),...(result||{})}));}
async function v611MarkClientHistory(env,clientId,result){if(clientId)await env.GLOBAL_MARKET_KV.put(v611ClientHistoryKey(clientId),JSON.stringify({at:v6Now(),...(result||{})}));}
async function v611LegacyCompanyState(env,companyId,user){
  try{
    let legacy=await readStateFallback(env,companyId);
    const useful=legacy&&V611_KEYS.some(k=>Array.isArray(legacy[k])&&legacy[k].length);
    if(!useful)legacy=await loadStateLegacy(env,companyId);
    return user?scopeState(legacy,user):legacy;
  }catch(error){console.warn('[V6.1.1] lecture historique entreprise différée',error?.message||error);return null;}
}
async function v611LegacyClientSlice(env,client){
  try{
    let legacy=await readStateFallback(env,'*');
    const phone=normalizePhone(client.phone),email=normalizeIdentifier(client.email);
    const hasClientData=legacy&&((legacy.orders||[]).some(o=>String(o.clientId||'')===String(client.id))||(legacy.marketClients||[]).some(c=>String(c.id)===String(client.id)||(phone&&normalizePhone(c.phone)===phone)||(email&&normalizeIdentifier(c.email)===email)));
    if(!hasClientData)legacy=await loadStateLegacy(env,'*');
    const aliases=new Set([String(client.id)]);
    for(const c of legacy.marketClients||[])if(String(c.id)===String(client.id)||(phone&&normalizePhone(c.phone)===phone)||(email&&normalizeIdentifier(c.email)===email))aliases.add(String(c.id));
    const orders=(legacy.orders||[]).filter(o=>aliases.has(String(o.clientId||''))).map(o=>({...cleanClone(o),clientId:client.id}));
    const messages=(legacy.marketMessages||[]).filter(m=>aliases.has(String(m.clientId||''))).map(m=>({...cleanClone(m),clientId:client.id}));
    const companyIds=new Set([...orders,...messages].map(x=>String(x.companyId||'')).filter(Boolean));
    const companies=(legacy.companies||[]).filter(c=>companyIds.has(String(c.id||'')));
    return {orders,messages,companies,marketClients:[cleanClone(client)]};
  }catch(error){console.warn('[V6.1.1] historique client différé',error?.message||error);return {orders:[],messages:[],companies:[],marketClients:[cleanClone(client)]};}
}
async function v611BackfillClientSlice(env,slice,clientId){
  await ensureDB(env);let inserted=0,relinked=0,stmts=[];
  const state=defaultState();state.companies=slice.companies||[];state.marketClients=slice.marketClients||[];
  const base=await v611InsertMissingFromLegacy(env,state,{scope:'client-core',mark:false});inserted+=Number(base.inserted||0);
  for(const order of slice.orders||[]){const existing=await env.GLOBAL_MARKET_D1.prepare('SELECT id,client_id FROM gm_orders WHERE id=?').bind(order.id).first();if(existing){if(String(existing.client_id||'')!==String(clientId)){stmts.push(env.GLOBAL_MARKET_D1.prepare('UPDATE gm_orders SET client_id=?,updated_at=? WHERE id=?').bind(clientId,v6Now(),order.id));relinked++;}}else{stmts.push(...await v6UpsertStatements(env,'orders',{...order,clientId}));inserted++;}if(stmts.length>=20){await runD1Batches(env.GLOBAL_MARKET_D1,stmts,20);stmts=[];}}
  for(const message of slice.messages||[]){const existing=await env.GLOBAL_MARKET_D1.prepare('SELECT id,client_id FROM gm_market_messages WHERE id=?').bind(message.id).first();if(existing){if(String(existing.client_id||'')!==String(clientId)){stmts.push(env.GLOBAL_MARKET_D1.prepare('UPDATE gm_market_messages SET client_id=?,updated_at=? WHERE id=?').bind(clientId,v6Now(),message.id));relinked++;}}else{stmts.push(...await v6UpsertStatements(env,'marketMessages',{...message,clientId}));inserted++;}if(stmts.length>=20){await runD1Batches(env.GLOBAL_MARKET_D1,stmts,20);stmts=[];}}
  if(stmts.length)await runD1Batches(env.GLOBAL_MARKET_D1,stmts,20);const result={inserted,relinked};await v611MarkClientHistory(env,clientId,result);return result;
}


/* ==========================================================================
   GLOBAL MARKET V6.1.2 — pont historique robuste des commandes client
   - ne fait plus confiance aux marqueurs V6.1.1 qui pouvaient être posés après
     une restauration vide/incomplète ;
   - retrouve une commande par clientId, téléphone ou e-mail ;
   - inspecte d'abord les tables relationnelles et les patches historiques,
     puis le snapshot V5 seulement si nécessaire ;
   - rattache durablement les commandes retrouvées au compte client courant.
   ========================================================================== */
const V612_CLIENT_RECOVERY_PREFIX='v612:client-orders-recovery:';
function v612ClientRecoveryKey(clientId){return `${V612_CLIENT_RECOVERY_PREFIX}${encodeURIComponent(String(clientId||''))}`;}
function v612PhoneDigits(value){return String(value||'').replace(/\D+/g,'');}
function v612PhonesEqual(a,b){
  const x=v612PhoneDigits(a),y=v612PhoneDigits(b);if(!x||!y)return false;if(x===y)return true;
  // Côte d'Ivoire / international : +225XXXXXXXXXX et 0XXXXXXXXX doivent se rattacher.
  if(x.length>=10&&y.length>=10)return x.slice(-10)===y.slice(-10);
  return false;
}
function v612OrderIdentity(order={}){
  const nested=order.client&&typeof order.client==='object'?order.client:{};
  return {
    clientId:String(order.clientId||order.client_id||nested.id||''),
    phones:[order.clientPhone,order.phone,order.contact,order.customerPhone,order.customer_phone,order.deliveryPhone,nested.phone].filter(Boolean),
    emails:[order.clientEmail,order.email,order.customerEmail,order.customer_email,nested.email].filter(Boolean)
  };
}
function v612OrderMatchesClient(order,client,aliases=new Set()){
  if(!order||!client)return false;const ident=v612OrderIdentity(order),cid=String(client.id||'');
  if(ident.clientId&&(ident.clientId===cid||aliases.has(ident.clientId)))return true;
  const phone=client.phone||'',email=normalizeIdentifier(client.email||'');
  if(phone&&ident.phones.some(v=>v612PhonesEqual(v,phone)))return true;
  if(email&&ident.emails.some(v=>normalizeIdentifier(v)===email))return true;
  return false;
}
function v612BuildAliases(clients,client){
  const aliases=new Set([String(client?.id||'')].filter(Boolean));
  for(const c of Array.isArray(clients)?clients:[]){
    if(!c?.id)continue;
    if(String(c.id)===String(client?.id||'')||v612PhonesEqual(c.phone,client?.phone)||(client?.email&&normalizeIdentifier(c.email)===normalizeIdentifier(client.email)))aliases.add(String(c.id));
  }
  return aliases;
}
function v612ClientDeletedOrderSet(state,aliases){
  const out=new Set();const map=state?.clientDeletedOrders&&typeof state.clientDeletedOrders==='object'?state.clientDeletedOrders:{};
  for(const id of aliases||[])for(const oid of Array.isArray(map[id])?map[id]:[])out.add(String(oid));
  return out;
}
function v612OrderExplicitlyDeleted(order,aliases,deletedSet){
  if(!order)return false;if(order.clientDeleted===true||v6Bool(order.clientDeleted)===1)return true;
  if(deletedSet?.has(String(order.id||'')))return true;
  const ids=Array.isArray(order.clientDeletedIds)?order.clientDeletedIds.map(String):[];
  return ids.some(id=>aliases?.has(id));
}
async function v612ReadRecoveryMarker(env,clientId){try{return await env.GLOBAL_MARKET_KV.get(v612ClientRecoveryKey(clientId),'json')}catch{return null}}
async function v612WriteRecoveryMarker(env,clientId,value){
  if(!clientId)return;const ttl=Number(value?.matched||0)>0?7*24*3600:15*60;
  try{await env.GLOBAL_MARKET_KV.put(v612ClientRecoveryKey(clientId),JSON.stringify({at:v6Now(),...(value||{})}),{expirationTtl:ttl})}catch{}
}
async function v612PatchClientSlice(env,client){
  const result={orders:[],messages:[],companies:[],marketClients:[],aliases:new Set([String(client.id)]),complete:false,source:'patches'};
  try{
    // Les fiches client sont petites et permettent de retrouver les anciens IDs du même compte.
    const cr=await env.GLOBAL_MARKET_D1.prepare("SELECT record_id,data FROM company_state_patches WHERE section='array:marketClients' AND deleted=0 ORDER BY updated_at DESC LIMIT 5000").all();
    for(const row of cr.results||[]){try{const c=JSON.parse(row.data||'{}');if(c?.id&&v612BuildAliases([c],client).has(String(c.id))){result.marketClients.push(c);result.aliases.add(String(c.id));}}catch{}}
    // Une ligne de patch = une commande : pas besoin de reconstruire tout l'état global.
    const or=await env.GLOBAL_MARKET_D1.prepare("SELECT company_id,record_id,data FROM company_state_patches WHERE section='array:orders' AND deleted=0 ORDER BY updated_at DESC LIMIT 5000").all();
    for(const row of or.results||[]){try{const o=JSON.parse(row.data||'{}');if(!o.id)o.id=row.record_id;if(!o.companyId)o.companyId=row.company_id;if(v612OrderMatchesClient(o,client,result.aliases))result.orders.push({...o,clientId:client.id});}catch{}}
    result.complete=true;return result;
  }catch(error){console.warn('[V6.1.2] lecture patches commandes différée',error?.message||error);return result;}
}
async function v612LegacyClientSlice(env,client){
  const empty={orders:[],messages:[],companies:[],marketClients:[cleanClone(client)],aliases:new Set([String(client.id)]),complete:false,source:'legacy'};
  try{
    let legacy=await readStateFallback(env,'*');
    // Le cache peut ne contenir que le catalogue. Si aucune identité/commande pertinente n'est trouvée,
    // on relit la source historique complète.
    let aliases=v612BuildAliases(legacy?.marketClients||[],client);
    let hasMatch=(legacy?.orders||[]).some(o=>v612OrderMatchesClient(o,client,aliases));
    if(!legacy||!hasMatch){legacy=await loadStateLegacy(env,'*');aliases=v612BuildAliases(legacy?.marketClients||[],client);}
    const deleted=v612ClientDeletedOrderSet(legacy,aliases);
    const orders=(legacy.orders||[]).filter(o=>v612OrderMatchesClient(o,client,aliases)&&!v612OrderExplicitlyDeleted(o,aliases,deleted)).map(o=>({...cleanClone(o),clientId:client.id}));
    const messages=(legacy.marketMessages||[]).filter(m=>aliases.has(String(m.clientId||''))||v612OrderMatchesClient(m,client,aliases)).map(m=>({...cleanClone(m),clientId:client.id}));
    const companyIds=new Set([...orders,...messages].map(x=>String(x.companyId||'')).filter(Boolean));
    const companies=(legacy.companies||[]).filter(c=>companyIds.has(String(c.id||'')));
    const marketClients=(legacy.marketClients||[]).filter(c=>aliases.has(String(c.id||'')));
    if(!marketClients.some(c=>String(c.id)===String(client.id)))marketClients.push(cleanClone(client));
    return {orders,messages,companies,marketClients,aliases,complete:true,source:'legacy-full'};
  }catch(error){console.warn('[V6.1.2] historique client complet différé',error?.message||error);return empty;}
}
async function v612RelationalIdentityOrders(env,client,aliases=new Set()){
  const out=[],toRelink=[];try{
    const db=env.GLOBAL_MARKET_D1;
    // Direct + anciens IDs connus.
    const ids=[...new Set([String(client.id),...aliases].filter(Boolean))];
    if(ids.length){const marks=ids.map(()=>'?').join(',');const r=await db.prepare(`SELECT * FROM gm_orders WHERE client_id IN (${marks}) AND deleted_by_client=0 ORDER BY order_date DESC LIMIT 1000`).bind(...ids).all();for(const row of r.results||[]){const o=v6OrderFromRow(row);if(o){out.push({...o,clientId:client.id});if(String(row.client_id)!==String(client.id))toRelink.push(String(row.id));}}}
    // Recherche d'identité dans le payload pour les migrations ayant changé l'ID client.
    // Cette lecture n'est exécutée que pendant la réparation V6.1.2, pas à chaque affichage normal.
    const r2=await db.prepare("SELECT * FROM gm_orders WHERE client_id<>? AND deleted_by_client=0 ORDER BY order_date DESC LIMIT 2500").bind(String(client.id)).all();
    for(const row of r2.results||[]){const o=v6OrderFromRow(row);if(o&&v612OrderMatchesClient(o,client,aliases)){out.push({...o,clientId:client.id});toRelink.push(String(row.id));}}
    if(toRelink.length){const unique=[...new Set(toRelink)],stmts=[];for(const id of unique)stmts.push(db.prepare('UPDATE gm_orders SET client_id=?,updated_at=? WHERE id=?').bind(String(client.id),v6Now(),id));await runD1Batches(db,stmts,20);}
    return {orders:v611MergeRows(out,[]),relinked:new Set(toRelink).size,complete:true};
  }catch(error){console.warn('[V6.1.2] rattachement relationnel commandes différé',error?.message||error);return {orders:out,relinked:0,complete:false};}
}
async function v612BackfillRecoveredClient(env,client,slices=[]){
  const merged={orders:[],messages:[],companies:[],marketClients:[cleanClone(client)]};
  for(const slice of slices){merged.orders=v611MergeRows(merged.orders,slice?.orders||[]);merged.messages=v611MergeRows(merged.messages,slice?.messages||[]);merged.companies=v611MergeRows(merged.companies,slice?.companies||[]);merged.marketClients=v611MergeRows(merged.marketClients,slice?.marketClients||[]);}
  if(!merged.orders.length&&!merged.messages.length)return {inserted:0,relinked:0};
  return v611BackfillClientSlice(env,merged,client.id);
}
async function v612LoadClientOrders(env,ctx,executionCtx,{force=false,limit=1000}={}){
  let direct=await v6ReadTable(ctx.db,'SELECT * FROM gm_orders WHERE client_id=? AND deleted_by_client=0 ORDER BY order_date DESC LIMIT ?',[ctx.client.id,limit],v6OrderFromRow);
  const marker=await v612ReadRecoveryMarker(env,ctx.client.id);let recovery={ran:false,complete:Boolean(marker?.complete),matched:Number(marker?.matched||0),relinked:0,sources:marker?.sources||[]};
  const markerAge=marker?.at?Math.max(0,Date.now()-Date.parse(marker.at)):Infinity;const shouldRecover=force||!marker||(marker?.complete===false&&markerAge>60000)||(Number(marker?.matched||0)>direct.length);
  if(shouldRecover){
    const patch=await v612PatchClientSlice(env,ctx.client);let aliases=new Set([String(ctx.client.id),...(patch.aliases||[])]);
    const relational=await v612RelationalIdentityOrders(env,ctx.client,aliases);let legacy={orders:[],messages:[],companies:[],marketClients:[],complete:false,source:'legacy-skipped'};
    // Toujours tenter la source complète à la première réparation de cette version, car les patches
    // ne couvrent pas nécessairement les très anciennes commandes.
    if(!marker||force||direct.length===0)legacy=await v612LegacyClientSlice(env,ctx.client);
    aliases=new Set([...aliases,...(legacy.aliases||[])]);
    // Une seconde passe relationnelle utilise les alias découverts dans le snapshot historique.
    const relational2=await v612RelationalIdentityOrders(env,ctx.client,aliases);
    const all=v611MergeRows(v611MergeRows(v611MergeRows(direct,relational.orders),patch.orders||[]),v611MergeRows(legacy.orders||[],relational2.orders||[]));
    direct=all.map(o=>({...o,clientId:ctx.client.id}));
    const task=v612BackfillRecoveredClient(env,ctx.client,[patch,legacy]).catch(e=>console.warn('[V6.1.2] backfill commandes client différé',e?.message||e));if(executionCtx?.waitUntil)executionCtx.waitUntil(task);else await task;
    recovery={ran:true,complete:Boolean(patch.complete&&legacy.complete&&relational.complete&&relational2.complete),matched:direct.length,relinked:Number(relational.relinked||0)+Number(relational2.relinked||0),sources:['d1-client-id','d1-identity','legacy-patches','legacy-snapshot']};
    await v612WriteRecoveryMarker(env,ctx.client.id,recovery);
  }
  direct=v611MergeRows(direct,[]).filter(o=>!o.clientDeleted).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return {orders:direct,recovery,authoritative:Boolean(direct.length||recovery.complete||marker?.complete)};
}


/* ==========================================================================
   GLOBAL MARKET V6.1.3 — restauration forensique des commandes client
   Cette passe ne dépend plus uniquement de l'état V5 reconstruit. Elle inspecte
   les sources historiques durables qui ont réellement pu recevoir une commande :
   D1 relationnel, patches, snapshots, anciens chunks/backups, caches client KV
   et file d'écriture différée KV. Elle n'est lancée automatiquement qu'une fois
   par client (ou à nouveau si l'historique relationnel est vide).
   ========================================================================== */
const V613_CLIENT_RECOVERY_PREFIX='v613:client-orders-forensic:';
function v613RecoveryKey(clientId){return `${V613_CLIENT_RECOVERY_PREFIX}${encodeURIComponent(String(clientId||''))}`;}
async function v613ReadMarker(env,clientId){try{return await env.GLOBAL_MARKET_KV.get(v613RecoveryKey(clientId),'json')}catch{return null}}
async function v613WriteMarker(env,clientId,value){try{await env.GLOBAL_MARKET_KV.put(v613RecoveryKey(clientId),JSON.stringify({at:v6Now(),version:'6.1.3',...(value||{})}),{expirationTtl:30*24*3600})}catch{}}
function v613LikeTerms(client,aliases){
  const out=new Set();
  for(const id of aliases||[])if(id)out.add(String(id));
  if(client?.id)out.add(String(client.id));
  if(client?.phone){out.add(String(client.phone));out.add(v612PhoneDigits(client.phone));}
  if(client?.email)out.add(normalizeIdentifier(client.email));
  return [...out].filter(x=>x&&x.length>=4).slice(0,20);
}
function v613MergeRecovered(target,source){return v611MergeRows(target||[],source||[]);}
function v613ExtractState(state,client,aliases){
  if(!state||typeof state!=='object')return {orders:[],aliases};
  const next=v612BuildAliases(state.marketClients||[],client);for(const x of aliases||[])next.add(String(x));
  const deleted=v612ClientDeletedOrderSet(state,next);
  const orders=(state.orders||[]).filter(o=>v612OrderMatchesClient(o,client,next)&&!v612OrderExplicitlyDeleted(o,next,deleted)).map(o=>({...cleanClone(o),clientId:client.id}));
  return {orders,aliases:next};
}
async function v613KvList(env,prefix,maxKeys=1500){
  const keys=[];let cursor=undefined,complete=false;
  for(let page=0;page<20&&keys.length<maxKeys;page++){
    const r=await env.GLOBAL_MARKET_KV.list({prefix,limit:Math.min(1000,maxKeys-keys.length),...(cursor?{cursor}:{})});
    for(const k of r.keys||[])keys.push(k.name);if(r.list_complete||!r.cursor){complete=true;break}cursor=r.cursor;
  }
  return {keys,complete};
}
async function v613DiscoverAliases(env,client,aliases){
  const out=new Set([String(client.id||''),...(aliases||[])]);const phone=String(client.phone||''),email=normalizeIdentifier(client.email||'');
  try{const idx=phone?await env.GLOBAL_MARKET_KV.get(globalClientIndexKey(normalizePhone(phone))):'';if(idx)out.add(String(idx));}catch{}
  try{
    const terms=[String(client.id||''),phone,email].filter(Boolean).slice(0,3);if(terms.length){const where=terms.map(()=>"data LIKE ?").join(' OR '),r=await env.GLOBAL_MARKET_D1.prepare(`SELECT record_id,data FROM company_state_patches WHERE section='array:marketClients' AND deleted=0 AND (${where}) ORDER BY updated_at DESC LIMIT 1000`).bind(...terms.map(x=>`%${x}%`)).all();for(const row of r.results||[]){try{const c=JSON.parse(row.data||'{}');if(c?.id&&(String(c.id)===String(client.id)||v612PhonesEqual(c.phone,phone)||(email&&normalizeIdentifier(c.email)===email)))out.add(String(c.id));}catch{}}}
  }catch(e){console.warn('[V6.1.3] alias patches différés',e?.message||e)}
  return out;
}
async function v613ScanOrderPatches(env,client,aliases){
  const terms=v613LikeTerms(client,aliases),orders=[];if(!terms.length)return {orders,complete:true};
  try{const where=terms.map(()=>"data LIKE ?").join(' OR '),r=await env.GLOBAL_MARKET_D1.prepare(`SELECT company_id,record_id,data FROM company_state_patches WHERE section='array:orders' AND deleted=0 AND (${where}) ORDER BY updated_at DESC LIMIT 10000`).bind(...terms.map(x=>`%${x}%`)).all();for(const row of r.results||[]){try{const o=JSON.parse(row.data||'{}');if(!o.id)o.id=row.record_id;if(!o.companyId)o.companyId=row.company_id;if(v612OrderMatchesClient(o,client,aliases)&&!v612OrderExplicitlyDeleted(o,aliases,new Set()))orders.push({...cleanClone(o),clientId:client.id});}catch{}}return {orders:v613MergeRecovered([],orders),complete:(r.results||[]).length<10000};}catch(e){console.warn('[V6.1.3] commandes patches différées',e?.message||e);return {orders,complete:false};}
}
async function v613ScanPendingOps(env,client,aliases){
  const orders=[];let complete=true;try{const listed=await v613KvList(env,PENDING_OPS_PREFIX,1500);complete=listed.complete;for(const key of listed.keys){let entry=null;try{entry=await env.GLOBAL_MARKET_KV.get(key,'json')}catch{}for(const op of entry?.operations||[]){if(op?.deleted||op?.section!=='array:orders')continue;const o=op.value&&typeof op.value==='object'?op.value:null;if(o&&v612OrderMatchesClient(o,client,aliases)&&!v612OrderExplicitlyDeleted(o,aliases,new Set()))orders.push({...cleanClone(o),clientId:client.id});}}}catch(e){console.warn('[V6.1.3] file KV différée',e?.message||e);complete=false}return {orders:v613MergeRecovered([],orders),complete};
}
async function v613ScanClientPayloadCaches(env,client,aliases,scanAll=false){
  let orders=[],complete=true;const seen=new Set();const consume=payload=>{if(!payload||typeof payload!=='object')return;const x=v613ExtractState(payload,client,aliases);for(const a of x.aliases)aliases.add(a);orders=v613MergeRecovered(orders,x.orders)};
  for(const id of aliases){const key=`${CLIENT_PAYLOAD_CACHE_PREFIX}${id}`;if(seen.has(key))continue;seen.add(key);try{consume(await env.GLOBAL_MARKET_KV.get(key,'json'))}catch{}}
  if(scanAll&&!orders.length){try{const listed=await v613KvList(env,CLIENT_PAYLOAD_CACHE_PREFIX,500);complete=listed.complete;for(const key of listed.keys){if(seen.has(key))continue;seen.add(key);let p=null;try{p=await env.GLOBAL_MARKET_KV.get(key,'json')}catch{}if(p){const candidates=p.marketClients||[];if(candidates.some(c=>String(c.id)===String(client.id)||v612PhonesEqual(c.phone,client.phone)||(client.email&&normalizeIdentifier(c.email)===normalizeIdentifier(client.email))))consume(p);else if((p.orders||[]).some(o=>v612OrderMatchesClient(o,client,aliases)))consume(p);}}}catch(e){console.warn('[V6.1.3] cache client KV différé',e?.message||e);complete=false}}
  return {orders,complete};
}
async function v613ScanBackups(env,client,aliases){
  let orders=[],complete=true;const terms=v613LikeTerms(client,aliases);if(!terms.length)return {orders,complete};
  try{const where=terms.map(()=>"data LIKE ?").join(' OR '),r=await env.GLOBAL_MARKET_D1.prepare(`SELECT id,company_id,data FROM backups WHERE ${where} ORDER BY id DESC LIMIT 40`).bind(...terms.map(x=>`%${x}%`)).all();for(const row of r.results||[]){const st=parseState(row.data||'');if(!st)continue;const x=v613ExtractState(st,client,aliases);for(const a of x.aliases)aliases.add(a);orders=v613MergeRecovered(orders,x.orders)}if((r.results||[]).length>=40)complete=false;}catch(e){console.warn('[V6.1.3] backups historiques différés',e?.message||e);complete=false}return {orders,complete};
}
async function v613ScanSnapshots(env,client,aliases){
  let orders=[],complete=true;const terms=v613LikeTerms(client,aliases);if(!terms.length)return {orders,complete};
  try{const where=terms.map(()=>"c.data LIKE ?").join(' OR '),r=await env.GLOBAL_MARKET_D1.prepare(`SELECT DISTINCT c.company_id FROM company_state_chunks c INNER JOIN company_state_meta m ON m.company_id=c.company_id AND m.revision=c.revision WHERE ${where} LIMIT 50`).bind(...terms.map(x=>`%${x}%`)).all();for(const row of r.results||[]){const snaps=await readCompanySnapshots(env,row.company_id);for(const snap of snaps){const x=v613ExtractState(snap.state,client,aliases);for(const a of x.aliases)aliases.add(a);orders=v613MergeRecovered(orders,x.orders)}}if((r.results||[]).length>=50)complete=false;}catch(e){console.warn('[V6.1.3] snapshots historiques différés',e?.message||e);complete=false}return {orders,complete};
}
async function v613ScanLegacyChunks(env,client,aliases){
  let orders=[],complete=true;const terms=v613LikeTerms(client,aliases);if(!terms.length)return {orders,complete};
  try{const where=terms.map(()=>"data LIKE ?").join(' OR '),r=await env.GLOBAL_MARKET_D1.prepare(`SELECT DISTINCT company_id FROM state_chunks WHERE ${where} LIMIT 50`).bind(...terms.map(x=>`%${x}%`)).all();for(const row of r.results||[]){const st=await readD1State(env,row.company_id);const x=v613ExtractState(st,client,aliases);for(const a of x.aliases)aliases.add(a);orders=v613MergeRecovered(orders,x.orders)}if((r.results||[]).length>=50)complete=false;}catch(e){console.warn('[V6.1.3] anciens chunks différés',e?.message||e);complete=false}return {orders,complete};
}
async function v613BackfillOrders(env,client,orders){
  let inserted=0,relinked=0,restored=0,stmts=[];for(const order of v613MergeRecovered([],orders)){
    if(!order?.id)continue;const existing=await env.GLOBAL_MARKET_D1.prepare('SELECT id,client_id,deleted_by_client FROM gm_orders WHERE id=?').bind(order.id).first();
    if(existing){if(String(existing.client_id||'')!==String(client.id)||Number(existing.deleted_by_client||0)!==0){stmts.push(env.GLOBAL_MARKET_D1.prepare('UPDATE gm_orders SET client_id=?,deleted_by_client=0,updated_at=? WHERE id=?').bind(client.id,v6Now(),order.id));if(String(existing.client_id||'')!==String(client.id))relinked++;if(Number(existing.deleted_by_client||0)!==0)restored++;}}
    else{stmts.push(...await v6UpsertStatements(env,'orders',{...order,clientId:client.id,clientDeleted:false}));inserted++;}
    if(stmts.length>=30){await runD1Batches(env.GLOBAL_MARKET_D1,stmts,30);stmts=[];}
  }if(stmts.length)await runD1Batches(env.GLOBAL_MARKET_D1,stmts,30);return {inserted,relinked,restored};
}
async function v613RecoverClientOrders(env,ctx,executionCtx,{force=false}={}){
  await ensureDB(env);let aliases=await v613DiscoverAliases(env,ctx.client,new Set([String(ctx.client.id)])),orders=[];const sources={},flags=[];
  const take=(name,result)=>{sources[name]=Number(result?.orders?.length||0);orders=v613MergeRecovered(orders,result?.orders||[]);if(result?.complete===false)flags.push(name)};
  // D1 relationnel par ID et par identité reste la source la plus rapide.
  const rel=await v612RelationalIdentityOrders(env,ctx.client,aliases);take('d1',{orders:rel.orders,complete:rel.complete});
  const patches=await v613ScanOrderPatches(env,ctx.client,aliases);take('patches',patches);
  const pending=await v613ScanPendingOps(env,ctx.client,aliases);take('pending-kv',pending);
  const clientCache=await v613ScanClientPayloadCaches(env,ctx.client,aliases,force||orders.length===0);take('client-cache-kv',clientCache);
  // Le cache d'état global V5 peut encore contenir l'historique exact vu par le client avant V6.
  try{const st=await readStateFallback(env,'*');const x=v613ExtractState(st,ctx.client,aliases);for(const a of x.aliases)aliases.add(a);take('state-cache-kv',{orders:x.orders,complete:true})}catch{flags.push('state-cache-kv')}
  // Si l'historique reste incomplet, inspecter les sources D1 historiques ciblées par identité.
  if(force||orders.length===0){take('backups',await v613ScanBackups(env,ctx.client,aliases));take('snapshots',await v613ScanSnapshots(env,ctx.client,aliases));take('legacy-chunks',await v613ScanLegacyChunks(env,ctx.client,aliases));}
  // Dernier filet : reconstruction V5 complète, uniquement si les recherches ciblées n'ont rien trouvé.
  if(force||orders.length===0){const legacy=await v612LegacyClientSlice(env,ctx.client);take('legacy-state',{orders:legacy.orders,complete:legacy.complete});for(const a of legacy.aliases||[])aliases.add(a);}
  orders=v613MergeRecovered([],orders).map(o=>({...o,clientId:ctx.client.id})).filter(o=>!o.clientDeleted).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const backfill=orders.length?await v613BackfillOrders(env,ctx.client,orders):{inserted:0,relinked:0,restored:0};
  const result={ran:true,complete:flags.length===0,matched:orders.length,aliases:aliases.size,sources,backfill,incompleteSources:flags};await v613WriteMarker(env,ctx.client.id,result);return {orders,result};
}
async function v613QuickRecoverClientOrders(env,ctx){
  let aliases=await v613DiscoverAliases(env,ctx.client,new Set([String(ctx.client.id)])),orders=[];const sources={},flags=[];
  const take=(name,result)=>{sources[name]=Number(result?.orders?.length||0);orders=v613MergeRecovered(orders,result?.orders||[]);if(result?.complete===false)flags.push(name)};
  const rel=await v612RelationalIdentityOrders(env,ctx.client,aliases);take('d1',{orders:rel.orders,complete:rel.complete});
  take('patches',await v613ScanOrderPatches(env,ctx.client,aliases));
  take('pending-kv',await v613ScanPendingOps(env,ctx.client,aliases));
  take('client-cache-kv',await v613ScanClientPayloadCaches(env,ctx.client,aliases,false));
  try{const st=await readStateFallback(env,'*');const x=v613ExtractState(st,ctx.client,aliases);for(const a of x.aliases)aliases.add(a);take('state-cache-kv',{orders:x.orders,complete:true})}catch{flags.push('state-cache-kv')}
  orders=v613MergeRecovered([],orders).map(o=>({...o,clientId:ctx.client.id})).filter(o=>!o.clientDeleted).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const backfill=orders.length?await v613BackfillOrders(env,ctx.client,orders):{inserted:0,relinked:0,restored:0};
  return {orders,result:{ran:true,quick:true,complete:false,matched:orders.length,aliases:aliases.size,sources,backfill,incompleteSources:flags,pending:orders.length===0}};
}
async function v613LoadClientOrders(env,ctx,executionCtx,{force=false,limit=1000}={}){
  let direct=await v6ReadTable(ctx.db,'SELECT * FROM gm_orders WHERE client_id=? AND deleted_by_client=0 ORDER BY order_date DESC LIMIT ?',[ctx.client.id,limit],v6OrderFromRow);const marker=await v613ReadMarker(env,ctx.client.id);
  const shouldRecover=force||direct.length===0||!marker||Number(marker.matched||0)>direct.length;
  let recovery={ran:false,complete:Boolean(marker?.complete),matched:Number(marker?.matched||direct.length),sources:marker?.sources||{},backfill:marker?.backfill||{},pending:false};
  if(shouldRecover){
    if(force){const r=await v613RecoverClientOrders(env,ctx,executionCtx,{force:true});direct=v613MergeRecovered(direct,r.orders);recovery=r.result;}
    else{
      const q=await v613QuickRecoverClientOrders(env,ctx);direct=v613MergeRecovered(direct,q.orders);recovery=q.result;
      if(!direct.length){
        const task=v613RecoverClientOrders(env,ctx,executionCtx,{force:false}).catch(e=>{console.warn('[V6.1.3] restauration forensique différée',e?.message||e);return null});
        if(executionCtx?.waitUntil){executionCtx.waitUntil(task);recovery={...recovery,pending:true,complete:false};}
        else{const r=await task;if(r){direct=v613MergeRecovered(direct,r.orders);recovery=r.result;}}
      }else await v613WriteMarker(env,ctx.client.id,{...recovery,complete:false,pending:false});
    }
  }
  direct=v613MergeRecovered([],direct).filter(o=>!o.clientDeleted).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return {orders:direct,recovery,authoritative:Boolean(direct.length||recovery.complete)};
}

async function v610GetEmployeeSessionLight(request,env,requireCsrf=false){
  const sid=getCookie(request,EMPLOYEE_SESSION_COOKIE);if(!sid)throw new HttpError(401,'Connexion requise.','UNAUTHENTICATED');const session=await env.GLOBAL_MARKET_KV.get(`session:${sid}`,'json');if(!session||Number(session.expiresAt||0)<=Date.now()){if(sid)await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);throw new HttpError(401,'Session expirée. Reconnectez-vous.','SESSION_EXPIRED');}
  if(requireCsrf){assertSameOrigin(request);const csrf=request.headers.get('X-CSRF-Token')||'';if(!csrf||!constantTimeEqual(csrf,session.csrfToken))throw new HttpError(403,'Jeton de sécurité invalide.','CSRF_REJECTED');}
  const db=v6ReadDb(request,env,true);let user=await v6FindUser(db,session.userId);if(!user){const auth0=await getAuth(env,session.userId);const legacy=await v610FindLegacyUserFast(env,session.userId,normalizeIdentifier(auth0?.identifier));if(legacy.user){const st=[];if(legacy.company)st.push(...await v6UpsertStatements(env,'companies',legacy.company));st.push(...await v6UpsertStatements(env,'users',legacy.user));if(st.length)await runD1Batches(env.GLOBAL_MARKET_D1,st,20);user=legacy.user;}}
  const auth=user?await getAuth(env,user.id):null;if(!user||user.status!=='active'||!auth||Number(auth.version)!==Number(session.authVersion))throw new HttpError(401,'Session invalidée. Reconnectez-vous.','SESSION_INVALIDATED');return {sid,session,user,auth,db};
}
async function v6PrepareRecordMedia(env,key,row){
  const copy=cleanClone(row);
  if(key==='items' && copy.photo) copy.photo=await v6ExternalizeMedia(env,'items',copy.id,'photo',copy.photo);
  if(key==='companies') {
    for(const field of ['logo','shopLogo','shopBannerImage']) if(copy[field]) copy[field]=await v6ExternalizeMedia(env,'companies',copy.id,field,copy[field]);
  }
  return copy;
}

async function v6UpsertStatements(env,key,source){
  const row=await v6PrepareRecordMedia(env,key,source); const now=v6Now(); const created=v6Created(row), updated=v6Updated(row); const raw=JSON.stringify(row);
  switch(key){
    case 'companies': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_companies(id,name,email,phone,status,plan_code,subscription_end,shop_slug,business_type,city,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,status=excluded.status,plan_code=excluded.plan_code,subscription_end=excluded.subscription_end,shop_slug=excluded.shop_slug,business_type=excluded.business_type,city=excluded.city,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.name||''),normalizeIdentifier(row.email),String(row.phone||''),String(row.status||row.planCode||'FREE'),String(row.planCode||''),String(row.subscriptionEnd||''),String(row.shopSlug||''),String(row.businessType||''),String(row.city||row.address||''),created,updated,raw)];
    case 'users': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_users(id,company_id,name,email,role,status,main_admin,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,name=excluded.name,email=excluded.email,role=excluded.role,status=excluded.status,main_admin=excluded.main_admin,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,row.companyId||null,String(row.name||''),normalizeIdentifier(row.email||row.username),String(row.role||'caisse'),String(row.status||'active'),v6Bool(row.mainAdmin),created,updated,raw)];
    case 'items': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_items(id,company_id,code,name,category,item_type,sell,stock,stock_type,marketplace_hidden,search_text,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,code=excluded.code,name=excluded.name,category=excluded.category,item_type=excluded.item_type,sell=excluded.sell,stock=excluded.stock,stock_type=excluded.stock_type,marketplace_hidden=excluded.marketplace_hidden,search_text=excluded.search_text,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.companyId||''),String(row.code||''),String(row.name||''),String(row.cat||row.category||''),String(row.type||''),Number(row.sell||0),Number(row.stock||0),String(row.stockType||''),v6Bool(row.marketplaceHidden),v6SearchText(row),created,updated,raw)];
    case 'sales': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_sales(id,company_id,client_id,sale_date,total,status,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,client_id=excluded.client_id,sale_date=excluded.sale_date,total=excluded.total,status=excluded.status,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.companyId||''),String(row.clientId||''),String(row.date||created),Number(row.total||0),String(row.status||row.saleStatus||''),created,updated,raw)];
    case 'payments': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_payments(id,company_id,order_id,client_id,method,status,amount,currency,transaction_id,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,order_id=excluded.order_id,client_id=excluded.client_id,method=excluded.method,status=excluded.status,amount=excluded.amount,currency=excluded.currency,transaction_id=excluded.transaction_id,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.companyId||''),String(row.orderId||''),String(row.clientId||''),String(row.method||row.paymentMethod||''),String(row.status||row.paymentStatus||''),Number(row.amount||row.total||0),String(row.currency||row.paymentCurrency||'FCFA'),String(row.transactionId||row.paymentRef||''),created,updated,raw)];
    case 'orders': {
      const stmts=[env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_orders(id,checkout_id,company_id,client_id,order_date,subtotal,delivery_fee,total,delivery_city,delivery_neighborhood,shipping_method,payment_method,payment_status,validation_status,delivery_status,deleted_by_client,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET checkout_id=excluded.checkout_id,company_id=excluded.company_id,client_id=excluded.client_id,order_date=excluded.order_date,subtotal=excluded.subtotal,delivery_fee=excluded.delivery_fee,total=excluded.total,delivery_city=excluded.delivery_city,delivery_neighborhood=excluded.delivery_neighborhood,shipping_method=excluded.shipping_method,payment_method=excluded.payment_method,payment_status=excluded.payment_status,validation_status=excluded.validation_status,delivery_status=excluded.delivery_status,deleted_by_client=excluded.deleted_by_client,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.checkoutId||''),String(row.companyId||''),String(row.clientId||''),String(row.date||created),Number(row.subtotal||0),Number(row.deliveryFee||0),Number(row.total||0),String(row.deliveryCity||''),String(row.deliveryNeighborhood||''),String(row.shippingMethod||''),String(row.paymentMethod||''),String(row.paymentStatus||''),String(row.validationStatus||''),String(row.deliveryStatus||row.delivery||''),v6Bool(row.clientDeleted),created,updated,raw), env.GLOBAL_MARKET_D1.prepare('DELETE FROM gm_order_items WHERE order_id=?').bind(row.id)];
      for(const line of Array.isArray(row.items)?row.items:[]) stmts.push(env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_order_items(order_id,item_id,item_name,category,item_type,qty,unit,total) VALUES(?,?,?,?,?,?,?,?)`).bind(row.id,String(line.itemId||''),String(line.item||line.name||''),String(line.category||line.cat||''),String(line.type||''),Number(line.qty||0),Number(line.unit||0),Number(line.total||0)));
      return stmts;
    }
    case 'clients': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_clients(id,company_id,name,phone,email,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,name=excluded.name,phone=excluded.phone,email=excluded.email,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.companyId||''),String(row.name||''),String(row.phone||''),normalizeIdentifier(row.email),created,updated,raw)];
    case 'marketClients': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_market_clients(id,name,phone,email,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,email=excluded.email,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.name||''),normalizePhone(row.phone),normalizeIdentifier(row.email),created,updated,raw)];
    case 'marketMessages': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_market_messages(id,company_id,client_id,sender_type,sender_name,body,admin_deleted,client_deleted,read_by_admin,read_by_client,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,client_id=excluded.client_id,sender_type=excluded.sender_type,sender_name=excluded.sender_name,body=excluded.body,admin_deleted=excluded.admin_deleted,client_deleted=excluded.client_deleted,read_by_admin=excluded.read_by_admin,read_by_client=excluded.read_by_client,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.companyId||''),String(row.clientId||''),String(row.senderType||'client'),String(row.senderName||''),String(row.body||row.message||''),v6Bool(row.adminDeleted),v6Bool(row.clientDeleted),v6Bool(row.readByAdmin),v6Bool(row.readByClient),created,updated,raw)];
    case 'passwordResetRequests': return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_password_reset_requests(id,company_id,user_id,role,status,created_at,updated_at,payload_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,user_id=excluded.user_id,role=excluded.role,status=excluded.status,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.companyId||''),String(row.userId||''),String(row.role||''),String(row.status||'pending'),created,updated,raw)];
    case 'stockEntries': case 'stockOutputs': case 'stockMovements': case 'caisseLogs': {
      const table={stockEntries:'gm_stock_entries',stockOutputs:'gm_stock_outputs',stockMovements:'gm_stock_movements',caisseLogs:'gm_caisse_logs'}[key];
      return [env.GLOBAL_MARKET_D1.prepare(`INSERT INTO ${table}(id,company_id,created_at,updated_at,payload_json) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,updated_at=excluded.updated_at,payload_json=excluded.payload_json`).bind(row.id,String(row.companyId||''),created,updated,raw)];
    }
    default: return [];
  }
}
function v6DeleteStatements(env,key,id){
  const table={companies:'gm_companies',users:'gm_users',items:'gm_items',sales:'gm_sales',payments:'gm_payments',orders:'gm_orders',clients:'gm_clients',marketClients:'gm_market_clients',marketMessages:'gm_market_messages',passwordResetRequests:'gm_password_reset_requests',stockEntries:'gm_stock_entries',stockOutputs:'gm_stock_outputs',stockMovements:'gm_stock_movements',caisseLogs:'gm_caisse_logs'}[key];
  if(!table)return[]; const stmts=[]; if(key==='orders')stmts.push(env.GLOBAL_MARKET_D1.prepare('DELETE FROM gm_order_items WHERE order_id=?').bind(id)); stmts.push(env.GLOBAL_MARKET_D1.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id)); return stmts;
}
async function v6PersistStateDelta(env,delta,actor){
  await ensureDB(env); const role=actor?.role||'caisse', actorCompanyId=String(actor?.companyId||''); const isSuper=role==='superadmin', isAdmin=isSuper||role==='admin'||role==='system';
  const allowed=allowedDeltaArrayKeys(role); const statements=[]; const realtime=[];
  for(const [key,changes] of Object.entries(delta?.arrays||{})){
    if(!allowed.has(key))continue;
    for(const source0 of Array.isArray(changes?.upserts)?changes.upserts:[]){
      if(!source0?.id)continue; const source=cleanClone(source0);
      if(!isSuper && key!=='marketClients' && key!=='passwordResetRequests' && key!=='companies') source.companyId=actorCompanyId;
      if(key==='companies'&&!isAdmin)continue;
      statements.push(...await v6UpsertStatements(env,key,source));
      if(key==='orders'){ realtime.push({room:`company:${source.companyId}`,event:{type:'order',action:'updated',order:source}}); if(source.clientId)realtime.push({room:`client:${source.clientId}`,event:{type:'order',action:'updated',order:source}}); }
      if(key==='marketMessages'){ const room=source.senderType==='admin'?`client:${source.clientId}`:`company:${source.companyId}`; realtime.push({room,event:{type:'message',action:'new',message:source}}); }
    }
    for(const deletion of Array.isArray(changes?.deletes)?changes.deletes:[]){ const id=String(deletion?.id||''); if(id) statements.push(...v6DeleteStatements(env,key,id)); }
  }
  if(isAdmin){
    for(const [key,changes] of Object.entries(delta?.objects||{})){
      for(const source of Array.isArray(changes?.upserts)?changes.upserts:[]){ const companyId=isSuper?String(source?.companyId||source?.recordId||''):actorCompanyId; if(!companyId||!source?.recordId)continue; statements.push(env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_company_settings(company_id,section,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(company_id,section) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(companyId,key,JSON.stringify(source.value??null),v6Now())); }
      for(const deletion of Array.isArray(changes?.deletes)?changes.deletes:[]){ const companyId=isSuper?String(deletion?.companyId||deletion?.recordId||''):actorCompanyId; if(companyId)statements.push(env.GLOBAL_MARKET_D1.prepare('DELETE FROM gm_company_settings WHERE company_id=? AND section=?').bind(companyId,key)); }
    }
  }
  if(statements.length) await runD1Batches(env.GLOBAL_MARKET_D1,statements,30);
  await Promise.allSettled(realtime.map(x=>v6RealtimePublish(env,x.room,x.event)));
  return {storage:'d1-relational-v6',patchCount:statements.length};
}

async function v6ReadTable(db,sql,bindings=[],mapper=v6GenericFromRow){ const res=await db.prepare(sql).bind(...bindings).all(); return (res.results||[]).map(mapper).filter(Boolean); }
async function v6LoadState(env,companyId='*',request=null){
  await ensureDB(env); const db=v6ReadDb(request,env,false); const state=defaultState(); state.app={name:APP_NAME,storageVersion:6,architecture:'D1 relational + targeted APIs + WebSocket'};
  if(companyId==='*'){
    const [companies,users,marketClients,resets,saleStats,paymentStats]=await Promise.all([
      v6ReadTable(db,'SELECT * FROM gm_companies ORDER BY created_at DESC',[],v6CompanyFromRow),
      v6ReadTable(db,'SELECT * FROM gm_users ORDER BY created_at DESC',[],v6UserFromRow),
      v6ReadTable(db,'SELECT * FROM gm_market_clients ORDER BY created_at DESC LIMIT 5000',[],v6MarketClientFromRow),
      v6ReadTable(db,'SELECT * FROM gm_password_reset_requests ORDER BY created_at DESC LIMIT 1000',[],v6GenericFromRow),
      db.prepare(`SELECT company_id,COUNT(*) sale_count,COALESCE(SUM(total),0) sale_total FROM gm_sales GROUP BY company_id`).all(),
      db.prepare(`SELECT company_id,COUNT(*) payment_count,COALESCE(SUM(amount),0) payment_total FROM gm_payments GROUP BY company_id`).all()
    ]);
    const sm=new Map((saleStats.results||[]).map(x=>[x.company_id,x])),pm=new Map((paymentStats.results||[]).map(x=>[x.company_id,x]));for(const c of companies){const s=sm.get(c.id)||{},p=pm.get(c.id)||{};c.v6Stats={salesCount:Number(s.sale_count||0),salesTotal:Number(s.sale_total||0),paymentCount:Number(p.payment_count||0),paymentTotal:Number(p.payment_total||0)};}
    state.companies=companies; state.users=users; state.marketClients=marketClients; state.passwordResetRequests=resets; return normalizeState(state);
  }
  const cid=String(companyId||'');
  const queries=await Promise.all([
    v6ReadTable(db,'SELECT * FROM gm_companies WHERE id=?',[cid],v6CompanyFromRow),
    v6ReadTable(db,'SELECT * FROM gm_users WHERE company_id=? ORDER BY created_at',[cid],v6UserFromRow),
    v6ReadTable(db,'SELECT * FROM gm_items WHERE company_id=? ORDER BY updated_at DESC',[cid],v6ItemFromRow),
    v6ReadTable(db,'SELECT * FROM gm_sales WHERE company_id=? ORDER BY sale_date DESC LIMIT 10000',[cid],v6GenericFromRow),
    v6ReadTable(db,'SELECT * FROM gm_orders WHERE company_id=? ORDER BY order_date DESC LIMIT 5000',[cid],v6OrderFromRow),
    v6ReadTable(db,'SELECT * FROM gm_clients WHERE company_id=? ORDER BY created_at DESC LIMIT 5000',[cid],v6ClientFromRow),
    v6ReadTable(db,'SELECT * FROM gm_market_messages WHERE company_id=? AND admin_deleted=0 ORDER BY created_at DESC LIMIT 5000',[cid],v6MessageFromRow),
    v6ReadTable(db,'SELECT * FROM gm_stock_entries WHERE company_id=? ORDER BY created_at DESC LIMIT 5000',[cid],v6GenericFromRow),
    v6ReadTable(db,'SELECT * FROM gm_stock_outputs WHERE company_id=? ORDER BY created_at DESC LIMIT 5000',[cid],v6GenericFromRow),
    v6ReadTable(db,'SELECT * FROM gm_stock_movements WHERE company_id=? ORDER BY created_at DESC LIMIT 10000',[cid],v6GenericFromRow),
    v6ReadTable(db,'SELECT * FROM gm_caisse_logs WHERE company_id=? ORDER BY created_at DESC LIMIT 10000',[cid],v6GenericFromRow),
    v6ReadTable(db,'SELECT * FROM gm_password_reset_requests WHERE company_id=? ORDER BY created_at DESC LIMIT 1000',[cid],v6GenericFromRow),
    v6ReadTable(db,'SELECT * FROM gm_payments WHERE company_id=? ORDER BY created_at DESC LIMIT 5000',[cid],v6GenericFromRow),
    v6ReadTable(db,`SELECT * FROM gm_market_clients WHERE id IN (SELECT client_id FROM gm_orders WHERE company_id=? UNION SELECT client_id FROM gm_market_messages WHERE company_id=?)`,[cid,cid],v6MarketClientFromRow),
    v6ReadTable(db,'SELECT * FROM gm_company_settings WHERE company_id=?',[cid],r=>r)
  ]);
  [state.companies,state.users,state.items,state.sales,state.orders,state.clients,state.marketMessages,state.stockEntries,state.stockOutputs,state.stockMovements,state.caisseLogs,state.passwordResetRequests,state.payments,state.marketClients]=queries;
  for(const row of queries[14]||[]){ const val=v6JsonParse(row.payload_json,null); if(['categories','monthlyObligations','obligations','cartClearedAt','cartValidatedAt','clientDeletedOrders'].includes(row.section)) state[row.section]={[cid]:val}; else state[row.section]={[cid]:val}; }
  return normalizeState(state);
}
async function loadState(env,companyId='*'){ if(await v6IsReady(env)) return v6LoadState(env,companyId); return loadStateLegacy(env,companyId); }
async function persistStateDelta(env,delta,actor){ if(await v6IsReady(env)) return v6PersistStateDelta(env,delta,actor); return persistStateDeltaLegacy(env,delta,actor); }


async function v6DeleteCompanyCascade(env,companyId){
  const cid=String(companyId||''); if(!cid)return;
  const orderRows=await env.GLOBAL_MARKET_D1.prepare('SELECT id FROM gm_orders WHERE company_id=?').bind(cid).all();
  const orderIds=(orderRows.results||[]).map(r=>r.id); const stmts=[];
  for(const id of orderIds)stmts.push(env.GLOBAL_MARKET_D1.prepare('DELETE FROM gm_order_items WHERE order_id=?').bind(id));
  for(const table of ['gm_orders','gm_payments','gm_sales','gm_clients','gm_market_messages','gm_stock_entries','gm_stock_outputs','gm_stock_movements','gm_caisse_logs','gm_items','gm_password_reset_requests','gm_users','gm_company_settings']){
    stmts.push(env.GLOBAL_MARKET_D1.prepare(`DELETE FROM ${table} WHERE company_id=?`).bind(cid));
  }
  stmts.push(env.GLOBAL_MARKET_D1.prepare('DELETE FROM gm_companies WHERE id=?').bind(cid));
  if(stmts.length)await runD1Batches(env.GLOBAL_MARKET_D1,stmts,30);
}

async function v6MigrateLegacy(env){
  await ensureDB(env); const existing=await v6MetaGet(env,V6_MIGRATION_META_KEY); if(existing===V6_SCHEMA_VERSION){const recovery=await v604RecoverLegacyCatalogIfNeeded(env);return {already:true,recovery};}
  await v6MetaSet(env,'migration_status','running');
  const legacy=await loadStateLegacy(env,'*');
  const ordered=['companies','users','marketClients','clients','items','sales','orders','payments','marketMessages','passwordResetRequests','stockEntries','stockOutputs','stockMovements','caisseLogs'];
  let rows=0, statements=0;
  for(const key of ordered){
    const source=Array.isArray(legacy[key])?legacy[key]:[]; let buffer=[];
    for(const row of source){ const st=await v6UpsertStatements(env,key,row); buffer.push(...st); rows++; if(buffer.length>=30){await runD1Batches(env.GLOBAL_MARKET_D1,buffer,30);statements+=buffer.length;buffer=[];} }
    if(buffer.length){await runD1Batches(env.GLOBAL_MARKET_D1,buffer,30);statements+=buffer.length;}
  }
  for(const section of [...COMPANY_OBJECT_KEYS,'clientDeletedOrders']){
    const obj=legacy[section]&&typeof legacy[section]==='object'?legacy[section]:{}; const st=[];
    for(const [companyId,value] of Object.entries(obj)){ st.push(env.GLOBAL_MARKET_D1.prepare(`INSERT INTO gm_company_settings(company_id,section,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(company_id,section) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at`).bind(companyId,section,JSON.stringify(value??null),v6Now())); }
    if(st.length){await runD1Batches(env.GLOBAL_MARKET_D1,st,30);statements+=st.length;}
  }
  await v6MetaSet(env,V6_MIGRATION_META_KEY,V6_SCHEMA_VERSION); await v6MetaSet(env,'migration_status','done'); await v6MetaSet(env,'migration_completed_at',v6Now());
  return {already:false,rows,statements,version:V6_SCHEMA_VERSION};
}
function v6AuthorizeMigration(request,env){ const provided=String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')||String(request.headers.get('X-Migration-Key')||''); const expected=String(env.V6_MIGRATION_KEY||''); if(!expected||!constantTimeEqual(provided,expected))throw new HttpError(403,'Clé de migration V6 invalide ou absente.','V6_MIGRATION_FORBIDDEN'); }

async function v6FindUser(db,idOrEmail){ const value=String(idOrEmail||''); let row=await db.prepare('SELECT * FROM gm_users WHERE id=? LIMIT 1').bind(value).first(); if(!row)row=await db.prepare('SELECT * FROM gm_users WHERE lower(email)=? LIMIT 1').bind(normalizeIdentifier(value)).first(); return v6UserFromRow(row); }
async function v6FindClientByPhone(db,phone){ return v6MarketClientFromRow(await db.prepare('SELECT * FROM gm_market_clients WHERE phone=? LIMIT 1').bind(normalizePhone(phone)).first()); }
async function v6GetEmployeeSession(request,env,requireCsrf=false){
  const sid=getCookie(request,EMPLOYEE_SESSION_COOKIE); if(!sid)throw new HttpError(401,'Connexion requise.','UNAUTHENTICATED'); const session=await env.GLOBAL_MARKET_KV.get(`session:${sid}`,'json');
  if(!session||Number(session.expiresAt||0)<=Date.now()){if(sid)await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);throw new HttpError(401,'Session expirée. Reconnectez-vous.','SESSION_EXPIRED');}
  if(requireCsrf){assertSameOrigin(request);const csrf=request.headers.get('X-CSRF-Token')||'';if(!csrf||!constantTimeEqual(csrf,session.csrfToken))throw new HttpError(403,'Jeton de sécurité invalide.','CSRF_REJECTED');}
  const db=v6ReadDb(request,env,true), user=await v6FindUser(db,session.userId), auth=user?await getAuth(env,user.id):null; if(!user||user.status!=='active'||!auth||Number(auth.version)!==Number(session.authVersion))throw new HttpError(401,'Session invalidée. Reconnectez-vous.','SESSION_INVALIDATED');
  const state=await v6LoadState(env,user.role==='superadmin'?'*':user.companyId,request); return {sid,session,user,auth,state,db};
}
async function v6GetClientSession(request,env,requireCsrf=false){
  const sid=getCookie(request,CLIENT_SESSION_COOKIE); if(!sid)throw new HttpError(401,'Connexion client requise.','CLIENT_UNAUTHENTICATED'); const session=await env.GLOBAL_MARKET_KV.get(`client-session:${sid}`,'json');
  if(!session||Number(session.expiresAt||0)<=Date.now())throw new HttpError(401,'Session client expirée.','CLIENT_SESSION_EXPIRED');
  if(requireCsrf){assertSameOrigin(request);const csrf=request.headers.get('X-CSRF-Token')||'';if(!csrf||!constantTimeEqual(csrf,session.csrfToken))throw new HttpError(403,'Jeton de sécurité client invalide.','CSRF_REJECTED');}
  const db=v6ReadDb(request,env,true); const client=v6MarketClientFromRow(await db.prepare('SELECT * FROM gm_market_clients WHERE id=?').bind(session.clientId).first()); const auth=client?await getClientAuth(env,client.id):null; if(!client||!auth||Number(auth.version)!==Number(session.authVersion))throw new HttpError(401,'Session client invalidée.','CLIENT_SESSION_INVALIDATED'); return {sid,session,client,auth,db};
}

async function handleV6Login(request,env){
  assertSameOrigin(request);await ensureDB(env);const body=await readJson(request,20000),identifier=normalizeIdentifier(body.identifier||body.email),password=String(body.password||''),requestedRole=String(body.role||'');if(!identifier||!password)throw new HttpError(400,'Identifiant et mot de passe obligatoires.','MISSING_CREDENTIALS');
  const rate=await assertLoginRateAllowed(env,requestIp(request),identifier),db=v6ReadDb(request,env,true);let indexedId=await env.GLOBAL_MARKET_KV.get(authIndexKey(identifier)),user=await v6FindUser(db,indexedId||identifier);
  if(!user&&identifier!==configuredSuperAdminIdentifier(env)){const legacy=await v610FindLegacyUserFast(env,indexedId,identifier);if(legacy.user){const st=[];if(legacy.company)st.push(...await v6UpsertStatements(env,'companies',legacy.company));st.push(...await v6UpsertStatements(env,'users',legacy.user));if(st.length)await runD1Batches(env.GLOBAL_MARKET_D1,st,20);user=legacy.user;indexedId=user.id;}}
  if(identifier===configuredSuperAdminIdentifier(env)){if(!user){const p={...SUPER_ADMIN_PROFILE,email:identifier};await runD1Batches(env.GLOBAL_MARKET_D1,await v6UpsertStatements(env,'users',p),20);user=p;}await ensureSuperAdminCredential(env,{users:[user]});}
  const auth=user?await getAuth(env,user.id):null,valid=user&&user.status==='active'&&await verifyCredential(auth,password);if(!valid){await recordLoginFailure(env,rate);throw new HttpError(401,'Identifiant ou mot de passe incorrect.','INVALID_CREDENTIALS');}
  if(requestedRole==='caisse'&&user.role!=='caisse')throw new HttpError(403,'Profil incorrect : sélectionnez Administrateur.','ROLE_MISMATCH');if(requestedRole==='admin'&&!['admin','superadmin'].includes(user.role))throw new HttpError(403,'Profil incorrect : sélectionnez La Caisse.','ROLE_MISMATCH');
  if(user.companyId){const cr=await db.prepare(`SELECT id,name,email,phone,status,plan_code,subscription_end,shop_slug,business_type,city,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.address'),city,'') ELSE COALESCE(city,'') END address,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.activity'),'') ELSE '' END activity,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.shopBanner'),'') ELSE '' END shop_banner,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.shopColor'),'') ELSE '' END shop_color,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.marketWaveBusinessLink'),'') ELSE '' END wave_link,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.marketUsdtTrc20'),'') ELSE '' END usdt_trc20,CASE WHEN json_valid(payload_json) THEN COALESCE(json_extract(payload_json,'$.marketDeliveryConfig'),'{}') ELSE '{}' END market_delivery_config FROM gm_companies WHERE id=?`).bind(user.companyId).first();const company=cr?v610PublicCompanyFromRow(cr):null;const status=companyStatus(company);if(['expired','blocked','suspended'].includes(status))throw new HttpError(403,`Accès entreprise ${status}.`,'COMPANY_ACCESS_BLOCKED');}
  await clearLoginRate(env,rate);const created=await createEmployeeSession(env,user,auth),data=await v610MinimalEmployeeData(db,user);return v6AttachBookmark(json({success:true,session:publicSessionView(created.session),mustChangePassword:Boolean(auth.mustChangePassword),data,progressiveLoad:true},{headers:{'Set-Cookie':setCookie(EMPLOYEE_SESSION_COOKIE,created.sid,created.ttl)}}),db);
}
async function handleV6RegisterCompany(request,env){
  assertSameOrigin(request);const body=await readJson(request,100000),name=String(body.name||'').trim(),email=normalizeIdentifier(body.email),password=validatePassword(body.password,'admin');if(!name||!email)throw new HttpError(400,'Raison sociale et e-mail obligatoires.','MISSING_FIELDS');const db=v6ReadDb(request,env,true);if(await db.prepare('SELECT id FROM gm_users WHERE email=? LIMIT 1').bind(email).first())throw new HttpError(409,'Cet e-mail est déjà utilisé.','EMAIL_EXISTS');
  const cid=`ent_${crypto.randomUUID()}`,uid=`usr_${crypto.randomUUID()}`,now=new Date(),end=new Date(now.getTime()+21*86400000).toISOString().slice(0,10),slug=String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||cid;
  const company={id:cid,name,legalForm:String(body.legalForm||''),rccm:String(body.rccm||''),taxAccount:String(body.taxAccount||''),activity:String(body.activity||''),owner:String(body.owner||''),address:String(body.address||''),phone:String(body.phone||''),email,businessType:String(body.businessType||'boutique'),status:'FREE',planCode:'FREE',plan:'Plan Free — 21 jours',subscriptionStart:now.toISOString().slice(0,10),subscriptionEnd:end,createdAt:now.toISOString(),notes:'',shopSlug:slug,shopBanner:'Boutique officielle',shopColor:'#024644'};
  const user={id:uid,companyId:cid,name:company.owner||'Administrateur principal',email,role:'admin',status:'active',createdAt:now.toISOString(),mainAdmin:true};const stmts=[...await v6UpsertStatements(env,'companies',company),...await v6UpsertStatements(env,'users',user)];await env.GLOBAL_MARKET_D1.batch(stmts);await writeUserCredential(env,user,password);const auth=await getAuth(env,user.id),created=await createEmployeeSession(env,user,auth);return v6AttachBookmark(json({success:true,session:publicSessionView(created.session),data:await v6LoadState(env,cid,request)},{status:201,headers:{'Set-Cookie':setCookie(EMPLOYEE_SESSION_COOKIE,created.sid,created.ttl)}}),db);
}
async function handleV6ClientRegister(request,env){assertSameOrigin(request);const body=await readJson(request,50000),name=String(body.name||'').trim(),phone=normalizePhone(body.phone),email=normalizeIdentifier(body.email),password=validatePassword(body.password,'client');if(!name||!phone)throw new HttpError(400,'Nom et téléphone obligatoires.','MISSING_FIELDS');const db=v6ReadDb(request,env,true);if(await db.prepare('SELECT id FROM gm_market_clients WHERE phone=?').bind(phone).first())throw new HttpError(409,'Ce téléphone possède déjà un compte client GLOBAL MARKET.','PHONE_EXISTS');const client={id:`clt_${crypto.randomUUID()}`,companyId:GLOBAL_CLIENT_SCOPE,scope:'global',name,phone,email,createdAt:v6Now()};await env.GLOBAL_MARKET_D1.batch(await v6UpsertStatements(env,'marketClients',client));await writeClientCredential(env,client,password);await env.GLOBAL_MARKET_KV.put(globalClientIndexKey(phone),client.id);const created=await createClientSession(env,client,await getClientAuth(env,client.id));return v6AttachBookmark(json({success:true,client:cleanClone(client),session:publicClientSessionView(created.session)},{status:201,headers:{'Set-Cookie':setCookie(CLIENT_SESSION_COOKIE,created.sid,CLIENT_SESSION_TTL)}}),db);}
async function handleV6ClientLogin(request,env){
  assertSameOrigin(request);await ensureDB(env);const body=await readJson(request,30000),phone=normalizePhone(body.phone),password=String(body.password||''),rate=await assertLoginRateAllowed(env,requestIp(request),`client:global:${phone}`),db=v6ReadDb(request,env,true);let client=await v6FindClientByPhone(db,phone);
  if(!client){const state=await v610FastLegacyState(env),id=await env.GLOBAL_MARKET_KV.get(globalClientIndexKey(phone));client=(state?.marketClients||[]).find(c=>String(c.id)===String(id||'')||normalizePhone(c.phone)===phone)||null;if(client)await runD1Batches(env.GLOBAL_MARKET_D1,await v6UpsertStatements(env,'marketClients',client),20);}
  const auth=client?await getClientAuth(env,client.id):null;if(!client||!(await verifyCredential(auth,password))){await recordLoginFailure(env,rate);throw new HttpError(401,'Téléphone ou mot de passe incorrect.','INVALID_CREDENTIALS');}await clearLoginRate(env,rate);const created=await createClientSession(env,client,auth);return v6AttachBookmark(json({success:true,client:cleanClone(client),session:publicClientSessionView(created.session),progressiveLoad:true},{headers:{'Set-Cookie':setCookie(CLIENT_SESSION_COOKIE,created.sid,CLIENT_SESSION_TTL)}}),db);
}

function v6CatalogParams(url){const page=Math.max(1,Number(url.searchParams.get('page')||1)),pageSize=Math.min(48,Math.max(4,Number(url.searchParams.get('pageSize')||16))),q=String(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,120),category=String(url.searchParams.get('category')||'').trim().slice(0,120),type=String(url.searchParams.get('type')||'').trim().toLowerCase(),sort=String(url.searchParams.get('sort')||'recent'),companyId=String(url.searchParams.get('companyId')||'').trim();return{page,pageSize,q,category,type,sort,companyId};}
const V6_PUBLIC_CATALOG_CACHE_SECONDS=15;
const V6_PUBLIC_COMPANY_CACHE_SECONDS=45;
async function v6CacheJsonGet(key){try{const r=await caches.default.match(new Request(key));return r?await r.json():null}catch{return null}}
async function v6CacheJsonPut(key,value,ttl,executionCtx){try{const r=json(value,{headers:{'Cache-Control':`public, max-age=${ttl}`}});const task=caches.default.put(new Request(key),r);if(executionCtx?.waitUntil)executionCtx.waitUntil(task);else await task}catch{}}
let V604_CATALOG_RECOVERY_PROMISE=null,V604_CATALOG_RECOVERY_AT=0,V604_CATALOG_RECOVERY_RESULT=null;
async function v603LegacyCatalogData(request,env){
  const legacy=await loadStateLegacy(env,'*'),url=new URL(request.url),p=v6CatalogParams(url),all=Array.isArray(legacy.items)?legacy.items:[],companies=Array.isArray(legacy.companies)?legacy.companies:[],cmap=new Map(companies.map(c=>[String(c.id||''),c]));
  let rows=all.filter(i=>{const c=cmap.get(String(i.companyId||''));return c&&v6Bool(i.marketplaceHidden)===0});
  if(p.q)rows=rows.filter(i=>v6SearchText(i).includes(p.q));if(p.category)rows=rows.filter(i=>String(i.cat||i.category||'')===p.category);if(p.companyId)rows=rows.filter(i=>String(i.companyId||'')===p.companyId);
  if(p.type==='product')rows=rows.filter(i=>!['service','services','prestation'].includes(String(i.type||'').toLowerCase()));if(p.type==='service')rows=rows.filter(i=>['service','services','prestation'].includes(String(i.type||'').toLowerCase()));
  if(p.sort==='priceAsc')rows.sort((a,b)=>Number(a.sell||0)-Number(b.sell||0));else if(p.sort==='priceDesc')rows.sort((a,b)=>Number(b.sell||0)-Number(a.sell||0));else if(p.sort==='name')rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr'));else rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const total=rows.length,pages=Math.max(1,Math.ceil(total/p.pageSize)),page=Math.min(p.page,pages),items=rows.slice((page-1)*p.pageSize,page*p.pageSize).map(publicItem),categories=[...new Set(rows.map(i=>String(i.cat||i.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  const companyIds=new Set(items.map(i=>String(i.companyId||'')));return {items,companies:companies.filter(c=>companyIds.has(String(c.id||''))).map(publicCompany),pagination:{page,pageSize:p.pageSize,total,pages},categories,legacyFallback:true};
}
async function v604RecoverLegacyCatalogIfNeeded(env){
  const now=Date.now();if(V604_CATALOG_RECOVERY_RESULT&&now-V604_CATALOG_RECOVERY_AT<300000)return V604_CATALOG_RECOVERY_RESULT;if(V604_CATALOG_RECOVERY_PROMISE)return V604_CATALOG_RECOVERY_PROMISE;
  V604_CATALOG_RECOVERY_PROMISE=(async()=>{
    await ensureDB(env);
    const already=await v6MetaGet(env,'catalog_recovery_v604');
    if(already){try{return {recovered:false,reason:'v604-already-reconciled',...JSON.parse(already)}}catch{return {recovered:false,reason:'v604-already-reconciled'}}}
    const legacy=await loadStateLegacy(env,'*'),legacyItems=Array.isArray(legacy.items)?legacy.items.filter(x=>x?.id&&x?.companyId):[],legacyCompanies=Array.isArray(legacy.companies)?legacy.companies.filter(x=>x?.id):[];
    if(!legacyItems.length||!legacyCompanies.length)return {recovered:false,reason:'no-legacy-catalog',items:legacyItems.length,companies:legacyCompanies.length};
    const neededCompanyIds=new Set(legacyItems.map(x=>String(x.companyId||'')));let statements=[];
    for(const company of legacyCompanies.filter(c=>neededCompanyIds.has(String(c.id||''))))statements.push(...await v6UpsertStatements(env,'companies',company));
    for(const item of legacyItems)statements.push(...await v6UpsertStatements(env,'items',item));
    if(statements.length)await runD1Batches(env.GLOBAL_MARKET_D1,statements,20);
    const marker={at:v6Now(),items:legacyItems.length,companies:neededCompanyIds.size};await v6MetaSet(env,'catalog_recovery_v604',JSON.stringify(marker));invalidatePublicStateCache();
    return {recovered:true,reason:'legacy-full-reconciliation',...marker};
  })().catch(error=>({recovered:false,reason:'recovery-error',error:String(error?.message||error||'')})).finally(()=>{V604_CATALOG_RECOVERY_PROMISE=null});
  const result=await V604_CATALOG_RECOVERY_PROMISE;V604_CATALOG_RECOVERY_RESULT=result;V604_CATALOG_RECOVERY_AT=Date.now();return result;
}

let V605_CATALOG_RECONCILE_PROMISE=null,V605_CATALOG_RECONCILE_AT=0;
async function v605ForceCatalogReconcile(env){
  const now=Date.now();
  if(V605_CATALOG_RECONCILE_PROMISE)return V605_CATALOG_RECONCILE_PROMISE;
  if(now-V605_CATALOG_RECONCILE_AT<60000)return {recovered:false,reason:'v605-reconcile-throttled'};
  V605_CATALOG_RECONCILE_AT=now;
  V605_CATALOG_RECONCILE_PROMISE=(async()=>{
    await ensureDB(env);
    const legacy=await loadStateLegacy(env,'*');
    const legacyItems=Array.isArray(legacy.items)?legacy.items.filter(x=>x?.id&&x?.companyId):[];
    const legacyCompanies=Array.isArray(legacy.companies)?legacy.companies.filter(x=>x?.id):[];
    if(!legacyItems.length)return {recovered:false,reason:'no-legacy-items',items:0};
    const neededCompanyIds=new Set(legacyItems.map(x=>String(x.companyId||'')));
    const statements=[];
    for(const company of legacyCompanies.filter(c=>neededCompanyIds.has(String(c.id||''))))statements.push(...await v6UpsertStatements(env,'companies',company));
    for(const item of legacyItems)statements.push(...await v6UpsertStatements(env,'items',item));
    if(statements.length)await runD1Batches(env.GLOBAL_MARKET_D1,statements,20);
    const marker={at:v6Now(),items:legacyItems.length,companies:neededCompanyIds.size};
    await v6MetaSet(env,'catalog_recovery_v605',JSON.stringify(marker));
    invalidatePublicStateCache();
    return {recovered:true,reason:'v605-forced-reconciliation',...marker};
  })().catch(error=>({recovered:false,reason:'v605-reconcile-error',error:String(error?.message||error||'')})).finally(()=>{V605_CATALOG_RECONCILE_PROMISE=null});
  return V605_CATALOG_RECONCILE_PROMISE;
}
function v605CatalogBaseRequest(p){return !p.q&&!p.category&&!p.type&&!p.companyId;}
function v605CatalogLastGoodKey(p){return `v6:catalog:last-good:${p.page}:${p.pageSize}:${p.sort||'recent'}`;}
async function v605ReadLastGoodCatalog(env,p){try{return await env.GLOBAL_MARKET_KV.get(v605CatalogLastGoodKey(p),'json')}catch{return null}}
async function v605WriteLastGoodCatalog(env,p,data){if(!v605CatalogBaseRequest(p)||!Array.isArray(data?.items)||!data.items.length)return;try{await env.GLOBAL_MARKET_KV.put(v605CatalogLastGoodKey(p),JSON.stringify({...data,savedAt:v6Now()}),{expirationTtl:86400})}catch{}}
async function v6CatalogQueryCached(request,env,executionCtx){
  const url=new URL(request.url),p=v6CatalogParams(url),key=`https://cache.global-market.internal/catalog-v610?page=${p.page}&pageSize=${p.pageSize}&q=${encodeURIComponent(p.q)}&category=${encodeURIComponent(p.category)}&type=${encodeURIComponent(p.type)}&sort=${encodeURIComponent(p.sort)}&companyId=${encodeURIComponent(p.companyId)}`;
  const cached=await v6CacheJsonGet(key);if(cached&&Array.isArray(cached.items)&&cached.items.length)return {...cached,edgeCached:true,authoritativeEmpty:false};
  let data=null,d1Ok=false;try{data=await v6CatalogQuery(request,env);d1Ok=true}catch(error){console.warn('[V6.1] catalogue D1 léger différé',error?.message||error)}
  if(!Array.isArray(data?.items)||!data.items.length){const fast=await v610LegacyCatalogFast(request,env);if(Array.isArray(fast.items)&&fast.items.length){data=fast;v610ScheduleCoreHydration(env,executionCtx);}}
  if(v605CatalogBaseRequest(p)&&(!Array.isArray(data?.items)||!data.items.length)){const lastGood=await v605ReadLastGoodCatalog(env,p);if(Array.isArray(lastGood?.items)&&lastGood.items.length)data={...lastGood,source:'kv-last-good-v610',staleFallback:true};}
  if(!data)data={items:[],companies:[],pagination:{page:p.page,pageSize:p.pageSize,total:0,pages:1},categories:[],source:'empty-v610'};
  const ready=await v6IsReady(env);const authoritativeEmpty=Boolean(d1Ok&&ready&&Array.isArray(data.items)&&data.items.length===0);data={...data,authoritativeEmpty};
  if(Array.isArray(data.items)&&data.items.length){await v605WriteLastGoodCatalog(env,p,data);await v6CacheJsonPut(key,data,90,executionCtx)}
  if(!ready){v610ScheduleCoreHydration(env,executionCtx);v610ScheduleFullMigration(env,executionCtx)}
  return data;
}
async function v6PublicCompaniesCached(request,env,executionCtx){
  const key='https://cache.global-market.internal/companies-public-v610',cached=await v6CacheJsonGet(key);if(cached?.companies?.length)return cached.companies;
  const db=v6ReadDb(request,env,false);let companies=[];try{companies=(await v610SelectPublicCompanies(db)).filter(c=>!['blocked','suspended'].includes(String(c.status||'').toLowerCase()))}catch{}
  if(!companies.length){const fast=await v610FastPublicPayload(env);companies=(fast?.companies||[]).filter(c=>!['blocked','suspended'].includes(String(c.status||'').toLowerCase()))}
  if(companies.length)await v6CacheJsonPut(key,{companies},60,executionCtx);return companies;
}
async function v6CatalogQuery(request,env){
  await ensureDB(env); const db=v6ReadDb(request,env,false),url=new URL(request.url),p=v6CatalogParams(url),where=[`COALESCE(i.marketplace_hidden,0)=0`,`lower(COALESCE(c.status,'')) NOT IN ('blocked','suspended')`],bind=[];
  if(p.q){where.push('i.search_text LIKE ?');bind.push(`%${p.q}%`)} if(p.category){where.push('i.category=?');bind.push(p.category)} if(p.type==='product'){where.push("lower(COALESCE(i.item_type,'')) NOT IN ('service','services','prestation')")} if(p.type==='service'){where.push("lower(COALESCE(i.item_type,'')) IN ('service','services','prestation')")} if(p.companyId){where.push('i.company_id=?');bind.push(p.companyId)}
  const order=p.sort==='priceAsc'?'i.sell ASC':p.sort==='priceDesc'?'i.sell DESC':p.sort==='name'?'i.name COLLATE NOCASE ASC':'i.updated_at DESC',whereSql=where.join(' AND '),offset=(p.page-1)*p.pageSize;
  const itemSql=`SELECT i.id,i.company_id,i.code,i.name,i.category,i.item_type,i.sell,i.stock,i.stock_type,i.marketplace_hidden,i.updated_at,
    CASE WHEN json_valid(i.payload_json) THEN COALESCE(json_extract(i.payload_json,'$.detail'),'') ELSE '' END AS detail,
    CASE WHEN json_valid(i.payload_json) THEN COALESCE(json_extract(i.payload_json,'$.marketplaceDesc'),'') ELSE '' END AS marketplace_desc,
    CASE WHEN json_valid(i.payload_json) THEN COALESCE(json_extract(i.payload_json,'$.marketplacePromo'),'') ELSE '' END AS marketplace_promo,
    CASE WHEN json_valid(i.payload_json) AND COALESCE(length(json_extract(i.payload_json,'$.photo')),0)>0 THEN '/api/v6/item-photo/'||i.id ELSE '' END AS photo
    FROM gm_items i JOIN gm_companies c ON c.id=i.company_id WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`;
  const [countRow,itemRows,cats]=await Promise.all([db.prepare(`SELECT COUNT(*) AS n FROM gm_items i JOIN gm_companies c ON c.id=i.company_id WHERE ${whereSql}`).bind(...bind).first(),db.prepare(itemSql).bind(...bind,p.pageSize,offset).all(),db.prepare(`SELECT DISTINCT i.category FROM gm_items i JOIN gm_companies c ON c.id=i.company_id WHERE i.marketplace_hidden=0 AND i.category<>'' ORDER BY i.category LIMIT 100`).all()]);
  const items=(itemRows.results||[]).map(v610CatalogItemFromRow),companyIds=[...new Set(items.map(x=>x.companyId))],companies=companyIds.length?await v610SelectPublicCompanies(db,companyIds):[],total=Number(countRow?.n||0),pages=Math.max(1,Math.ceil(total/p.pageSize));
  return {items,companies,pagination:{page:Math.min(p.page,pages),pageSize:p.pageSize,total,pages},categories:(cats.results||[]).map(x=>x.category).filter(Boolean),source:'d1-v610-light'};
}
async function handleV6Bootstrap(request,env,executionCtx){
  v611ScheduleHistoricalReconcile(env,executionCtx);
  const [catalog,companies]=await Promise.all([v6CatalogQueryCached(request,env,executionCtx),v6PublicCompaniesCached(request,env,executionCtx)]),db=v6ReadDb(request,env,false); let clientSession=null,marketClients=[],orders=[],marketMessages=[],historyFallback=false;
  try{
    const ctx=await v6GetClientSession(request,env,false);clientSession=publicClientSessionView(ctx.session);marketClients=[cleanClone(ctx.client)];
    const recoveredOrders=await v613LoadClientOrders(env,ctx,executionCtx,{force:false,limit:1000});orders=recoveredOrders.orders;
    marketMessages=await v6ReadTable(db,'SELECT * FROM gm_market_messages WHERE client_id=? AND client_deleted=0 ORDER BY created_at DESC LIMIT 250',[ctx.client.id],v6MessageFromRow);
    if(!(await v611ClientHistoryDone(env,ctx.client.id))){const legacy=await v611LegacyClientSlice(env,ctx.client);marketMessages=v611MergeRows(marketMessages,legacy.messages);historyFallback=Boolean(recoveredOrders.recovery?.ran||legacy.messages.length);const task=v611BackfillClientSlice(env,{orders:[],messages:legacy.messages,companies:legacy.companies,marketClients:legacy.marketClients},ctx.client.id).catch(e=>console.warn('[V6.1.2] backfill messages client différé',e?.message||e));if(executionCtx?.waitUntil)executionCtx.waitUntil(task);}
  }catch(error){if(error?.code&&!['CLIENT_UNAUTHENTICATED','CLIENT_SESSION_EXPIRED'].includes(error.code))console.warn('[V6.1.1] session client bootstrap',error?.message||error);}
  const companyMap=new Map((companies||[]).map(c=>[c.id,c]));for(const c of catalog.companies||[])companyMap.set(c.id,c);
  return v6AttachBookmark(json({companies:[...companyMap.values()].map(publicCompany),items:catalog.items,marketClients,orders,marketMessages,clientDeletedOrders:{},clientSession,app:{name:APP_NAME,storageVersion:6},catalogMeta:{pagination:catalog.pagination,categories:catalog.categories,authoritativeEmpty:Boolean(catalog.authoritativeEmpty),source:catalog.source||'d1-v6'},historyFallback}),db);
}
async function handleV6Catalog(request,env,executionCtx){v611ScheduleHistoricalReconcile(env,executionCtx);const db=v6ReadDb(request,env,false),data=await v6CatalogQueryCached(request,env,executionCtx);return v6AttachBookmark(json(data,{headers:{'X-Global-Market-Edge-Cache':data.edgeCached?'HIT':'MISS'}}),db);}
async function handleV6ClientOrders(request,env,executionCtx){
  const ctx=await v6GetClientSession(request,env,false),url=new URL(request.url),page=Math.max(1,Number(url.searchParams.get('page')||1)),size=Math.min(100,Math.max(10,Number(url.searchParams.get('pageSize')||30))),force=url.searchParams.get('recover')==='1';
  const recovered=await v613LoadClientOrders(env,ctx,executionCtx,{force,limit:1000}),orders=recovered.orders,total=orders.length,slice=orders.slice((page-1)*size,page*size);
  return v6AttachBookmark(json({orders:slice,pagination:{page,pageSize:size,total,pages:Math.max(1,Math.ceil(total/size))},historyFallback:Boolean(recovered.recovery?.ran),authoritative:Boolean(recovered.authoritative),recovery:recovered.recovery}),ctx.db);
}
async function handleV6ClientMessages(request,env,executionCtx){
  const ctx=await v6GetClientSession(request,env,false),url=new URL(request.url),page=Math.max(1,Number(url.searchParams.get('page')||1)),size=Math.min(100,Math.max(10,Number(url.searchParams.get('pageSize')||50)));let rows=(await ctx.db.prepare('SELECT * FROM gm_market_messages WHERE client_id=? AND client_deleted=0 ORDER BY created_at DESC LIMIT 500').bind(ctx.client.id).all()).results||[],messages=rows.map(v6MessageFromRow),historyFallback=false;
  if(!(await v611ClientHistoryDone(env,ctx.client.id))){const legacy=await v611LegacyClientSlice(env,ctx.client);messages=v611MergeRows(messages,legacy.messages).filter(m=>!m.clientDeleted);historyFallback=Boolean(legacy.messages.length);const task=v611BackfillClientSlice(env,legacy,ctx.client.id).catch(()=>{});if(executionCtx?.waitUntil)executionCtx.waitUntil(task);}
  messages.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));const total=messages.length,slice=messages.slice((page-1)*size,page*size);return v6AttachBookmark(json({messages:slice,pagination:{page,pageSize:size,total,pages:Math.max(1,Math.ceil(total/size))},historyFallback}),ctx.db);
}
async function v611AdminHistoryMerge(env,user,d1Rows,key,executionCtx){
  if(await v611CompanyHistoryDone(env,user.companyId))return d1Rows;const legacy=await v611LegacyCompanyState(env,user.companyId,user);const merged=v611MergeRows(d1Rows,legacy?.[key]||[]);if(legacy){const task=v611InsertMissingFromLegacy(env,legacy,{scope:user.companyId,mark:false}).then(r=>v611MarkCompanyHistory(env,user.companyId,r)).catch(()=>{});if(executionCtx?.waitUntil)executionCtx.waitUntil(task);}return merged;
}
async function handleV6AdminOrders(request,env,executionCtx){const ctx=await v610GetEmployeeSessionLight(request,env,false);requireRole(ctx.user,['admin','caisse']);const url=new URL(request.url),page=Math.max(1,Number(url.searchParams.get('page')||1)),size=Math.min(100,Math.max(10,Number(url.searchParams.get('pageSize')||50)));let orders=await v6ReadTable(ctx.db,'SELECT * FROM gm_orders WHERE company_id=? ORDER BY order_date DESC LIMIT 500',[ctx.user.companyId],v6OrderFromRow);orders=await v611AdminHistoryMerge(env,ctx.user,orders,'orders',executionCtx);orders.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));const total=orders.length;return v6AttachBookmark(json({orders:orders.slice((page-1)*size,page*size),pagination:{page,pageSize:size,total,pages:Math.max(1,Math.ceil(total/size))}}),ctx.db);}
async function handleV6AdminMessages(request,env,executionCtx){const ctx=await v610GetEmployeeSessionLight(request,env,false);requireRole(ctx.user,['admin','caisse']);const url=new URL(request.url),page=Math.max(1,Number(url.searchParams.get('page')||1)),size=Math.min(100,Math.max(10,Number(url.searchParams.get('pageSize')||50)));let messages=await v6ReadTable(ctx.db,'SELECT * FROM gm_market_messages WHERE company_id=? AND admin_deleted=0 ORDER BY created_at DESC LIMIT 500',[ctx.user.companyId],v6MessageFromRow);messages=await v611AdminHistoryMerge(env,ctx.user,messages,'marketMessages',executionCtx);messages=messages.filter(m=>!m.adminDeleted).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));const total=messages.length;return v6AttachBookmark(json({messages:messages.slice((page-1)*size,page*size),pagination:{page,pageSize:size,total,pages:Math.max(1,Math.ceil(total/size))}}),ctx.db);}

async function handleV6AdminMarketplaceSnapshot(request,env,executionCtx){
  const ctx=await v610GetEmployeeSessionLight(request,env,false);requireRole(ctx.user,['admin','caisse']);const cid=ctx.user.companyId,db=ctx.db,url=new URL(request.url),orderSize=Math.min(100,Math.max(10,Number(url.searchParams.get('orderSize')||40))),messageSize=Math.min(100,Math.max(10,Number(url.searchParams.get('messageSize')||50)));
  let [orders,messages,items,clients]=await Promise.all([
    v6ReadTable(db,'SELECT * FROM gm_orders WHERE company_id=? ORDER BY order_date DESC LIMIT 250',[cid],v6OrderFromRow),
    v6ReadTable(db,'SELECT * FROM gm_market_messages WHERE company_id=? AND admin_deleted=0 ORDER BY created_at DESC LIMIT 250',[cid],v6MessageFromRow),
    v6ReadTable(db,'SELECT * FROM gm_items WHERE company_id=? ORDER BY updated_at DESC LIMIT 500',[cid],v6ItemFromRow),
    v6ReadTable(db,`SELECT * FROM gm_market_clients WHERE id IN (SELECT client_id FROM gm_orders WHERE company_id=? UNION SELECT client_id FROM gm_market_messages WHERE company_id=?) LIMIT 500`,[cid,cid],v6MarketClientFromRow)
  ]);
  if(!(await v611CompanyHistoryDone(env,cid))){const legacy=await v611LegacyCompanyState(env,cid,ctx.user);if(legacy){orders=v611MergeRows(orders,legacy.orders||[]);messages=v611MergeRows(messages,legacy.marketMessages||[]);items=v611MergeRows(items,legacy.items||[]);const clientIds=new Set([...orders,...messages].map(x=>String(x.clientId||'')).filter(Boolean));let globalLegacy=await readStateFallback(env,'*');if(!globalLegacy)globalLegacy=await loadStateLegacy(env,'*').catch(()=>null);clients=v611MergeRows(clients,(globalLegacy?.marketClients||[]).filter(c=>clientIds.has(String(c.id||''))));const task=v611InsertMissingFromLegacy(env,globalLegacy||legacy,{scope:cid,mark:false}).then(r=>v611MarkCompanyHistory(env,cid,r)).catch(()=>{});if(executionCtx?.waitUntil)executionCtx.waitUntil(task);}}
  orders.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));messages=messages.filter(m=>!m.adminDeleted).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  v611ScheduleHistoricalReconcile(env,executionCtx);return v6AttachBookmark(json({orders:orders.slice(0,orderSize),messages:messages.slice(0,messageSize),items,marketClients:clients,historySync:!(await v611CompanyHistoryDone(env,cid))}),db);
}

async function handleV6Order(request,env){
  assertSameOrigin(request);const ctx=await v6GetClientSession(request,env,true),body=await readJson(request,500000),cart=Array.isArray(body.cart)?body.cart:[];if(!cart.length||cart.length>60)throw new HttpError(400,'Panier vide ou trop volumineux.','INVALID_CART');const ids=[...new Set(cart.map(x=>String(x.itemId||'')).filter(Boolean))],marks=ids.map(()=>'?').join(','),rows=await ctx.db.prepare(`SELECT * FROM gm_items WHERE id IN (${marks})`).bind(...ids).all(),itemMap=new Map((rows.results||[]).map(r=>[r.id,v6ItemFromRow(r)]));const groups=new Map();
  for(const line of cart){const item=itemMap.get(String(line.itemId||''));if(!item||item.marketplaceHidden)throw new HttpError(400,'Un article du panier est introuvable.','ITEM_NOT_FOUND');const qty=Math.max(1,Math.min(10000,Number(line.qty||1))),isProduct=!['service','services','prestation'].includes(String(item.type||'').toLowerCase()),unit=Number(item.sell||0);if(isProduct&&item.stockType!=='unlimited'&&Number(item.stock||0)<qty)throw new HttpError(409,`Stock insuffisant pour : ${item.name}`,'INSUFFICIENT_STOCK');if(!groups.has(item.companyId))groups.set(item.companyId,{lines:[],company:null});groups.get(item.companyId).lines.push({itemId:item.id,item:item.name,category:item.cat||'',type:isProduct?'Produit':'Service',qty,unit,total:unit*qty});}
  const cids=[...groups.keys()],cmarks=cids.map(()=>'?').join(','),crow=await ctx.db.prepare(`SELECT * FROM gm_companies WHERE id IN (${cmarks})`).bind(...cids).all(),cmap=new Map((crow.results||[]).map(r=>[r.id,v6CompanyFromRow(r)]));for(const [cid,g] of groups){g.company=cmap.get(cid);if(!g.company)throw new HttpError(400,'Boutique introuvable.','COMPANY_NOT_FOUND');}
  const deliveryCity=String(body.deliveryCity||'').trim().slice(0,80),deliveryNeighborhood=String(body.deliveryNeighborhood||'').trim().slice(0,100),deliveryAddressDetail=String(body.deliveryAddressDetail||'').trim().slice(0,500),shippingByCompany=new Map((Array.isArray(body.shippingByCompany)?body.shippingByCompany:[]).map(x=>[String(x?.companyId||''),String(x?.methodId||x?.method||'')]));let prepared=[],grand=0,hasOutside=false;for(const[cid,g]of groups){const subtotal=g.lines.reduce((s,x)=>s+x.total,0);let delivery={deliveryFee:Math.round(subtotal*marketDeliveryRateForSubtotal(subtotal)),deliveryFeeRate:marketDeliveryRateForSubtotal(subtotal),city:'',neighborhoodName:'',methodName:'',methodId:'',cityFee:0,methodFee:0,local:true,pickup:false};if(deliveryCity){delivery=calculateMarketDelivery(g.company,subtotal,deliveryCity,shippingByCompany.get(cid)||'',deliveryNeighborhood);if(!delivery.local)hasOutside=true;if(!delivery.pickup&&!deliveryAddressDetail)throw new HttpError(400,'Le détail sur l’adresse de livraison est obligatoire.','DELIVERY_ADDRESS_REQUIRED');}grand+=subtotal+delivery.deliveryFee;prepared.push({cid,g,subtotal,delivery});}if(deliveryCity&&hasOutside&&grand<10000)throw new HttpError(400,`Toute commande hors de la ville de la boutique doit avoir un total général d’au moins 10 000 FCFA. Total actuel : ${Math.round(grand).toLocaleString('fr-FR')} FCFA.`,'OUTSIDE_CITY_MINIMUM_ORDER');
  const checkoutId=`achat_${crypto.randomUUID()}`,now=v6Now(),orders=[],stmts=[];for(const p of prepared){for(const line of p.g.lines)if(line.type==='Produit')stmts.push(env.GLOBAL_MARKET_D1.prepare(`UPDATE gm_items SET stock=CASE WHEN stock_type='unlimited' THEN stock ELSE stock-? END,updated_at=? WHERE id=?`).bind(line.qty,now,line.itemId));const total=p.subtotal+p.delivery.deliveryFee,order={id:`cmd_${crypto.randomUUID()}`,checkoutId,companyId:p.cid,shopName:p.g.company.name||'Boutique',clientId:ctx.client.id,client:ctx.client.name,clientPhone:ctx.client.phone,clientEmail:ctx.client.email||'',date:now,items:p.g.lines,item:p.g.lines.map(x=>x.item).join(', '),qty:p.g.lines.reduce((a,x)=>a+x.qty,0),subtotal:p.subtotal,deliveryFeeRate:p.delivery.deliveryFeeRate,deliveryFee:p.delivery.deliveryFee,total,deliveryCity:p.delivery.city||deliveryCity,deliveryNeighborhood:p.delivery.neighborhoodName||'',deliveryAddressDetail,shippingMethod:p.delivery.methodName||'',shippingMethodId:p.delivery.methodId||'',shippingCityFee:p.delivery.cityFee||0,shippingMethodFee:p.delivery.methodFee||0,paymentMethod:'PAIEMENT À LA LIVRAISON',paymentTiming:'delivery',paymentStatus:'À payer à la livraison',paymentCurrency:'FCFA',paymentAmount:total,transactionId:'',paymentRef:'',validationStatus:'En attente de validation',deliveryStatus:'En attente de validation',delivery:'En attente de validation',source:'GLOBAL MARKET V6'};orders.push(order);stmts.push(...await v6UpsertStatements(env,'orders',order));}
  try{await env.GLOBAL_MARKET_D1.batch(stmts);}catch(error){if(/INSUFFICIENT_STOCK/i.test(String(error?.message||error)))throw new HttpError(409,'Le stock d’un produit vient de changer. Actualisez le panier.','INSUFFICIENT_STOCK');throw error;}await Promise.allSettled(orders.map(o=>v6RealtimePublish(env,`company:${o.companyId}`,{type:'order',action:'new',order:o})));return json({success:true,checkoutId,orders:orders.map(cleanClone),grandTotal:grand},{status:201});
}
async function v6GetClientOrder(ctx,id){const row=await ctx.db.prepare('SELECT * FROM gm_orders WHERE id=? AND client_id=?').bind(String(id||''),ctx.client.id).first();return v6OrderFromRow(row);}
async function handleV6OrderPayment(request,env){const ctx=await v6GetClientSession(request,env,true),body=await readJson(request,30000),order=await v6GetClientOrder(ctx,body.orderId);if(!order)throw new HttpError(404,'Commande introuvable.','ORDER_NOT_FOUND');const validation=String(order.validationStatus||'').toLowerCase();if(!validation.includes('valid')||validation.includes('annul'))throw new HttpError(409,'Le paiement est disponible uniquement après validation de la commande.','ORDER_NOT_VALIDATED');const method=String(body.method||'').trim().toUpperCase(),transactionId=String(body.transactionId||'').trim().slice(0,200);if(!['WAVE','USDT TRC20','USDTTRC20'].includes(method)||!transactionId)throw new HttpError(400,'Moyen de paiement ou ID de transaction invalide.','INVALID_PAYMENT');order.paymentMethod=method.startsWith('USDT')?'USDT TRC20':'WAVE';order.transactionId=transactionId;order.paymentRef=transactionId;order.paymentStatus='Paiement déclaré par le client';order.clientPaymentSubmittedAt=v6Now();await env.GLOBAL_MARKET_D1.batch(await v6UpsertStatements(env,'orders',order));await v6RealtimePublish(env,`company:${order.companyId}`,{type:'order',action:'payment-submitted',order});return json({success:true,order});}
async function handleV6OrderCancel(request,env){const ctx=await v6GetClientSession(request,env,true),body=await readJson(request,20000),order=await v6GetClientOrder(ctx,body.orderId);if(!order)throw new HttpError(404,'Commande introuvable.','ORDER_NOT_FOUND');if(String(order.paymentStatus||'').toLowerCase().includes('confirm'))throw new HttpError(409,'Une commande payée et confirmée ne peut plus être annulée.','ORDER_PAYMENT_CONFIRMED');const stmts=[];if(!order.stockRestored){for(const line of order.items||[])if(String(line.type||'').toLowerCase()==='produit')stmts.push(env.GLOBAL_MARKET_D1.prepare(`UPDATE gm_items SET stock=CASE WHEN stock_type='unlimited' THEN stock ELSE stock+? END,updated_at=? WHERE id=?`).bind(Number(line.qty||0),v6Now(),line.itemId));order.stockRestored=true;}order.validationStatus='Annuler';order.deliveryStatus='Aucune action';order.afterSaleStatus='Annulée par le client';order.delivery='Commande annulée';order.clientCancelled=true;order.cancelledAt=v6Now();order.cancelledBy='client';stmts.push(...await v6UpsertStatements(env,'orders',order));await env.GLOBAL_MARKET_D1.batch(stmts);await v6RealtimePublish(env,`company:${order.companyId}`,{type:'order',action:'cancelled',order});return json({success:true,order});}
async function handleV6OrderDelete(request,env){const ctx=await v6GetClientSession(request,env,true),body=await readJson(request,20000),order=await v6GetClientOrder(ctx,body.orderId);if(!order)throw new HttpError(404,'Commande introuvable.','ORDER_NOT_FOUND');if(String(order.paymentStatus||'').toLowerCase().includes('confirm'))throw new HttpError(409,'Une commande payée et confirmée ne peut plus être supprimée.','ORDER_PAYMENT_CONFIRMED');if(!String(order.validationStatus||'').toLowerCase().includes('annul'))throw new HttpError(409,'Annulez d’abord la commande avant de la supprimer.','ORDER_NOT_CANCELLED');await env.GLOBAL_MARKET_D1.batch(v6DeleteStatements(env,'orders',order.id));await v6RealtimePublish(env,`company:${order.companyId}`,{type:'order',action:'deleted',orderId:order.id});return json({success:true});}
async function handleV6MessageSend(request,env){assertSameOrigin(request);const body=await readJson(request,50000),companyId=String(body.companyId||'').trim(),db=v6ReadDb(request,env,true),company=v6CompanyFromRow(await db.prepare('SELECT * FROM gm_companies WHERE id=?').bind(companyId).first());if(!company)throw new HttpError(404,'Boutique introuvable.','COMPANY_NOT_FOUND');const text=String(body.message||'').trim().slice(0,3000);if(!text)throw new HttpError(400,'Message obligatoire.','MESSAGE_REQUIRED');let client=null;try{client=(await v6GetClientSession(request,env,false)).client}catch{}const message={id:`msg_${crypto.randomUUID()}`,companyId,clientId:client?.id||'',clientName:client?.name||String(body.name||'Visiteur').trim().slice(0,160),clientPhone:client?.phone||normalizePhone(body.phone),clientEmail:client?.email||normalizeIdentifier(body.email),senderType:'client',senderName:client?.name||String(body.name||'Visiteur').trim().slice(0,160),body:text,createdAt:v6Now(),adminDeleted:false,clientDeleted:false,readByAdmin:false,readByClient:true};await env.GLOBAL_MARKET_D1.batch(await v6UpsertStatements(env,'marketMessages',message));await v6RealtimePublish(env,`company:${companyId}`,{type:'message',action:'new',message});return json({success:true,message},{status:201});}
async function handleV6MessageDelete(request,env){const ctx=await v6GetClientSession(request,env,true),body=await readJson(request,50000),ids=(Array.isArray(body.ids)?body.ids:[body.id]).map(String).filter(Boolean).slice(0,200);if(!ids.length)return json({success:true,count:0});const marks=ids.map(()=>'?').join(','),rows=await ctx.db.prepare(`SELECT * FROM gm_market_messages WHERE client_id=? AND id IN (${marks})`).bind(ctx.client.id,...ids).all(),stmts=[];for(const row of rows.results||[]){const m=v6MessageFromRow(row);m.clientDeleted=true;m.clientDeletedAt=v6Now();stmts.push(...await v6UpsertStatements(env,'marketMessages',m));}if(stmts.length)await runD1Batches(env.GLOBAL_MARKET_D1,stmts,30);return json({success:true,count:(rows.results||[]).length});}
async function handleV6ClientProfile(request,env){const ctx=await v6GetClientSession(request,env,true),body=await readJson(request,50000),client=ctx.client,oldPhone=normalizePhone(client.phone),newName=String(body.name??client.name??'').trim().slice(0,160),newPhone=normalizePhone(body.phone??client.phone),newEmail=normalizeIdentifier(body.email??client.email),currentPassword=String(body.currentPassword||''),newPasswordRaw=String(body.newPassword||'');if(!newName||!newPhone)throw new HttpError(400,'Nom et identifiant / téléphone obligatoires.','MISSING_FIELDS');if((newPhone!==oldPhone||newPasswordRaw)&&(!currentPassword||!(await verifyCredential(ctx.auth,currentPassword))))throw new HttpError(401,'Mot de passe actuel incorrect.','CURRENT_PASSWORD_INVALID');if(newPhone!==oldPhone&&await ctx.db.prepare('SELECT id FROM gm_market_clients WHERE phone=? AND id<>?').bind(newPhone,client.id).first())throw new HttpError(409,'Cet identifiant / téléphone est déjà utilisé.','PHONE_EXISTS');client.name=newName;client.phone=newPhone;client.email=newEmail;client.updatedAt=v6Now();let auth=ctx.auth;if(newPhone!==oldPhone||newPasswordRaw)auth=await writeClientCredential(env,client,newPasswordRaw?validatePassword(newPasswordRaw,'client'):currentPassword);await env.GLOBAL_MARKET_D1.batch(await v6UpsertStatements(env,'marketClients',client));if(newPhone!==oldPhone){await env.GLOBAL_MARKET_KV.delete(globalClientIndexKey(oldPhone));await env.GLOBAL_MARKET_KV.put(globalClientIndexKey(newPhone),client.id);}if(newPhone!==oldPhone||newPasswordRaw){await env.GLOBAL_MARKET_KV.delete(`client-session:${ctx.sid}`);const created=await createClientSession(env,client,auth);return json({success:true,client,session:publicClientSessionView(created.session)},{headers:{'Set-Cookie':setCookie(CLIENT_SESSION_COOKIE,created.sid,CLIENT_SESSION_TTL)}});}return json({success:true,client,session:publicClientSessionView(ctx.session)});}
async function handleV6ClientResetRequest(request,env){assertSameOrigin(request);const body=await readJson(request,30000),phone=normalizePhone(body.phone||body.identifier),db=v6ReadDb(request,env,true),client=await v6FindClientByPhone(db,phone);if(client){let row=await db.prepare(`SELECT * FROM gm_password_reset_requests WHERE user_id=? AND role='client' AND status='pending' ORDER BY created_at DESC LIMIT 1`).bind(client.id).first();if(!row){const req={id:`rst_${crypto.randomUUID()}`,companyId:GLOBAL_CLIENT_SCOPE,userId:client.id,userName:client.name||'',email:client.email||'',role:'client',phone:client.phone||phone,reason:String(body.reason||'Mot de passe oublié').slice(0,300),status:'pending',createdAt:v6Now()};await env.GLOBAL_MARKET_D1.batch(await v6UpsertStatements(env,'passwordResetRequests',req));}}return json({success:true,message:'Si le compte existe, la demande de réinitialisation a été transmise au Super Admin GLOBAL MARKET.'});}

async function v6RealtimePublish(env,room,event){if(!env.REALTIME_HUB||!room)return;try{const id=env.REALTIME_HUB.idFromName(room),stub=env.REALTIME_HUB.get(id);await stub.fetch('https://realtime.internal/publish',{method:'POST',headers:{'Content-Type':'application/json','X-Room':room},body:JSON.stringify({...event,room,at:v6Now()})});}catch(error){console.warn('Temps réel différé',error?.message||error);}}
async function handleV6Realtime(request,env){if(!env.REALTIME_HUB)throw new HttpError(424,'Le service temps réel n’est pas encore lié au projet Pages.','REALTIME_BINDING_MISSING');let room='';try{const ctx=await v6GetEmployeeSession(request,env,false);room=ctx.user.role==='superadmin'?'superadmin':`company:${ctx.user.companyId}`;}catch{try{const ctx=await v6GetClientSession(request,env,false);room=`client:${ctx.client.id}`;}catch{throw new HttpError(401,'Connexion requise pour le temps réel.','UNAUTHENTICATED');}}const id=env.REALTIME_HUB.idFromName(room),stub=env.REALTIME_HUB.get(id),headers=new Headers(request.headers);headers.set('X-Room',room);return stub.fetch(new Request('https://realtime.internal/connect',{method:'GET',headers}));}
async function handleV6Media(request,env,key){if(!env.GLOBAL_MARKET_MEDIA)throw new HttpError(404,'Média indisponible.','MEDIA_NOT_FOUND');const object=await env.GLOBAL_MARKET_MEDIA.get(key);if(!object)throw new HttpError(404,'Média introuvable.','MEDIA_NOT_FOUND');const headers=new Headers();object.writeHttpMetadata(headers);headers.set('etag',object.httpEtag);headers.set('Cache-Control',headers.get('Cache-Control')||'public, max-age=31536000, immutable');return new Response(object.body,{headers});}


async function handleV6LegacyBootstrapBridge(request,env){
  const payload=await publicLoadPayload(request,env),url=new URL(request.url),p=v6CatalogParams(url),all=Array.isArray(payload.items)?payload.items:[],companies=Array.isArray(payload.companies)?payload.companies:[],cmap=new Map(companies.map(c=>[c.id,c]));
  let rows=all.filter(i=>{const c=cmap.get(i.companyId);return c&&v6Bool(i.marketplaceHidden)===0});
  if(p.q)rows=rows.filter(i=>v6SearchText(i).includes(p.q)); if(p.category)rows=rows.filter(i=>String(i.cat||i.category||'')===p.category); if(p.companyId)rows=rows.filter(i=>String(i.companyId||'')===p.companyId);
  if(p.type==='product')rows=rows.filter(i=>!['service','services','prestation'].includes(String(i.type||'').toLowerCase())); if(p.type==='service')rows=rows.filter(i=>['service','services','prestation'].includes(String(i.type||'').toLowerCase()));
  if(p.sort==='priceAsc')rows.sort((a,b)=>Number(a.sell||0)-Number(b.sell||0)); else if(p.sort==='priceDesc')rows.sort((a,b)=>Number(b.sell||0)-Number(a.sell||0)); else if(p.sort==='name')rows.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr')); else rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  const total=rows.length,pages=Math.max(1,Math.ceil(total/p.pageSize)),page=Math.min(p.page,pages),items=rows.slice((page-1)*p.pageSize,page*p.pageSize),categories=[...new Set(rows.map(i=>String(i.cat||i.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  return json({...payload,items,catalogMeta:{pagination:{page,pageSize:p.pageSize,total,pages},categories},migrationPending:true});
}
async function handleV6LegacyCatalogBridge(request,env){
  const response=await handleV6LegacyBootstrapBridge(request,env),data=await response.json();return json({items:data.items||[],pagination:data.catalogMeta?.pagination||{},categories:data.catalogMeta?.categories||[],migrationPending:true});
}


async function handleV610SessionGet(request,env,executionCtx){
  try{const ctx=await v610GetEmployeeSessionLight(request,env,false),data=await v610MinimalEmployeeData(ctx.db,ctx.user);v611ScheduleHistoricalReconcile(env,executionCtx);return v6AttachBookmark(json({session:publicSessionView(ctx.session),data,progressiveLoad:true,historySync:true}),ctx.db)}catch{return json({session:null})}
}
async function handleV610EmployeeLoad(request,env,executionCtx){
  const ctx=await v610GetEmployeeSessionLight(request,env,false);let state=null;try{state=await v6LoadState(env,ctx.user.role==='superadmin'?'*':ctx.user.companyId,request)}catch(error){console.warn('[V6.1.1] chargement relationnel différé',error?.message||error);state=await v610MinimalEmployeeData(ctx.db,ctx.user)}
  const historyDone=ctx.user.role==='superadmin'?await v611HistoricalReconcileDone(env):await v611CompanyHistoryDone(env,ctx.user.companyId);
  if(!historyDone){const legacy=await v611LegacyCompanyState(env,ctx.user.role==='superadmin'?'*':ctx.user.companyId,ctx.user);if(legacy){state=v611MergeStatePreferD1(state,legacy);const task=v611InsertMissingFromLegacy(env,legacy,{scope:ctx.user.role==='superadmin'?'*':ctx.user.companyId,mark:false}).then(r=>ctx.user.role==='superadmin'?r:v611MarkCompanyHistory(env,ctx.user.companyId,r)).catch(e=>console.warn('[V6.1.1] backfill entreprise différé',e?.message||e));if(executionCtx?.waitUntil)executionCtx.waitUntil(task);}}
  v611ScheduleHistoricalReconcile(env,executionCtx);return v6AttachBookmark(json(scopeState(state,ctx.user)),ctx.db);
}
async function handleApi(request, env, executionCtx) {
  needBindings(env);
  const url = new URL(request.url);
  try {
    const v6Ready = await v6IsReady(env);
    if (url.pathname === '/api/v6/migration-status' && request.method === 'GET') return json({ready:v6Ready,version:await v6MetaGet(env,V6_MIGRATION_META_KEY),status:await v6MetaGet(env,'migration_status')||'not-started'});
    if (url.pathname === '/api/v6/migrate' && request.method === 'POST') { v6AuthorizeMigration(request,env); return json({success:true,...await v6MigrateLegacy(env)}); }
    if (url.pathname.startsWith('/api/v6/media-kv/') && request.method === 'GET') { const parts=url.pathname.slice('/api/v6/media-kv/'.length).split('/').map(decodeURIComponent); return await handleV610KvMedia(request,env,parts[0]||'',parts[1]||'',parts[2]||''); }
    if (url.pathname.startsWith('/api/v6/item-photo/') && request.method === 'GET') return await handleV610ItemPhoto(request,env,decodeURIComponent(url.pathname.slice('/api/v6/item-photo/'.length)));
    if (url.pathname.startsWith('/api/v6/media/') && request.method === 'GET') return await handleV6Media(request,env,decodeURIComponent(url.pathname.slice('/api/v6/media/'.length)));
    if (url.pathname === '/api/v6/realtime-status' && request.method === 'GET') return json({available:Boolean(env.REALTIME_HUB),mode:env.REALTIME_HUB?'websocket':'polling-fallback'});
    if (v6Ready && url.pathname === '/api/v6/realtime' && request.method === 'GET') return await handleV6Realtime(request,env);
    if (url.pathname === '/api/v6/catalog' && request.method === 'GET') return await handleV6Catalog(request,env,executionCtx);
    if (url.pathname === '/api/v6/bootstrap' && request.method === 'GET') return await handleV6Bootstrap(request,env,executionCtx);
    if (v6Ready && url.pathname === '/api/v6/client/orders' && request.method === 'GET') return await handleV6ClientOrders(request,env,executionCtx);
    if (v6Ready && url.pathname === '/api/v6/client/messages' && request.method === 'GET') return await handleV6ClientMessages(request,env,executionCtx);
    if (v6Ready && url.pathname === '/api/v6/admin/orders' && request.method === 'GET') return await handleV6AdminOrders(request,env,executionCtx);
    if (v6Ready && url.pathname === '/api/v6/admin/messages' && request.method === 'GET') return await handleV6AdminMessages(request,env,executionCtx);
    if (v6Ready && url.pathname === '/api/v6/admin/marketplace-snapshot' && request.method === 'GET') return await handleV6AdminMarketplaceSnapshot(request,env,executionCtx);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      await ensureDB(env);
      const [auth, d1Probe] = await Promise.all([
        getAuth(env, SUPER_ADMIN_ID),
        env.GLOBAL_MARKET_D1.prepare('SELECT 1 AS ok').first()
      ]);
      return json({
        ok: Boolean(d1Probe?.ok), app: APP_NAME, kv: true, d1: Boolean(d1Probe?.ok),
        relationalCatalog: await env.GLOBAL_MARKET_D1.prepare(`SELECT (SELECT COUNT(*) FROM gm_items) AS items,(SELECT COUNT(*) FROM gm_companies) AS companies`).first(),
        catalogRecovery: await v6MetaGet(env,'catalog_recovery_v604'),
        historicalReconcile: await v6MetaGet(env,V611_RECONCILE_META_KEY),
        securityInitialized: Boolean(auth?.hash),
        setupRequired: !auth?.hash,
        superAdminEmailConfigured: Boolean(configuredSuperAdminIdentifier(env)),
        superAdminPasswordSecretConfigured: Boolean(String(env.SUPER_ADMIN_INITIAL_PASSWORD || '')),
        saveMode: (await v6IsReady(env)) ? 'relational-d1-v6' : 'legacy-migration-mode',
        relationalV6: await v6IsReady(env),
        realtimeBound: Boolean(env.REALTIME_HUB),
        mediaBound: Boolean(env.GLOBAL_MARKET_MEDIA),
        time: new Date().toISOString()
      });
    }

    if (url.pathname === '/api/login' && request.method === 'POST') return await handleV6Login(request, env);
    if (url.pathname === '/api/register-company' && request.method === 'POST') return await handleV6RegisterCompany(request, env);
    if (url.pathname === '/api/password/change' && request.method === 'POST') return await handlePasswordChange(request, env);
    if (url.pathname === '/api/password/request-reset' && request.method === 'POST') return await handlePasswordResetRequest(request, env);

    if (url.pathname === '/api/session' && request.method === 'GET') return await handleV610SessionGet(request,env,executionCtx);
    if (url.pathname === '/api/session' && request.method === 'POST') {
      throw new HttpError(405, 'La création directe de session est désactivée. Utilisez /api/login.', 'METHOD_NOT_ALLOWED');
    }
    if (url.pathname === '/api/session' && request.method === 'DELETE') {
      const sid = getCookie(request, EMPLOYEE_SESSION_COOKIE);
      if (sid) {
        try { await getEmployeeSession(request, env, true); } catch (error) { if (!(error instanceof HttpError) || error.code !== 'SESSION_EXPIRED') throw error; }
        await env.GLOBAL_MARKET_KV.delete(`session:${sid}`);
      }
      return json({ success: true }, { headers: { 'Set-Cookie': setCookie(EMPLOYEE_SESSION_COOKIE, '', 0) } });
    }

    if (url.pathname === '/api/load' && request.method === 'GET') return await handleV610EmployeeLoad(request,env,executionCtx);
    if (url.pathname === '/api/save-delta' && request.method === 'POST') {
      assertSameOrigin(request);
      const ctx = await v610GetEmployeeSessionLight(request, env, false);
      const body = await readJson(request, 2_500_000);
      const result = await v6PersistStateDelta(env, body.delta, ctx.user);
      return json({ success: true, message: 'Enregistrement sécurisé effectué.', storage: result.storage, patchCount: result.patchCount });
    }
    if (url.pathname === '/api/save' && request.method === 'POST') {
      // Les enregistrements courants restent protégés par la session HttpOnly,
      // le contrôle d'origine et l'isolation des données de l'entreprise.
      // Le jeton CSRF n'est plus exigé ici afin qu'un onglet ancien ou une
      // reconnexion dans un autre onglet ne bloque plus la sauvegarde.
      assertSameOrigin(request);
      const ctx = await getEmployeeSession(request, env, false);
      const body = await readJson(request);
      const incoming = body.data && typeof body.data === 'object' ? body.data : body;
      const before = cleanClone(ctx.state);
      const merged = mergeScopedState(ctx.state, incoming, ctx.user);
      const delta = buildStateDeltaForPersistence(before, merged);
      const result = await persistStateDelta(env, delta, ctx.user);
      return json({ success: true, message: 'Enregistrement sécurisé effectué.', storage: result.storage, patchCount: result.patchCount });
    }

    if (url.pathname === '/api/companies/delete' && request.method === 'POST') return await handleDeleteCompany(request, env);

    if (url.pathname === '/api/users/create' && request.method === 'POST') return await handleCreateUser(request, env);
    if (url.pathname === '/api/users/update' && request.method === 'POST') return await handleUpdateUser(request, env);
    if (url.pathname === '/api/users/delete' && request.method === 'POST') return await handleDeleteUser(request, env);
    if (url.pathname === '/api/users/reset-password' && request.method === 'POST') return await handleResetUserPassword(request, env);

    if (url.pathname === '/api/public/load' && request.method === 'GET') return v6Ready ? await handleV6Bootstrap(request, env, executionCtx) : json(await publicLoadPayload(request, env));
    if (url.pathname === '/api/public/client/register' && request.method === 'POST') return await handleV6ClientRegister(request, env);
    if (url.pathname === '/api/public/client/login' && request.method === 'POST') return await handleV6ClientLogin(request, env);
    if (url.pathname === '/api/public/client/profile' && request.method === 'POST') return v6Ready ? await handleV6ClientProfile(request, env) : await handlePublicClientProfileUpdate(request, env);
    if (url.pathname === '/api/public/client/request-reset' && request.method === 'POST') return v6Ready ? await handleV6ClientResetRequest(request, env) : await handlePublicClientResetRequest(request, env);
    if (url.pathname === '/api/client/reset-password' && request.method === 'POST') return await handleSuperResetClientPassword(request, env);
    if (url.pathname === '/api/public/client/session' && request.method === 'DELETE') {
      const sid = getCookie(request, CLIENT_SESSION_COOKIE);
      if (sid) await env.GLOBAL_MARKET_KV.delete(`client-session:${sid}`);
      return json({ success: true }, { headers: { 'Set-Cookie': setCookie(CLIENT_SESSION_COOKIE, '', 0) } });
    }
    if (url.pathname === '/api/public/order' && request.method === 'POST') return v6Ready ? await handleV6Order(request, env) : await handlePublicOrder(request, env);
    if (url.pathname === '/api/public/order/payment' && request.method === 'POST') return v6Ready ? await handleV6OrderPayment(request, env) : await handlePublicOrderPayment(request, env);
    if (url.pathname === '/api/public/order/cancel' && request.method === 'POST') return v6Ready ? await handleV6OrderCancel(request, env) : await handlePublicOrderCancel(request, env);
    if (url.pathname === '/api/public/order/delete' && request.method === 'POST') return v6Ready ? await handleV6OrderDelete(request, env) : await handlePublicOrderDelete(request, env);
    if (url.pathname === '/api/public/message' && request.method === 'POST') return v6Ready ? await handleV6MessageSend(request, env) : await handlePublicMessageSend(request, env);
    if (url.pathname === '/api/public/message/delete' && request.method === 'POST') return v6Ready ? await handleV6MessageDelete(request, env) : await handlePublicMessageDelete(request, env);

    throw new HttpError(404, `API introuvable : ${url.pathname}`, 'NOT_FOUND');
  } catch (error) {
    return errorResponse(error);
  }
}

export default {
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, executionCtx);

    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    const path = url.pathname;

    // En mode avancé Pages, les règles _headers ne s'appliquent pas aux réponses
    // renvoyées par ce Worker. Les en-têtes sont donc appliqués ici.
    if (path === '/' || path.endsWith('.html') || path === '/version.json') {
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
    } else if (/\.(?:[a-f0-9]{12})\.(?:js|css)$/i.test(path)) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(?:js|css)$/i.test(path)) {
      headers.set('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    }

    headers.set('X-Global-Market-Architecture', 'V6-D1-RELATIONAL-WEBSOCKET');
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers
    });
  }
};
