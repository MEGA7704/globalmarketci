# GLOBAL MARKET V6.0.3 — correction catalogue vide

Cette version corrige le cas où la V6 est marquée comme migrée alors que `gm_items` / `gm_companies` ne contiennent pas encore le catalogue V5.

## Correction
- Détection d'un catalogue relationnel vide.
- Récupération automatique et idempotente des entreprises et produits depuis le stockage V5.
- Réinsertion dans `gm_companies` et `gm_items` par lots D1.
- Si D1 ne peut pas encore être réparé, l'accueil sert immédiatement les produits V5 en lecture seule au lieu d'afficher un catalogue vide.
- Nouvelle clé de cache `catalog-v603` pour ne pas réutiliser un ancien cache vide.
- `/api/health` expose désormais les compteurs du catalogue relationnel et le statut de récupération.
- L'opération `/api/v6/migrate` vérifie/répare le catalogue même si `schema_version=6.0` existe déjà.

Aucune suppression des données V5 n'est effectuée.
