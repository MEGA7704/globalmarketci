# GLOBAL MARKET V6.0.0 — ARCHITECTURE ANTI-SATURATION

Cette version remplace le chemin critique V5 basé sur la reconstruction d'un gros état JSON par une architecture relationnelle D1.

## Corrections principales

- Tables D1 dédiées et indexées pour entreprises, utilisateurs, articles, ventes, paiements, commandes, lignes de commande, clients et messages.
- Migration protégée et idempotente depuis V5.6.3 vers V6.0.
- Catalogue public paginé en SQL (`LIMIT / OFFSET`) avec 16 articles par page par défaut.
- Recherche, catégorie, type, tri et filtre boutique exécutés côté SQL.
- Cache Edge court pour absorber les pics de lecture du catalogue et des boutiques.
- Sessions D1 / bookmarks pour permettre Read Replication sans incohérence de lecture.
- Endpoints ciblés pour commandes/messages client et administrateur.
- Snapshot marketplace administrateur limité aux données nécessaires.
- Commandes atomiques D1 avec lignes normalisées et protection contre stock négatif.
- Notifications temps réel par Durable Object + WebSocket Hibernation.
- Polling lourd conservé uniquement comme secours à faible fréquence.
- R2 prévu pour sortir les images Base64 de D1.
- Anciennes tables V5 conservées uniquement pour la migration/retour arrière ; elles ne sont plus le chemin normal après activation V6.
- Script de test de charge inclus pour 20, 100, 500 utilisateurs concurrents et davantage selon le plan Cloudflare.

## Important

Suivre `README_MIGRATION_V6.md` dans l'ordre. La migration doit être faite après le déploiement du schéma D1, du bucket R2 et du Worker Durable Object temps réel.
