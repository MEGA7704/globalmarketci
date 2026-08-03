# GLOBAL MARKET — Projet Cloudflare Pages + GitHub

Projet complet prêt à être placé à la racine du dépôt GitHub puis déployé par Cloudflare Pages.

## Configuration Cloudflare obligatoire

| Paramètre | Valeur |
|---|---|
| Branche de production | `main` |
| Commande de version | `npm run build` |
| Répertoire de sortie | `public` |
| Répertoire racine | laisser vide |
| Infrastructure prédéfinie | `Aucun` |

Le fichier `wrangler.json` confirme également :

```json
"pages_build_output_dir": "public"
```

## Structure importante

```text
.github/workflows/verify-build.yml
cloudflare/schema.sql
public/
  assets/
    app.js
    app-sales.js
    app-admin.js
    app-bootstrap.js
    style.css
    style-sales.css
    style-admin.css
  server/
    checkout.js
    session-utils.js
  _worker.js
  _routes.json
  _headers
  index.html
scripts/
  build.mjs
  validate.mjs
  test-isolation.mjs
package.json
wrangler.json
README.md
```

Fichiers principaux :

```text
Noyau navigateur       : public/assets/app.js
Ventes et rapports     : public/assets/app-sales.js
Administration et stock: public/assets/app-admin.js
Démarrage              : public/assets/app-bootstrap.js
Styles                  : public/assets/style*.css
Worker                  : public/_worker.js
Encaissement serveur    : public/server/checkout.js
```

## Commandes disponibles

```bash
npm install
npm run validate
npm run build
npm run test:isolation
npm run test:e2e
npm run check
npm run dev
npm run deploy
```

`npm run build` vérifie la syntaxe, la sécurité, les bindings KV/D1, puis génère des fichiers CSS et JavaScript versionnés dans `public`.

## Sécurité des comptes

Aucun identifiant de connexion ni mot de passe réel n’est inclus dans le programme, le dépôt GitHub ou les README.

Dans **Cloudflare → Workers & Pages → GLOBAL MARKET → Settings → Variables and Secrets**, créez deux secrets chiffrés :

```text
SUPER_ADMIN_EMAIL             = <IDENTIFIANT_SECRET À CONFIGURER>
SUPER_ADMIN_INITIAL_PASSWORD  = <MOT_DE_PASSE_SECRET FORT À CONFIGURER>
```

Ne remplacez jamais ces valeurs dans `wrangler.json`, `public/_worker.js`, `app.js` ou un README. Les valeurs réelles doivent rester uniquement dans les secrets Cloudflare.

Le mot de passe est transformé côté Worker en empreinte PBKDF2-SHA256 avec sel aléatoire. Il n’est pas transmis au navigateur dans les données de l’application.

## Ressources Cloudflare

Les bindings nécessaires sont :

```text
GLOBAL_MARKET_KV
GLOBAL_MARKET_D1
```

Les identifiants techniques des ressources restent dans `wrangler.json` car ils sont nécessaires au déploiement et ne constituent pas des identifiants de connexion utilisateur.

## Fiche d’inscription des entreprises

La fenêtre d’inscription est compacte et ne possède aucun défilement interne sur ordinateur. Elle est organisée en quatre blocs :

1. **Information de l’entreprise** : raison sociale, forme juridique, RCCM et compte contribuable.
2. **Spécialité** : type de commerce et activité principale.
3. **ID du responsable** : gérant, adresse et téléphone.
4. **Identifiant de connexion** : e-mail et mot de passe administrateur.

Tous les identifiants HTML, la validation, la création de l’entreprise et la route `POST /api/register-company` sont conservés.

## Plans intégrés

- Plan Free : accès complet pendant 21 jours.
- Plan Business : accès complet pendant 365 jours.
- Montant Business : 26 300 FCFA.
- Paiement Wave : `https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=26300`

Pour une entreprise Free, le rappel professionnel s’affiche à l’ouverture des sections et toutes les 15 minutes.

## Mise en ligne sur GitHub

1. Décompressez le ZIP.
2. Envoyez son contenu directement à la racine de la branche `main`.
3. Vérifiez que `package.json`, `wrangler.json`, `public/` et `scripts/` sont visibles à la racine.
4. Créez un nouveau commit.
5. Relancez le déploiement Cloudflare.

Le journal doit afficher :

```text
Executing user command: npm run build
[build] Répertoire de sortie : public
[build] Construction terminée avec succès.
```


## Correction 2.5 — connexion immédiate et inscription accélérée

- L'écran de connexion est rendu immédiatement, avant la vérification asynchrone de session.
- Les réponses sécurisées `/api/login`, `/api/session` et `/api/register-company` renvoient directement les données autorisées de l'entreprise.
- La seconde lecture complète `/api/load` est supprimée lorsque ces données sont déjà disponibles.
- Les hashes, sels et mots de passe restent exclusivement côté Worker/KV et ne sont jamais renvoyés au navigateur.
- Le bouton d'inscription affiche son état de chargement avant l'appel réseau et bloque les doubles clics.


