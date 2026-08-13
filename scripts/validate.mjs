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

const routes = JSON.parse(fs.readFileSync('public/_routes.json', 'utf8'));
if (JSON.stringify(routes.include) !== JSON.stringify(['/api/*'])) {
  console.error('[validate] Anti-503 invalide : seul /api/* doit invoquer le Worker.');
  process.exit(1);
}
if (!worker.includes('KV_STATE_MAX_BYTES') || !worker.includes('ensureLegacyCredentialsMigrated')) {
  console.error('[validate] Protection anti-503 KV/D1 incomplète.');
  process.exit(1);
}
if (!worker.includes('writeCompanySnapshot') || !worker.includes('company_state_chunks') || !worker.includes('runD1Batches')) {
  console.error('[validate] Sauvegarde D1 par entreprise anti-503 incomplète.');
  process.exit(1);
}
if (!worker.includes('writeGlobalStateV2') || !worker.includes('global_state_chunks_v2') || !worker.includes("storage: 'd1-versioned'")) {
  console.error('[validate] Sauvegarde globale D1 versionnée anti-503 incomplète.');
  process.exit(1);
}
if (!app.includes('CLOUD_SAVE_IN_FLIGHT') || !app.includes('sendCloudSavePayload') || !app.includes('isTransientCloudSaveError')) {
  console.error('[validate] File d’attente et reprises automatiques de sauvegarde absentes.');
  process.exit(1);
}
if (worker.includes("new HttpError(503, 'Initialisation de sécurité requise")) {
  console.error('[validate] Une erreur de configuration est encore exposée comme 503.');
  process.exit(1);
}

if (!worker.includes("url.pathname === '/api/save-delta'") || !worker.includes('company_state_patches') || !worker.includes('persistStateDelta')) {
  console.error('[validate] Sauvegarde incrémentielle D1 anti-503 V4.2 incomplète.');
  process.exit(1);
}
if (!worker.includes("saveMode: 'incremental-d1-delta-v7'") || !worker.includes('deleted_companies')) {
  console.error('[validate] Mode de stockage incrémentiel ou suppression logique sécurisée absent.');
  process.exit(1);
}
if (!app.includes('buildCloudDelta') || !app.includes("'/api/save-delta'") || !app.includes('scheduleCloudSaveRetry')) {
  console.error('[validate] File de sauvegarde différentielle et reprise automatique absentes.');
  process.exit(1);
}
if (app.includes('La sauvegarde sécurisée a échoué :')) {
  console.error('[validate] L’ancien message bloquant Erreur serveur 503 est encore présent.');
  process.exit(1);
}

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
  ['saleBatchClients', 'champ Nb de Clients servis dans le formulaire multi-lignes'],
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

const connectedCompanyReportChecks = [
  ['companyReportProfile', 'profil dynamique de l’entreprise connectée'],
  ['buildBilanOfficialReport', 'modèle A4 du rapport bilan'],
  ['s.companyId===company.id&&isInActiveExercise(s)', 'filtrage des ventes par entreprise et exercice'],
  ['getObligationsForMonth(d,company.id', 'filtrage des obligations mensuelles par entreprise'],
  ['Exporter Excel (CSV)', 'export Excel du rapport bilan'],
  ['openBilanPdfPage', 'aperçu PDF A4 dédié'],
  ['Imprimer / Télécharger PDF', 'bouton PDF A4 dédié'],
  ['Rapport sécurisé : profil, ventes, charges et obligations', 'indication d’isolation des données']
];
for (const [needle, label] of connectedCompanyReportChecks) {
  if (!app.includes(needle)) {
    console.error(`[validate] Rapport entreprise connectée incomplet : ${label}.`);
    process.exit(1);
  }
}
const unifiedPrintHeaderChecks = [
  ['globalPrintHeaderHTML(company,documentTitle', 'entête PDF dynamique avec titre de document'],
  ['g3phIdentity', 'bloc identité de l’entreprise dans l’entête'],
  ['g3phDocumentTitle', 'titre dynamique de chaque impression'],
  ['refreshGlobalPrintHeaderTitle', 'mise à jour automatique du titre avant impression'],
  ["globalPrintHeaderHTML(company,'FACTURE / REÇU DE VENTE')", 'entête des factures et reçus'],
  ["globalPrintHeaderHTML(company,'RAPPORT GÉNÉRAL DÉTAILLÉ DES SERVICES VENDUS')", 'entête des rapports de ventes'],
  ["globalPrintHeaderHTML(company,'TABLEAU DE GESTION SUR 12 MOIS')", 'entête de la gestion annuelle'],
  ["globalPrintHeaderHTML(company,'BILAN JOUR')", 'entête du bilan journalier'],
  ["globalPrintHeaderHTML(company,'REÇU OFFICIEL D’ABONNEMENT')", 'entête du reçu d’abonnement']
];
for (const [needle, label] of unifiedPrintHeaderChecks) {
  if (!app.includes(needle)) {
    console.error(`[validate] Entête PDF universel incomplet : ${label}.`);
    process.exit(1);
  }
}

