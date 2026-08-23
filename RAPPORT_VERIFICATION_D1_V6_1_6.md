# GLOBAL MARKET V6.1.6 — vérification locale D1

## Périmètre contrôlé

- Produits : `gm_items`, index boutique/catégorie/catalogue et protection du stock négatif.
- Commandes : `gm_orders`, `gm_order_items`, `gm_client_order_refs` et index client/boutique.
- Clients : `gm_clients` et `gm_market_clients` avec unicité du téléphone marketplace.
- Entreprises : `gm_companies`, `gm_users` et paramètres par entreprise.
- Persistance de secours : KV pour les sessions, index et miroirs récents de commandes.

## Anomalie corrigée

La migration historique `0006_normalized_company_storage.sql` et le schéma
relationnel `schema-v6.sql` réutilisaient plusieurs noms de tables avec des
colonnes différentes. Selon l'ordre d'application, `CREATE TABLE IF NOT EXISTS`
conservait la mauvaise structure, puis les lectures de commandes ou la création
des index échouaient.

Le Worker V6.1.6 inspecte les colonnes avec `PRAGMA table_info`, archive seulement
les tables reconnues comme anciens snapshots sous des noms
`gm_legacy_snapshot_*`, et initialise ensuite le schéma relationnel complet.
Cette opération conserve les données historiques et ne touche pas à la
production tant que cette version n'est pas déployée.

## Contrôles à effectuer avant production

1. Exporter D1 intégralement.
2. Déployer d'abord sur un environnement de préproduction lié à une copie D1.
3. Appeler `/api/health`, puis vérifier le marqueur de schéma `6.1.6`.
4. Contrôler les nombres de produits, clients, entreprises et commandes.
5. Passer une commande test et vérifier sa visibilité immédiate côté client et boutique.


## Corrections V6.1.6

- `cloudflare/migrations/0006_normalized_company_storage.sql` n'occupe plus les noms des tables relationnelles V6 sur une base neuve.
- `wrangler*.json` déclare `migrations_dir: cloudflare/migrations`.
- `db:v6` est local par défaut ; les commandes distantes sont explicitement suffixées `:remote`.
- Le Worker fusionne aussi un ancien snapshot dans une archive déjà existante avant de libérer le nom relationnel, sans supprimer silencieusement les données.
- La version générée par `scripts/build.mjs` provient désormais de `package.json` et n'est plus figée sur 6.1.4.

- `ensureDB()` crée désormais aussi `idx_gm_items_search` et `idx_gm_orders_checkout`, afin que l'initialisation automatique du Worker soit identique au schéma SQL V6.
- `cloudflare/schema.sql` inclut maintenant `gm_client_order_refs` et ses index, comme `schema-v6.sql`.

## Résultats des tests locaux

- `npm run validate` : OK.
- `npm run build` : OK, `public/version.json` généré en `6.1.6`.
- Application séquentielle `0006` + `0007` + `schema-v6.sql` sur une base SQLite neuve : OK.
- `cloudflare/schema.sql` seul sur une base neuve : OK.
- Tables vérifiées : `gm_companies`, `gm_items`, `gm_orders`, `gm_order_items`, `gm_clients`, `gm_market_clients`, `gm_client_order_refs`.
- Index vérifiés : catalogue, recherche produit, commandes client/boutique, checkout et références de commandes.
- Contraintes vérifiées : téléphone marketplace unique et blocage du stock négatif (`INSUFFICIENT_STOCK`).
- Aucun déploiement ni écriture sur la base D1 distante n'a été effectué pendant ces contrôles.