## Correction 2.7 — Connexion et inscription

- La page de connexion est toujours affichée en premier.
- La fiche d’inscription reste cachée au chargement.
- Elle s’ouvre uniquement après clic sur le bouton **INSCRIPTION**.
- La fenêtre est centrée horizontalement et verticalement.
- Les champs de chaque ligne utilisent toute la largeur disponible avec un alignement justifié.
- Les routes API, KV, D1 et les protections de sécurité restent inchangés.


## Correction Super Admin 2.8

Voir `README_CORRECTION_SUPER_ADMIN_2_8.md`. Les secrets `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_INITIAL_PASSWORD` doivent être configurés dans l’environnement Production de Cloudflare.


## Version 3.0.0 — Tableau de bord MEGA SERVICES

Correction ciblée de la section **Accueil / Tableau de bord** uniquement :

- en-tête MEGA SERVICES avec plan, profil, notifications, aide et personnalisation ;
- huit cartes d’accès rapide dynamiques en deux lignes de quatre ;
- résumé du jour avec commandes, ventes, articles et nouveaux clients ;
- bloc Performance avec graphique SVG des sept derniers jours ;
- résumé annuel dynamique ;
- design SaaS premium, responsive, avec la palette verte, dorée, violette et bleue demandée.

Les autres sections, le système de connexion, l’inscription, le Super Admin, les routes API, Cloudflare KV et D1 ne sont pas modifiés.

### Configuration Cloudflare

```text
Branche de production : main
Commande de version : npm run build
Répertoire de sortie : public
Répertoire racine : vide
```


## Version 3.0.1 — Identité GLOBAL MARKET

- le nouveau tableau de bord premium est disponible pour toutes les entreprises inscrites ;
- le nom du programme affiché reste **GLOBAL MARKET** ;
- le nom de l’entreprise connectée apparaît comme espace entreprise dynamique ;
- aucune modification de la connexion, de l’inscription, du Super Admin, de KV, de D1 ou du Worker de sécurité.

## Version 4.0.0 — Isolation réelle des entreprises

- aucune nouvelle ressource KV ou D1 n’est nécessaire ;
- création d’un catalogue global léger dans le KV existant ;
- création d’un état séparé pour chaque `company_id` dans le KV et D1 existants ;
- migration automatique depuis `company:global_market_all` ;
- conservation de l’ancien état comme sauvegarde historique en lecture seule ;
- détection des sauvegardes obsolètes avec réponse `409 COMPANY_DATA_CONFLICT` ;
- sérialisation des sauvegardes dans le navigateur ;
- le Super Admin ne réécrit plus les données opérationnelles de toutes les entreprises à chaque modification.

Documentation détaillée : `README_ISOLATION_MULTI_ENTREPRISES_4_0.md`.

## Version 4.1.0 — Stockage métier D1 normalisé

La version 4.1 remplace les gros états JSON par entreprise par des enregistrements stockés dans des tables D1 dédiées.

Points principaux :

- aucun nouveau KV ni nouveau D1 à créer ;
- produits, ventes, paiements, commandes, clients et stocks séparés par table ;
- snapshots atomiques avec révision par entreprise ;
- migration automatique depuis les versions 4.0 et antérieures ;
- ancien stockage conservé comme sauvegarde historique et non réécrit ;
- gros enregistrements découpés en fragments D1 ;
- conservation des dix derniers snapshots ;
- initialisation du schéma mise en cache dans chaque instance Worker pour réduire la latence.

Voir `README_STOCKAGE_D1_NORMALISE_4_1.md`.


## Version 4.2.0 — Encaissement transactionnel et modules séparés

- nouvelle route sécurisée `POST /api/cart/checkout` ;
- vérification du stock et validation des ventes côté Worker ;
- protection idempotente contre les doubles clics ;
- numéro unique par encaissement ;
- mouvement de stock enregistré avec chaque validation ;
- panier Caisse isolé par utilisateur ;
- conflit propre lorsque deux caissiers tentent de vendre le dernier article ;
- 22 déclarations de fonctions dupliquées supprimées ;
- JavaScript et CSS découpés en modules plus petits ;
- Worker principal ramené sous 100 000 octets grâce aux modules serveur ;
- migration SQL `0007_transactional_checkout.sql` ;
- tests de concurrence, d’idempotence, d’isolation et de chargement inclus.

Documentation détaillée : `README_GLOBAL_MARKET_SOLIDE_4_2.md`.


## Version 4.4.0 — Livraison et paiement boutique

Voir `README_BOUTIQUE_LIVRAISON_PAIEMENT_4_4.md`.

## Version 4.5.0 — Boutique pleine page, formulaire défilable et pagination

- formulaire de validation de commande défilable verticalement ;
- boutique officielle affichée sur toute la largeur utile de l'écran ;
- bannière principale réduite d'environ 30 % ;
- catalogue limité à 16 produits ou services par page ;
- navigation Précédent / Suivant compatible avec les filtres et la recherche ;
- logique de livraison, paiement, sécurité, KV et D1 de la version 4.4 conservée.
