const APP_NAME = 'GLOBAL MARKET';
const STATE_ID = 'global_market_all';
const STATE_KEY = `company:${STATE_ID}`;
const EMPLOYEE_SESSION_COOKIE = 'GLOBAL_MARKET_SESSION';
const CLIENT_SESSION_COOKIE = 'GLOBAL_MARKET_CLIENT_SESSION';
const EMPLOYEE_SESSION_TTL = 60 * 60 * 24 * 7;
const CLIENT_SESSION_TTL = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100000;
const D1_CHUNK_MAX_BYTES = 1_500_000;
const D1_BACKUP_MAX_BYTES = 1_500_000;
const KV_STATE_MAX_BYTES = 20_000_000;
const MAX_STATE_BYTES = 60_000_000;
const LEGACY_CREDENTIAL_MIGRATION_KEY = 'security:credentials:migrated:v4';
let dbReadyPromise = null;
let legacyMigrationChecked = false;
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
  return json({ success: false, error: 'Erreur interne sécurisée.', code: 'INTERNAL_ERROR' }, { status: 500 });
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

async function ensureDB(env) {
  needBindings(env);
  if (!dbReadyPromise) {
    dbReadyPromise = env.GLOBAL_MARKET_D1.batch([
      env.GLOBAL_MARKET_D1.prepare(`CREATE TABLE IF NOT EXISTS state_meta (
        company_id TEXT PRIMARY KEY,
        chunk_count INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.GLOBAL_MARKET_D1.prepare(`CREATE TABLE IF NOT EXISTS state_chunks (
        company_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (company_id, chunk_index)
      )`),
      env.GLOBAL_MARKET_D1.prepare(`CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      env.GLOBAL_MARKET_D1.prepare(`CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        actor_id TEXT,
        company_id TEXT,
        detail TEXT,
        ip_hash TEXT,
        created_at TEXT NOT NULL
      )`),
      env.GLOBAL_MARKET_D1.prepare('CREATE INDEX IF NOT EXISTS idx_backups_company_id ON backups(company_id, id DESC)'),
      env.GLOBAL_MARKET_D1.prepare('CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC)')
    ]).catch(error => {
      dbReadyPromise = null;
      throw error;
    });
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
  for (const key of ['companies', 'users', 'items', 'sales', 'payments', 'orders', 'clients', 'marketClients', 'passwordResetRequests']) {
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

  // D1 est la source durable. KV sert de cache rapide lorsque la taille le permet.
  const d1 = await writeD1State(env, STATE_ID, raw);
  if (sizeBytes <= KV_STATE_MAX_BYTES) {
    await env.GLOBAL_MARKET_KV.put(STATE_KEY, raw);
  } else {
    await env.GLOBAL_MARKET_KV.put(STATE_KEY, makeStateStorageMarker(sizeBytes, normalized.app.updatedAt));
  }
  return { state: normalized, d1, storage: sizeBytes <= KV_STATE_MAX_BYTES ? 'kv+d1' : 'd1' };
}

async function loadState(env) {
  await ensureDB(env);
  const kvRaw = await env.GLOBAL_MARKET_KV.get(STATE_KEY);
  const marker = parseStateStorageMarker(kvRaw);
  let state = marker ? null : parseState(kvRaw);
  if (!state) state = await readD1State(env, STATE_ID);
  if (!state) state = defaultState();
  state = normalizeState(state);
  const migrated = await ensureLegacyCredentialsMigrated(env, state);
  if (migrated || !kvRaw) await saveState(env, state);
  return state;
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
  const state = await loadState(env);
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

async function getClientSession(request, env, requireCsrf = false) {
  const sid = getCookie(request, CLIENT_SESSION_COOKIE);
  if (!sid) throw new HttpError(401, 'Connexion client requise.', 'CLIENT_UNAUTHENTICATED');
  const session = await env.GLOBAL_MARKET_KV.get(`client-session:${sid}`, 'json');
  if (!session || Number(session.expiresAt || 0) <= Date.now()) throw new HttpError(401, 'Session client expirée.', 'CLIENT_SESSION_EXPIRED');
  if (requireCsrf) {
    assertSameOrigin(request);
    const csrf = request.headers.get('X-CSRF-Token') || '';
    if (!csrf || !constantTimeEqual(csrf, session.csrfToken)) throw new HttpError(403, 'Jeton de sécurité client invalide.', 'CSRF_REJECTED');
  }
  const state = await loadState(env);
  const client = state.marketClients.find(c => c.id === session.clientId && c.companyId === session.companyId);
  const auth = client ? await getClientAuth(env, client.id) : null;
  if (!client || !auth || Number(auth.version) !== Number(session.authVersion)) throw new HttpError(401, 'Session client invalidée.', 'CLIENT_SESSION_INVALIDATED');
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
  'items', 'sales', 'orders', 'clients', 'marketClients', 'stockEntries', 'stockOutputs',
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
  const saved = await saveState(env, ctx.state);
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

function publicCompany(company) {
  if (!company) return null;
  const allowed = ['id', 'name', 'activity', 'phone', 'email', 'address', 'businessType', 'shopSlug', 'shopBanner', 'shopColor', 'marketWaveBusinessLink', 'marketUsdtTrc20', 'status', 'plan', 'planCode', 'subscriptionEnd'];
  return Object.fromEntries(allowed.map(k => [k, company[k]]));
}

function publicItem(item) {
  const allowed = ['id', 'companyId', 'code', 'name', 'cat', 'detail', 'marketplaceDesc', 'marketplacePromo', 'sell', 'type', 'stockType', 'stock', 'photo', 'marketplaceHidden'];
  return Object.fromEntries(allowed.map(k => [k, item[k]]));
}

async function publicLoadPayload(request, env) {
  const state = await loadState(env);
  const payload = {
    companies: state.companies.map(publicCompany),
    items: state.items.map(publicItem),
    marketClients: [],
    orders: [],
    clientDeletedOrders: {},
    app: state.app || {}
  };
  try {
    const clientAuth = await getClientSession(request, env, false);
    payload.marketClients = [cleanClone(clientAuth.client)];
    payload.orders = state.orders.filter(o => o.companyId === clientAuth.client.companyId && o.clientId === clientAuth.client.id).map(cleanClone);
    payload.clientDeletedOrders[clientAuth.client.id] = (state.clientDeletedOrders || {})[clientAuth.client.id] || [];
    payload.clientSession = publicClientSessionView(clientAuth.session);
  } catch {
    payload.clientSession = null;
  }
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
  const saved = await saveState(env, state);
  const auth = await getAuth(env, user.id);
  const created = await createEmployeeSession(env, user, auth);
  await env.GLOBAL_MARKET_KV.put(rateKey, JSON.stringify({ count: (rec.count || 0) + 1, resetAt: Date.now() + 3600000 }), { expirationTtl: 3600 });
  await audit(env, 'COMPANY_REGISTERED', user.id, company.id, company.name, ip);
  return json({
    success: true,
    session: publicSessionView(created.session),
    data: scopeState(saved.state, user)
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
  await saveState(env, ctx.state);
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
      await saveState(env, state);
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
  await saveState(env, ctx.state);
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
  await saveState(env, ctx.state);
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
  await saveState(env, ctx.state);
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
  await saveState(env, ctx.state);
  await audit(env, 'PASSWORD_RESET', ctx.user.id, target.companyId, target.id, requestIp(request));
  return json({ success: true, temporaryPassword: tempPassword });
}

async function handlePublicClientRegister(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 50_000);
  const state = await loadState(env);
  const companyId = String(body.companyId || '');
  if (!state.companies.some(c => c.id === companyId)) throw new HttpError(404, 'Boutique introuvable.', 'COMPANY_NOT_FOUND');
  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone);
  const email = normalizeIdentifier(body.email);
  const password = validatePassword(body.password, 'client');
  if (!name || !phone) throw new HttpError(400, 'Nom et téléphone obligatoires.', 'MISSING_FIELDS');
  if (await env.GLOBAL_MARKET_KV.get(clientIndexKey(companyId, phone))) throw new HttpError(409, 'Ce téléphone est déjà inscrit.', 'PHONE_EXISTS');
  const client = { id: `clt_${crypto.randomUUID()}`, companyId, name, phone, email, createdAt: new Date().toISOString() };
  state.marketClients.push(client);
  await writeClientCredential(env, client, password);
  await saveState(env, state);
  const created = await createClientSession(env, client, await getClientAuth(env, client.id));
  return json({ success: true, client: cleanClone(client), session: publicClientSessionView(created.session) }, {
    status: 201,
    headers: { 'Set-Cookie': setCookie(CLIENT_SESSION_COOKIE, created.sid, CLIENT_SESSION_TTL) }
  });
}

async function handlePublicClientLogin(request, env) {
  assertSameOrigin(request);
  const body = await readJson(request, 30_000);
  const companyId = String(body.companyId || '');
  const phone = normalizePhone(body.phone);
  const password = String(body.password || '');
  const ip = requestIp(request);
  const rate = await assertLoginRateAllowed(env, ip, `client:${companyId}:${phone}`);
  const state = await loadState(env);
  const clientId = await env.GLOBAL_MARKET_KV.get(clientIndexKey(companyId, phone));
  const client = state.marketClients.find(c => c.id === clientId && c.companyId === companyId);
  const auth = client ? await getClientAuth(env, client.id) : null;
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
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 8_000_000);
  if (String(body.companyId || '') !== ctx.client.companyId) throw new HttpError(403, 'Boutique non autorisée.', 'FORBIDDEN');
  const cart = Array.isArray(body.cart) ? body.cart : [];
  if (!cart.length || cart.length > 100) throw new HttpError(400, 'Panier vide ou invalide.', 'INVALID_CART');
  const orderItems = [];
  for (const line of cart) {
    const item = ctx.state.items.find(i => i.id === line.itemId && i.companyId === ctx.client.companyId && !i.marketplaceHidden);
    if (!item) throw new HttpError(400, 'Un article du panier est introuvable.', 'ITEM_NOT_FOUND');
    const qty = Math.max(1, Math.min(10000, Number(line.qty || 1)));
    const isProduct = !['service', 'services', 'prestation'].includes(String(item.type || '').toLowerCase());
    if (isProduct && item.stockType !== 'unlimited' && Number(item.stock || 0) < qty) throw new HttpError(409, `Stock insuffisant pour : ${item.name}`, 'INSUFFICIENT_STOCK');
    const unit = Number(item.sell || 0);
    orderItems.push({ itemId: item.id, item: item.name, category: item.cat || '', type: isProduct ? 'Produit' : 'Service', qty, unit, total: unit * qty });
  }
  for (const line of orderItems) {
    const item = ctx.state.items.find(i => i.id === line.itemId);
    if (line.type === 'Produit' && item.stockType !== 'unlimited') item.stock = Number(item.stock || 0) - line.qty;
  }
  const total = orderItems.reduce((sum, line) => sum + line.total, 0);
  const method = String(body.paymentMethod || 'WAVE').slice(0, 50);
  const order = {
    id: `cmd_${crypto.randomUUID()}`, companyId: ctx.client.companyId, clientId: ctx.client.id,
    client: ctx.client.name, clientPhone: ctx.client.phone, date: new Date().toISOString(), items: orderItems,
    item: orderItems.map(x => x.item).join(', '), qty: orderItems.reduce((a, x) => a + x.qty, 0), total,
    paymentMethod: method, paymentCurrency: method === 'WAVE' ? 'FCFA' : 'USD',
    paymentAmount: method === 'WAVE' ? total : Number((total / 600).toFixed(2)),
    paymentProofType: String(body.paymentProofType || 'ref'), paymentRef: String(body.paymentRef || '').slice(0, 200),
    paymentCaptureName: String(body.paymentCaptureName || '').slice(0, 200),
    paymentCaptureData: String(body.paymentCaptureData || '').slice(0, 6_000_000),
    validationStatus: 'En attente de validation', deliveryStatus: 'En cours de livraison', afterSaleStatus: '',
    delivery: 'En attente de validation', source: 'lot panier boutique client'
  };
  ctx.state.orders.push(order);
  await saveState(env, ctx.state);
  return json({ success: true, order: cleanClone(order) }, { status: 201 });
}

async function handlePublicOrderDelete(request, env) {
  const ctx = await getClientSession(request, env, true);
  const body = await readJson(request, 20_000);
  const order = ctx.state.orders.find(o => o.id === body.orderId && o.clientId === ctx.client.id && o.companyId === ctx.client.companyId);
  if (!order) throw new HttpError(404, 'Commande introuvable.', 'ORDER_NOT_FOUND');
  order.clientDeletedIds = order.clientDeletedIds || [];
  if (!order.clientDeletedIds.includes(ctx.client.id)) order.clientDeletedIds.push(ctx.client.id);
  ctx.client.deletedOrderIds = ctx.client.deletedOrderIds || [];
  if (!ctx.client.deletedOrderIds.includes(order.id)) ctx.client.deletedOrderIds.push(order.id);
  ctx.state.clientDeletedOrders = ctx.state.clientDeletedOrders || {};
  ctx.state.clientDeletedOrders[ctx.client.id] = ctx.state.clientDeletedOrders[ctx.client.id] || [];
  if (!ctx.state.clientDeletedOrders[ctx.client.id].includes(order.id)) ctx.state.clientDeletedOrders[ctx.client.id].push(order.id);
  await saveState(env, ctx.state);
  return json({ success: true });
}

async function handleApi(request, env) {
  needBindings(env);
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/health' && request.method === 'GET') {
      await ensureDB(env);
      const [auth, d1Probe] = await Promise.all([
        getAuth(env, SUPER_ADMIN_ID),
        env.GLOBAL_MARKET_D1.prepare('SELECT 1 AS ok').first()
      ]);
      return json({
        ok: Boolean(d1Probe?.ok), app: APP_NAME, kv: true, d1: Boolean(d1Probe?.ok),
        securityInitialized: Boolean(auth?.hash),
        setupRequired: !auth?.hash,
        superAdminEmailConfigured: Boolean(configuredSuperAdminIdentifier(env)),
        superAdminPasswordSecretConfigured: Boolean(String(env.SUPER_ADMIN_INITIAL_PASSWORD || '')),
        time: new Date().toISOString()
      });
    }

    if (url.pathname === '/api/login' && request.method === 'POST') return await handleLogin(request, env);
    if (url.pathname === '/api/register-company' && request.method === 'POST') return await handleRegisterCompany(request, env);
    if (url.pathname === '/api/password/change' && request.method === 'POST') return await handlePasswordChange(request, env);
    if (url.pathname === '/api/password/request-reset' && request.method === 'POST') return await handlePasswordResetRequest(request, env);

    if (url.pathname === '/api/session' && request.method === 'GET') {
      try {
        const ctx = await getEmployeeSession(request, env, false);
        return json({ session: publicSessionView(ctx.session), data: scopeState(ctx.state, ctx.user) });
      } catch {
        return json({ session: null });
      }
    }
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

    if (url.pathname === '/api/load' && request.method === 'GET') {
      const ctx = await getEmployeeSession(request, env, false);
      return json(scopeState(ctx.state, ctx.user));
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
      const merged = mergeScopedState(ctx.state, incoming, ctx.user);
      const result = await saveState(env, merged);
      return json({ success: true, message: 'Sauvegarde sécurisée effectuée.', d1: result.d1, storage: result.storage });
    }

    if (url.pathname === '/api/companies/delete' && request.method === 'POST') return await handleDeleteCompany(request, env);

    if (url.pathname === '/api/users/create' && request.method === 'POST') return await handleCreateUser(request, env);
    if (url.pathname === '/api/users/update' && request.method === 'POST') return await handleUpdateUser(request, env);
    if (url.pathname === '/api/users/delete' && request.method === 'POST') return await handleDeleteUser(request, env);
    if (url.pathname === '/api/users/reset-password' && request.method === 'POST') return await handleResetUserPassword(request, env);

    if (url.pathname === '/api/public/load' && request.method === 'GET') return json(await publicLoadPayload(request, env));
    if (url.pathname === '/api/public/client/register' && request.method === 'POST') return await handlePublicClientRegister(request, env);
    if (url.pathname === '/api/public/client/login' && request.method === 'POST') return await handlePublicClientLogin(request, env);
    if (url.pathname === '/api/public/client/session' && request.method === 'DELETE') {
      const sid = getCookie(request, CLIENT_SESSION_COOKIE);
      if (sid) await env.GLOBAL_MARKET_KV.delete(`client-session:${sid}`);
      return json({ success: true }, { headers: { 'Set-Cookie': setCookie(CLIENT_SESSION_COOKIE, '', 0) } });
    }
    if (url.pathname === '/api/public/order' && request.method === 'POST') return await handlePublicOrder(request, env);
    if (url.pathname === '/api/public/order/delete' && request.method === 'POST') return await handlePublicOrderDelete(request, env);

    throw new HttpError(404, `API introuvable : ${url.pathname}`, 'NOT_FOUND');
  } catch (error) {
    return errorResponse(error);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);

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

    headers.set('X-Global-Market-Cache-Fix', '2026-07-26-r1');
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers
    });
  }
};
