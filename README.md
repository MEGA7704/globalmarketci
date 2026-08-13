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
    style.css
  _worker.js
  _routes.json
  _headers
  index.html
scripts/
  build.mjs
  validate.mjs
package.json
wrangler.json
README.md
```

Fichiers principaux :

```text
Application : public/assets/app.js
Styles      : public/assets/style.css
Worker      : public/_worker.js
```

## Commandes disponibles

```bash
npm install
npm run build
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

## V4.8 — Connexion D1 prioritaire

La connexion Administrateur, Caisse et Client utilise désormais D1 en priorité pour les secrets et les sessions. Les anciens secrets KV sont migrés de façon ciblée à leur première utilisation. Les messages et compteurs visibles « service cloud occupé / nouvelle tentative » ont été supprimés de l’interface.


## V4.9 — Articles Marketplace visibles
- Correction du chargement des boutiques publiques dont le lien est basé sur le nom de l’entreprise.
- Résolution par `shopSlug` ou par nom normalisé.
- Chargement fiable des articles depuis le snapshot/patch D1 de l’entreprise.
- Les articles en rupture restent affichés, mais leur ajout au panier est désactivé.
