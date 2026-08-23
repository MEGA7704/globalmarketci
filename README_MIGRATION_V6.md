# GLOBAL MARKET V6.0 — migration relationnelle sans saturation structurelle

## Correctif V6.1.6 — compatibilité des anciens schémas D1

Les anciennes migrations de stockage normalisé utilisaient certains noms de
tables (`gm_orders`, `gm_sales`, `gm_payments`, `gm_company_settings`, etc.)
avec une structure de snapshots JSON incompatible avec le schéma relationnel
V6. Le Worker détecte désormais ces anciennes structures avant toute lecture,
les renomme sous `gm_legacy_snapshot_*`, puis crée les tables relationnelles
attendues. Aucune ancienne ligne n'est supprimée.

Le marqueur `gm_meta.relational_schema_version = 6.1.6` évite de rejouer cette
vérification complète après une initialisation réussie. La route `/api/health`
peut être appelée après un déploiement pour déclencher et contrôler cette
initialisation, mais cette archive n'effectue aucun changement de production.


### Vérification locale des migrations D1

Le projet déclare maintenant `migrations_dir = cloudflare/migrations` dans les
configurations Wrangler. Sur une nouvelle base locale :

```bash
npm run db:migrations:local
npm run db:v6:local
npm run build
```

`db:v6` pointe volontairement vers **local** afin d'éviter une modification
accidentelle de production. Pour une base distante, utilisez explicitement
`db:migrations:remote` / `db:v6:remote` uniquement après sauvegarde.

La migration historique `0006` crée désormais les anciennes tables JSON sous
`gm_legacy_snapshot_*`. Une base déjà ancienne, où `0006` avait été appliquée
avant ce correctif, reste prise en charge par la réparation `ensureDB()` du Worker.

## Ce qui change

V6 ne reconstruit plus toute la marketplace pour chaque client. Les données sont séparées dans des tables D1 indexées (`gm_companies`, `gm_items`, `gm_orders`, `gm_order_items`, `gm_market_messages`, etc.). Le catalogue est lu avec `LIMIT/OFFSET`, les commandes et messages sont chargés par client/boutique, les images Base64 peuvent être externalisées vers R2 et les notifications utilisent un Durable Object WebSocket hibernable.

Les anciennes tables JSON restent présentes uniquement comme source de migration et de retour arrière. Après `schema_version=6.0`, les sauvegardes courantes passent par les tables relationnelles.

## Ordre de déploiement recommandé — V6.1.6

### Base D1 existante (cas de production actuel)

1. Exporter D1 intégralement : `npx wrangler d1 export global_market_d1 --remote --output backup-before-v6-1-6.sql`.
2. Tester d'abord cette archive sur une copie D1 / préproduction.
3. Déployer le code Pages V6.1.6 avec le `wrangler.json` principal. **Ne lancez pas `db:v6:remote` avant cette étape sur une ancienne base** : le Worker doit d'abord détecter et archiver les anciennes tables snapshot qui portent les noms relationnels.
4. Appeler `/api/health` une première fois. `ensureDB()` inspecte les colonnes, archive/fusionne les anciens snapshots sous `gm_legacy_snapshot_*`, crée le schéma relationnel et écrit `gm_meta.relational_schema_version = 6.1.6`.
5. Vérifier les nombres de produits, entreprises, clients et commandes, puis passer une commande de test.
6. `npm run db:v6:remote` est ensuite **optionnel et idempotent** : il peut servir de contrôle supplémentaire une fois la réparation terminée.
7. Configurer R2 et le Worker temps réel uniquement après validation du socle Pages + D1 + KV.

### Nouvelle base D1 vide

1. `npm run db:migrations:remote`
2. `npm run db:v6:remote`
3. Déployer Pages.
4. Appeler `/api/health` et vérifier le marqueur `6.1.6`.

Les secrets `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_INITIAL_PASSWORD` et `V6_MIGRATION_KEY` doivent rester dans les secrets Cloudflare et ne jamais être ajoutés au dépôt.

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


## Note V6.0.2 — ordre des bindings

Le premier déploiement Pages utilise `wrangler.json` sans R2 ni Durable Object externe. Créez ensuite `global-market-media` et `global-market-realtime`, puis activez les bindings optionnels. Cela évite les erreurs de publication `bucket not found` et `script not found`.
