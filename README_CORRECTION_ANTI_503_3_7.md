# GLOBAL MARKET 3.7 — Correction anti-503

## Corrections appliquées

1. Seules les routes `/api/*` invoquent désormais le Worker Cloudflare.
   Les fichiers HTML, CSS, JavaScript et images sont servis directement par Pages.
2. Les créations de tables D1 ne sont plus répétées à chaque requête dans un même isolate.
3. La migration des anciens identifiants n'est exécutée qu'une seule fois.
4. D1 devient la source durable ; KV sert de cache rapide tant que l'état reste inférieur à 20 Mo.
5. Les bases plus volumineuses basculent automatiquement sur D1 au lieu de faire échouer KV.
6. `/api/health` ne charge plus toute la base de données.
7. Une configuration Super Admin manquante renvoie désormais `428 SETUP_REQUIRED`, et non un faux `503`.
8. Une mise à jour du projet ne force plus la réinitialisation du mot de passe Super Admin existant.
9. Le déploiement Wrangler cible le projet `globalmarketci`.

## Configuration Cloudflare obligatoire

Dans **Workers & Pages > globalmarketci > Settings** :

- Build command : `npm run build`
- Build output directory : `public`
- KV binding : `GLOBAL_MARKET_KV`
- D1 binding : `GLOBAL_MARKET_D1`
- Variable : `SUPER_ADMIN_EMAIL`
- Secret : `SUPER_ADMIN_INITIAL_PASSWORD` (nécessaire uniquement pour une première initialisation)
- Variable : `SUPER_ADMIN_PASSWORD_VERSION`

Après toute modification d'un binding ou d'une variable, relancer un déploiement de production.

## Diagnostic après déploiement

Ouvrir :

`https://globalmarketci.pages.dev/api/health`

La réponse attendue contient `"ok": true`, `"kv": true` et `"d1": true`.
