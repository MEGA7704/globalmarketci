# GLOBAL MARKET 4.1 — Stockage D1 normalisé par entreprise

## Objectif

Cette version supprime l’écriture continue d’un gros objet JSON contenant toutes les données opérationnelles d’une entreprise.

Les ressources Cloudflare existantes sont conservées :

- `GLOBAL_MARKET_KV` : sessions, authentification, limitations et petit catalogue global ;
- `GLOBAL_MARKET_D1` : données métiers et snapshots de sécurité.

Aucun nouveau KV et aucune nouvelle base D1 ne sont nécessaires.

## Tables D1 métiers

- `gm_products`
- `gm_sales`
- `gm_payments`
- `gm_orders`
- `gm_customers`
- `gm_market_customers`
- `gm_password_reset_requests`
- `gm_stock_entries`
- `gm_stock_outputs`
- `gm_stock_movements`
- `gm_cashier_logs`
- `gm_company_settings`

## Publication atomique

Chaque sauvegarde crée un snapshot unique dans D1. Les nouveaux enregistrements sont écrits sous ce snapshot sans toucher au snapshot actif.

Le nouveau snapshot devient actif uniquement lorsque toutes les écritures ont réussi et que la révision de l’entreprise correspond encore à la révision attendue.

Conséquences :

- une sauvegarde partielle n’est jamais visible ;
- deux appareils ne peuvent pas publier silencieusement la même ancienne révision ;
- l’erreur `COMPANY_DATA_CONFLICT` protège les données en cas de concurrence ;
- les dix derniers snapshots sont conservés pour la reprise et le diagnostic.

## Données volumineuses

Un enregistrement supérieur à la limite interne est découpé dans `gm_large_record_chunks`. Cela permet de préserver les anciennes photos ou données volumineuses pendant la migration.

Pour les nouvelles images lourdes, Cloudflare R2 reste recommandé dans une future version.

## Migration automatique

Au premier chargement de chaque entreprise :

1. la version 4.1 recherche un snapshot D1 normalisé ;
2. lorsqu’il n’existe pas, elle lit la clé entreprise de la version 4.0 ou l’ancien stockage global ;
3. elle écrit les données dans les tables D1 dédiées ;
4. elle publie le premier snapshot normalisé ;
5. l’ancien stockage reste disponible comme sauvegarde historique, mais n’est plus réécrit.

La migration est progressive : une entreprise est migrée lorsqu’elle est chargée. Cela évite une migration globale longue et risquée.

## Sécurité conservée

- mots de passe traités uniquement dans `_worker.js` ;
- PBKDF2-SHA256 avec sel aléatoire ;
- cookies `HttpOnly`, `Secure` et `SameSite=Lax` ;
- contrôle de session et CSRF ;
- contrôle du rôle et du `company_id` ;
- données sensibles exclues du stockage métier ;
- journalisation des opérations sensibles.

## Tests inclus

`npm run validate` vérifie :

- la syntaxe JavaScript ;
- les bindings Cloudflare ;
- la création des tables D1 ;
- l’isolation de deux entreprises ;
- le refus d’une sauvegarde obsolète ;
- la migration depuis l’ancien état global ;
- le découpage et la reconstruction d’un enregistrement volumineux ;
- l’absence d’écriture d’un gros état entreprise dans KV.
