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

La fenêtre d’inscription adopte un design militaire administratif compact. Sur ordinateur, son cadre reste entièrement visible sans défilement interne. Les champs ont un fond blanc, le texte saisi est noir et le bouton de création réagit immédiatement tout en bloquant les doubles clics. Elle est organisée en quatre blocs :

1. **Informations de l’entreprise** : raison sociale, forme juridique, RCCM et compte contribuable.
2. **Spécialité** : type de commerce et activité principale.
3. **ID du responsable** : gérant, adresse et téléphone.
4. **Identifiant** : e-mail et mot de passe administrateur.

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
