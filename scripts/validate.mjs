import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const jsModules = [
  'public/assets/app.js',
  'public/assets/app-sales.js',
  'public/assets/app-admin.js',
  'public/assets/app-bootstrap.js'
];
const cssModules = [
  'public/assets/style.css',
  'public/assets/style-sales.css',
  'public/assets/style-admin.css'
];
const required = [
  'public/index.html',
  ...jsModules,
  ...cssModules,
  'public/_worker.js',
  'public/server/checkout.js',
  'public/server/session-utils.js',
  'public/_routes.json',
  'cloudflare/schema.sql',
  'cloudflare/migrations/0007_transactional_checkout.sql',
  'wrangler.json'
];

function fail(message) {
  console.error(`[validate] ${message}`);
  process.exit(1);
}

for (const file of required) if (!fs.existsSync(file)) fail(`Fichier obligatoire introuvable : ${file}`);

const moduleSources = jsModules.map(file => ({ file, source: fs.readFileSync(file, 'utf8') }));
for (const { file, source } of moduleSources) {
  try {
    new Function(source);
    console.log(`[validate] ${file} : syntaxe valide`);
  } catch (error) {
    console.error(`[validate] Erreur JavaScript dans ${file}`);
    console.error(error);
    process.exit(1);
  }
}

await import(`${pathToFileURL(path.resolve('public/server/checkout.js')).href}?v=${Date.now()}`);
await import(`${pathToFileURL(path.resolve('public/_worker.js')).href}?v=${Date.now()}`);
console.log('[validate] Modules Worker et encaissement : syntaxe valide');

