# GLOBAL MARKET — Projet Cloudflare Pages + GitHub

Projet complet prêt à être placé à la racine du dépôt GitHub puis déployé automatiquement par Cloudflare Pages.

## Configuration Cloudflare obligatoire

Dans **Workers et Pages → votre projet → Paramètres → Builds**, utilisez exactement :

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

Le fichier principal de l’application est :

```text
public/assets/app.js
```

Le style principal est :

```text
public/assets/style.css
```

Le Worker Cloudflare sécurisé est :

```text
public/_worker.js
```

## Commandes disponibles

```bash
npm install
npm run build
npm run dev
npm run deploy
```

`npm run build` :

1. vérifie les fichiers obligatoires ;
2. vérifie la syntaxe JavaScript ;
3. vérifie les routes de sécurité ;
4. vérifie les bindings KV et D1 ;
5. génère des fichiers CSS et JavaScript versionnés ;
6. génère `public/version.json` ;
7. place le résultat final dans `public`.

## Cloudflare KV et D1

Le projet utilise les bindings suivants :

```text
KV binding : GLOBAL_MARKET_KV
KV ID      : f863a50688bc4dfb89dd302a8a8bec76

D1 binding : GLOBAL_MARKET_D1
D1 name    : global_market_d1
D1 ID      : 92ef9815-eb4e-4b49-9a03-41f8e4bc5c77
```

## Secret Super Admin

Dans Cloudflare, ajoutez un secret chiffré :

```text
Nom : SUPER_ADMIN_INITIAL_PASSWORD
Valeur : Kf02071987@
```

Le mot de passe ne doit pas être écrit dans GitHub, `wrangler.json` ou les fichiers JavaScript publics.

Identifiant Super Admin :

```text
mega@services.local
```

## Mise en ligne sur GitHub

1. Décompressez le ZIP.
2. Ouvrez le dépôt GitHub `globalmarketci`.
3. Placez le contenu décompressé directement à la racine du dépôt.
4. Ne téléversez pas seulement le fichier ZIP.
5. Vérifiez que `package.json`, `wrangler.json`, `public` et `scripts` sont visibles à la racine.
6. Validez avec un nouveau commit sur la branche `main`.

Le numéro de commit GitHub doit changer. Cloudflare doit afficher dans le journal :

```text
Executing user command: npm run build
> global-market-cloudflare@2.1.0 build
[build] Répertoire de sortie : public
[build] Construction terminée avec succès.
```

## Vérifier la nouvelle version

Après le déploiement, ouvrez :

```text
https://VOTRE-DOMAINE.pages.dev/version.json
```

Le fichier doit afficher une nouvelle valeur `build`. Le même numéro est visible en bas de l’application.

## Plans intégrés

- Plan Free : accès complet pendant 21 jours.
- Plan Business : accès complet pendant 365 jours.
- Montant Business : 26 300 FCFA.
- Paiement Wave : `https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=26300`

## Important

Ne configurez pas `npm run check` dans Cloudflare. La commande officielle du projet est :

```text
npm run build
```

## Fiche d’inscription des entreprises

La fenêtre d’inscription existante a été conservée et habillée en modale premium :

- largeur maximale de 1 500 px et largeur de 96 vw ;
- fond vert émeraude foncé, double bordure dorée et coins arrondis ;
- grille de trois colonnes sur ordinateur, deux sur tablette et une sur téléphone ;
- champs avec icônes, libellés dorés et étoiles rouges ;
- affichage ou masquage du mot de passe ;
- bouton bloqué pendant l’enregistrement avec le texte `CRÉATION EN COURS…` ;
- création réelle via la route existante `POST /api/register-company`.

Les routes API, KV, D1, l’authentification et les données existantes ne sont pas modifiés par ce composant.

## Rappel du Plan Free

Pour une entreprise au Plan Free, un rappel professionnel s’affiche :

- à l’ouverture de chaque section ;
- toutes les 15 minutes ;
- avec les boutons `Compris` et `Acheter mon plan Business`.

Le bouton d’achat ouvre exactement :

```text
https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=26300
```
