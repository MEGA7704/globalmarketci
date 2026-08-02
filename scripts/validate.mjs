import fs from 'node:fs';

const required = [
  'public/index.html',
  'public/assets/app.js',
  'public/assets/style.css',
  'public/_worker.js',
  'public/_routes.json',
  'wrangler.json'
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`[validate] Fichier obligatoire introuvable : ${file}`);
    process.exit(1);
  }
}

const app = fs.readFileSync('public/assets/app.js', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');
const wrangler = JSON.parse(fs.readFileSync('wrangler.json', 'utf8'));

try {
  new Function(app);
  console.log('[validate] public/assets/app.js : syntaxe valide');
} catch (error) {
  console.error('[validate] Erreur JavaScript dans public/assets/app.js');
  console.error(error);
  process.exit(1);
}

if (!worker.includes("url.pathname === '/api/login' && request.method === 'POST'")) {
  console.error('[validate] Route sécurisée POST /api/login absente.');
  process.exit(1);
}
if (!worker.includes("url.pathname === '/api/load'")) {
  console.error('[validate] Route /api/load absente.');
  process.exit(1);
}
if (!worker.includes("url.pathname === '/api/save'")) {
  console.error('[validate] Route /api/save absente.');
  process.exit(1);
}

const isolationChecks = [
  ["CATALOG_STATE_KEY = 'state:catalog:v5'", 'catalogue global léger'],
  ["STORAGE_VERSION = 6", 'version de stockage normalisé'],
  ['COMPANY_ENTITY_TABLES', 'tables métiers D1 dédiées'],
  ['gm_company_storage_meta', 'métadonnées et révisions par entreprise'],
  ['gm_company_snapshots', 'snapshots atomiques par entreprise'],
  ['writeNormalizedCompanyState', 'sauvegarde D1 par enregistrements'],
  ['readNormalizedCompanyState', 'lecture D1 par enregistrements'],
  ['COMPANY_DATA_CONFLICT', 'détection des modifications concurrentes'],
  ['migrateToCompanyIsolation', 'migration automatique de l’ancien stockage'],
  ['legacyKeyPreserved', 'conservation de la sauvegarde historique']
];
for (const [marker, label] of isolationChecks) {
  if (!worker.includes(marker)) {
    console.error(`[validate] Isolation multi-entreprises incomplète : ${label}.`);
    process.exit(1);
  }
}
if (!app.includes('CLOUD_SAVE_IN_FLIGHT') || !app.includes('CLOUD_SAVE_QUEUED')) {
  console.error('[validate] Sérialisation des sauvegardes navigateur absente.');
  process.exit(1);
}
if (worker.includes('GLOBAL_MARKET_KV.put(LEGACY_STATE_KEY')) {
  console.error('[validate] L’ancien état global ne doit plus être réécrit.');
  process.exit(1);
}
if (/GLOBAL_MARKET_KV\.put\(legacyCompanyStateKey/.test(worker)) {
  console.error('[validate] Un gros état entreprise ne doit plus être écrit dans KV.');
  process.exit(1);
}


if (!worker.includes("url.pathname === '/api/companies/delete'")) {
  console.error('[validate] Route sécurisée de suppression entreprise absente.');
  process.exit(1);
}
if (!app.includes('deleteCompanyAccount') || !app.includes('Supprimer le compte')) {
  console.error('[validate] Action Super Admin de suppression entreprise absente.');
  process.exit(1);
}

const registrationChecks = [
  ['FICHE D’INSCRIPTION DES ENTREPRISES', 'titre de la fiche d’inscription'],
  ['id="cName"', 'champ raison sociale'],
  ['id="cLegalForm"', 'champ forme juridique'],
  ['id="cRccm"', 'champ RCCM'],
  ['id="cTaxAccount"', 'champ compte contribuable'],
  ['id="cType"', 'champ type de commerce'],
  ['Produits et services', 'option Produits et services'],
  ['Gestion commerciale générale', 'option Gestion commerciale générale'],
  ['id="cActivity"', 'champ activité principale'],
  ['id="cOwner"', 'champ gérant'],
  ['id="cAddress"', 'champ adresse'],
  ['id="cPhone"', 'champ téléphone'],
  ['id="cEmail"', 'champ e-mail'],
  ['id="cPass"', 'champ mot de passe administrateur'],
  ['CRÉATION EN COURS…', 'état de chargement du bouton d’inscription']
];
for (const [needle, label] of registrationChecks) {
  if (!app.includes(needle)) {
    console.error(`[validate] Composant d’inscription incomplet : ${label}.`);
    process.exit(1);
  }
}

const planChecks = [
  ['const FREE_PLAN_DAYS=21;', 'Plan Free de 21 jours'],
  ['const BUSINESS_PLAN_DAYS=365;', 'Plan Business de 365 jours'],
  ['const BUSINESS_PLAN_AMOUNT=26300;', 'montant Business de 26 300 FCFA'],
  ["https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=26300", 'lien Wave Business'],
  ['15*60*1000', 'rappel automatique toutes les 15 minutes'],
  ['Acheter mon plan Business', 'bouton achat Business'],
  ['Compris', 'bouton de fermeture du rappel Free']
];
for (const [needle, label] of planChecks) {
  if (!app.includes(needle)) {
    console.error(`[validate] Gestion des plans incomplète : ${label}.`);
    process.exit(1);
  }
}

const targetedSaleChecks = [
  ['id="saleCartClientsServed"', 'champ Nb de Clients servis dans le formulaire de vente'],
  ['clientsServed,unit,total', 'enregistrement du nombre de clients servis'],
  ['r.clientsServed+=saleClientsServedValue(s)', 'comptabilisation dans le bilan détaillé'],
  ['initFlexibleHorizontalMenu', 'menu horizontal flexible au défilement'],
  ['saleProfessionalCart', 'panier professionnel intégré à la vente'],
  ['ENCAISSER ET VALIDER', 'bouton d’encaissement du panier'],
  ["saleStatus:'cart'", 'mise en attente des articles avant encaissement'],
  ['openPendingCartLineFromClick', 'ouverture de la modification en cliquant sur une ligne du panier'],
  ['saleProCartLineClickable', 'style cliquable des lignes du panier']
];
for (const [needle, label] of targetedSaleChecks) {
  if (!app.includes(needle)) {
    console.error(`[validate] Correction ciblée incomplète : ${label}.`);
    process.exit(1);
  }
}

if (/passwordHash|passwordSalt|derivePasswordHash/.test(app)) {
  console.error('[validate] Une logique sensible de mot de passe est présente dans le navigateur.');
  process.exit(1);
}
if (/localStorage\s*\.\s*setItem\s*\(/.test(app)) {
  console.error('[validate] Une écriture localStorage subsiste dans app.js.');
  process.exit(1);
}
if (wrangler.pages_build_output_dir !== 'public') {
  console.error('[validate] pages_build_output_dir doit être exactement "public".');
  process.exit(1);
}
if (!wrangler.kv_namespaces?.some(item => item.binding === 'GLOBAL_MARKET_KV')) {
  console.error('[validate] Binding KV GLOBAL_MARKET_KV absent.');
  process.exit(1);
}
if (!wrangler.d1_databases?.some(item => item.binding === 'GLOBAL_MARKET_D1')) {
  console.error('[validate] Binding D1 GLOBAL_MARKET_D1 absent.');
  process.exit(1);
}

console.log('[validate] Worker, sécurité, KV, D1 et configuration Cloudflare : valides');