const app = moduleSources.map(item => item.source).join('\n');
const worker = fs.readFileSync('public/_worker.js', 'utf8');
const checkout = fs.readFileSync('public/server/checkout.js', 'utf8');
const schema = fs.readFileSync('cloudflare/schema.sql', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const wrangler = JSON.parse(fs.readFileSync('wrangler.json', 'utf8'));

for (const route of ["/api/login", "/api/load", "/api/save", "/api/cart/checkout"]) {
  if (!worker.includes(`url.pathname === '${route}'`)) fail(`Route ${route} absente.`);
}

const architectureChecks = [
  ["STORAGE_VERSION = 7", 'version de stockage 7'],
  ["storageMode: 'transactional-checkout-v7'", 'mode d’encaissement transactionnel'],
  ['COMPANY_ENTITY_TABLES', 'tables métiers D1 dédiées'],
  ['gm_company_storage_meta', 'révisions par entreprise'],
  ['gm_company_snapshots', 'snapshots atomiques'],
  ['writeNormalizedCompanyState', 'sauvegarde normalisée'],
  ['readNormalizedCompanyState', 'lecture normalisée'],
  ['COMPANY_DATA_CONFLICT', 'protection de concurrence'],
  ['executeCartCheckout', 'moteur d’encaissement serveur'],
  ['gm_checkout_requests', 'idempotence des encaissements']
];
for (const [marker, label] of architectureChecks) {
  if (!(worker.includes(marker) || checkout.includes(marker) || schema.includes(marker))) fail(`Architecture incomplète : ${label}.`);
}

const checkoutChecks = [
  ['INSERT OR IGNORE INTO gm_checkout_requests', 'réservation idempotente'],
  ['STOCK_INSUFFICIENT', 'contrôle de stock serveur'],
  ['expectedRevision', 'contrôle de révision'],
  ['checkoutId', 'numéro unique d’encaissement'],
  ['stockMovements', 'journal des mouvements de stock'],
  ['saveCompanyFromState', 'publication atomique du nouvel état']
];
for (const [marker, label] of checkoutChecks) if (!checkout.includes(marker)) fail(`Encaissement serveur incomplet : ${label}.`);

const functionOccurrences = new Map();
const functionPattern = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
for (const { file, source } of moduleSources) {
  for (const match of source.matchAll(functionPattern)) {
    const list = functionOccurrences.get(match[1]) || [];
    list.push(file);
    functionOccurrences.set(match[1], list);
  }
}
const duplicateFunctions = [...functionOccurrences.entries()].filter(([, files]) => files.length > 1);
if (duplicateFunctions.length) {
  fail(`Fonctions dupliquées détectées : ${duplicateFunctions.map(([name, files]) => `${name} (${files.length})`).join(', ')}`);
}
console.log(`[validate] ${functionOccurrences.size} fonctions déclarées, aucun nom dupliqué.`);

for (const { file, source } of moduleSources) {
  const bytes = Buffer.byteLength(source);
  if (bytes > 270_000) fail(`${file} reste trop volumineux (${bytes} octets).`);
}
for (const file of cssModules) {
  const bytes = fs.statSync(file).size;
  if (bytes > 270_000) fail(`${file} reste trop volumineux (${bytes} octets).`);
}

const workerBytes = fs.statSync('public/_worker.js').size;
if (workerBytes >= 100_000) fail(`public/_worker.js doit rester sous 100 000 octets (${workerBytes} octets).`);

const expectedOrder = [
  ['style', 'css'], ['style-sales', 'css'], ['style-admin', 'css'],
  ['build-version', 'js'], ['app', 'js'], ['app-sales', 'js'], ['app-admin', 'js'], ['app-bootstrap', 'js']
];
let last = -1;
for (const [base, ext] of expectedOrder) {
  const pattern = new RegExp(`assets/${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.[a-f0-9]{12})?\\.${ext}`);
  const match = pattern.exec(html);
  const position = match?.index ?? -1;
  if (position < 0 || position < last) fail(`Ordre des modules incorrect ou fichier absent dans index.html : ${base}.${ext}`);
  last = position;
}

const registrationChecks = [
  'FICHE D’INSCRIPTION DES ENTREPRISES', 'id="cName"', 'id="cLegalForm"', 'id="cRccm"',
  'id="cTaxAccount"', 'id="cType"', 'id="cActivity"', 'id="cOwner"', 'id="cAddress"',
  'id="cPhone"', 'id="cEmail"', 'id="cPass"', 'CRÉATION EN COURS…'
];
for (const marker of registrationChecks) if (!app.includes(marker)) fail(`Composant d’inscription incomplet : ${marker}`);

const planChecks = [
  'const FREE_PLAN_DAYS=21;', 'const BUSINESS_PLAN_DAYS=365;', 'const BUSINESS_PLAN_AMOUNT=26300;',
  'https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=26300', '15*60*1000',
  'Acheter mon plan Business', 'Compris'
];
for (const marker of planChecks) if (!app.includes(marker)) fail(`Gestion des plans incomplète : ${marker}`);

const publicShopOrderChecks = [
  'publicDeliveryRate', 'publicDeliveryFee', 'Frais de livraison', 'Payer à la livraison',
  'Payer maintenant', 'publicTransactionId', 'TRANSACTION_ID_REQUIRED', 'marketplaceDeliveryFee',
  'paymentChoice', 'deliveryFeeRate', 'paymentStatus'
];
for (const marker of publicShopOrderChecks) if (!(app.includes(marker) || worker.includes(marker))) fail(`Commande boutique incomplète : ${marker}`);

const saleChecks = [
  'id="saleCartClientsServed"', 'clientsServed,unit,total', 'r.clientsServed+=saleClientsServedValue(s)',
  'initFlexibleHorizontalMenu', 'saleProfessionalCart', 'ENCAISSER ET VALIDER', "saleStatus:'cart'",
  'openPendingCartLineFromClick', 'saleProCartLineClickable', '/api/cart/checkout', 'createCheckoutIdempotencyKey'
];
for (const marker of saleChecks) if (!app.includes(marker)) fail(`Fonction Vente incomplète : ${marker}`);

if (/passwordHash|passwordSalt|derivePasswordHash/.test(app)) fail('Une logique sensible de mot de passe est présente dans le navigateur.');
if (/localStorage\s*\.\s*setItem\s*\(/.test(app)) fail('Une écriture localStorage subsiste dans le navigateur.');
if (worker.includes('GLOBAL_MARKET_KV.put(LEGACY_STATE_KEY')) fail('L’ancien état global ne doit plus être réécrit.');
if (/GLOBAL_MARKET_KV\.put\(legacyCompanyStateKey/.test(worker)) fail('Un gros état entreprise ne doit plus être écrit dans KV.');

if (wrangler.pages_build_output_dir !== 'public') fail('pages_build_output_dir doit être exactement "public".');
if (!wrangler.kv_namespaces?.some(item => item.binding === 'GLOBAL_MARKET_KV')) fail('Binding KV GLOBAL_MARKET_KV absent.');
if (!wrangler.d1_databases?.some(item => item.binding === 'GLOBAL_MARKET_D1')) fail('Binding D1 GLOBAL_MARKET_D1 absent.');

console.log('[validate] Modules, Worker, sécurité, encaissement, KV, D1 et configuration Cloudflare : valides');
