# GLOBAL MARKET V6.0.2 — correction déploiement R2

## Erreur corrigée

Le déploiement GitHub Pages échouait après la publication des assets avec :

`R2 bucket 'global-market-media' not found`

La cause était le fichier `wrangler.json` principal : il déclarait le binding `GLOBAL_MARKET_MEDIA` alors que le bucket R2 n'avait pas encore été créé. Avec le déploiement Pages actuel, une ressource déclarée dans ce fichier doit déjà exister dans le compte Cloudflare.

## Correction V6.0.2

Le fichier `wrangler.json` principal ne déclare plus R2 et ne dépend pas non plus du Worker WebSocket externe. La publication Pages peut donc terminer avec uniquement les bindings D1/KV existants. Le code du Worker vérifie déjà `env.GLOBAL_MARKET_MEDIA` avant chaque accès R2 : l'absence du bucket n'empêche donc pas GLOBAL MARKET de fonctionner.

### Configurations fournies

- `wrangler.json` : déploiement de base, D1 + KV, aucune dépendance R2/Realtime préalable.
- `wrangler.pages-with-media.json` : à utiliser après création du bucket `global-market-media`.
- `wrangler.pages-with-realtime.json` : à utiliser après déploiement du Worker `global-market-realtime`, sans exiger R2.
- `wrangler.pages-full.json` : configuration complète, à utiliser uniquement quand R2 ET le Worker temps réel existent.

## Ordre de déploiement recommandé

1. Déployer d'abord V6.0.2 avec `wrangler.json`.
2. Appliquer `cloudflare/schema-v6.sql` sur D1 si ce n'est pas encore fait.
3. Créer le bucket R2 : `npx wrangler r2 bucket create global-market-media`.
4. Déployer le Worker temps réel : `npm run realtime:deploy`.
5. Quand les deux ressources existent, activer les bindings dans Cloudflare ou utiliser `wrangler.pages-full.json`.

## Important

R2 sert aux médias et n'est pas nécessaire pour que la première publication V6 réussisse. Les données relationnelles, commandes, produits et comptes restent dans D1.
