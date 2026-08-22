# GLOBAL MARKET V6.0 — migration relationnelle sans saturation structurelle

## Ce qui change

V6 ne reconstruit plus toute la marketplace pour chaque client. Les données sont séparées dans des tables D1 indexées (`gm_companies`, `gm_items`, `gm_orders`, `gm_order_items`, `gm_market_messages`, etc.). Le catalogue est lu avec `LIMIT/OFFSET`, les commandes et messages sont chargés par client/boutique, les images Base64 peuvent être externalisées vers R2 et les notifications utilisent un Durable Object WebSocket hibernable.

Les anciennes tables JSON restent présentes uniquement comme source de migration et de retour arrière. Après `schema_version=6.0`, les sauvegardes courantes passent par les tables relationnelles.

## Ordre de déploiement obligatoire

1. Sauvegarder D1 avant migration : `npx wrangler d1 export global_market_d1 --remote --output backup-before-v6.sql`.
2. Installer/mettre à jour : `npm install`.
3. Créer le bucket R2 une seule fois : `npm run media:create` (si le bucket existe déjà, continuer).
4. Déployer le Worker temps réel : `npm run realtime:deploy`.
5. Appliquer le schéma relationnel : `npm run db:v6`.
6. Dans Cloudflare, ajouter les secrets du projet Pages `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_INITIAL_PASSWORD` et surtout `V6_MIGRATION_KEY` (clé aléatoire longue). Ne pas placer les secrets dans `wrangler.json`.
7. Déployer Pages : `npm run deploy`.
8. Exécuter la migration UNE FOIS : `npm run migrate:v6 -- https://VOTRE-SITE.pages.dev VOTRE_CLE_MIGRATION`.
9. Vérifier `https://VOTRE-SITE.pages.dev/api/health` : `relationalV6: true`, `realtimeBound: true`, `mediaBound: true`.
10. Activer **D1 Read Replication** dans Cloudflare. Le code V6 utilise la Sessions API (`withSession`) et propage `X-D1-Bookmark`, donc les lectures peuvent utiliser les réplicas tout en gardant la cohérence de session.

## Pourquoi cette version tient mieux la charge

- Accueil : 16 produits par requête SQL, pas l’état global complet.
- Recherche/filtres/pagination : SQL côté D1.
- Client : uniquement ses commandes et messages.
- Boutique : uniquement ses commandes/messages et ses données d’entreprise.
- Stock : mises à jour SQL atomiques, avec trigger empêchant un stock négatif.
- Notifications : WebSocket Durable Object ; le polling lourd n’est qu’un secours toutes les 10 minutes.
- Médias : R2 évite de gonfler les lignes D1 avec des images Base64.
- Les écritures ne réécrivent plus un document JSON géant.

## Retour arrière

La migration ne supprime pas les anciennes tables V5. Conservez `backup-before-v6.sql`. En cas de problème de déploiement, restaurez l’ancienne archive V5.6.3 avant de continuer la migration. Ne supprimez les anciennes tables qu’après une période de validation en production.

## Test de charge après déploiement

Commencez progressivement :

- `npm run loadtest:v6 -- https://VOTRE-SITE.pages.dev 20 200`
- `npm run loadtest:v6 -- https://VOTRE-SITE.pages.dev 100 1000`
- `npm run loadtest:v6 -- https://VOTRE-SITE.pages.dev 500 5000`

Le script teste le catalogue paginé, mesure le débit et les latences p50/p95/p99. Ne lancez 1000 connexions concurrentes que sur votre propre environnement et après avoir vérifié les quotas de votre plan Cloudflare.