const reportStyle = fs.readFileSync('public/assets/style.css', 'utf8');
if (!reportStyle.includes('.bilanOfficialReport') || !reportStyle.includes('@page{size:A4 portrait;margin:7mm 7mm 14mm}') || !reportStyle.includes('max-width:196mm!important') || !reportStyle.includes('GLOBAL MARKET V4.1 - ENTETE OFFICIEL UNIFIE') || !reportStyle.includes('.printCompanyHeader .g3phIdentity')) {
  console.error('[validate] Mise en page A4 centrée et anti-débordement du rapport bilan absente.');
  process.exit(1);
}

const officialShopChecks = [
  ['officialStore', 'nouvelle boutique officielle premium'],
  ['officialHeaderMain', 'en-tête e-commerce responsive'],
  ['officialShopSearch', 'recherche produits et marques'],
  ['filterOfficialShop', 'filtres de catalogue'],
  ['addToPublicCart', 'panier public conservé'],
  ['deliveryFeeRateForSubtotal', 'barème automatique des frais de livraison'],
  ['PAIEMENT À LA LIVRAISON', 'paiement à la livraison'],
  ['publicTransactionId', 'champ identifiant de transaction'],
  ['OFFICIAL_SHOP_PAGE_SIZE=16', 'pagination limitée à 16 éléments'],
  ['officialShopPagination', 'bouton Suivant du catalogue']
];
for (const [needle, label] of officialShopChecks) {
  if (!app.includes(needle) && !fs.readFileSync('public/assets/style.css', 'utf8').includes(needle)) {
    console.error(`[validate] Boutique officielle incomplète : ${label}.`);
    process.exit(1);
  }
}


const v44Checks = [
  ['saleCartBatchCard', 'popup premium multi-lignes'],
  ['saleCartBatchRow', 'lignes multiples du popup'],
  ['Ajouter une ligne', 'ajout dynamique de ligne'],
  ['ENREGISTRER LES SERVICES', 'validation multi-lignes'],
  ['Ajout multiple au panier', 'transfert de toutes les lignes vers le panier'],
  ['serviceReportPageSize(){return 30;}', 'pagination rapports à 30 lignes'],
  ['serviceReportPagination', 'contrôles Précédent / Suivant'],
  ['serviceSaleRowClickable', 'lignes de rapport cliquables'],
  ['contractClientListPage hidden', 'liste clients masquée par défaut']
];
for (const [needle, label] of v44Checks) {
  if (!app.includes(needle) && !reportStyle.includes(needle)) {
    console.error(`[validate] GLOBAL MARKET V4.4 incomplet : ${label}.`);
    process.exit(1);
  }
}
if (app.includes('Catégories populaires') || app.includes('officialTrustStats') || app.includes('GLOBAL MARKET • Caisse enregistreuse')) {
  console.error('[validate] Des sections supprimées en V4.3 sont revenues dans l’interface.');
  process.exit(1);
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
