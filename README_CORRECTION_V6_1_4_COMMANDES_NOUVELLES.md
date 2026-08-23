# GLOBAL MARKET V6.1.4 — Commandes nouvelles visibles immédiatement

Cette version corrige le cas critique où une commande venait d'être validée mais n'apparaissait pas dans l'espace client.

## Correction

- `/api/public/order` utilise toujours le chemin relationnel V6 pour les nouvelles commandes, même si un ancien marqueur de migration est incomplet.
- Chaque commande crée atomiquement une référence dans `gm_client_order_refs`.
- Lecture client par `gm_orders.client_id` **ou** par la table de référence.
- Miroir KV léger des 250 dernières commandes du client comme filet de sécurité.
- Vérification de relecture D1 avant de confirmer la commande au navigateur.
- Le navigateur insère immédiatement les commandes renvoyées par le POST dans l'espace client, sans attendre un rechargement global.
- Un reçu local des 100 dernières commandes empêche une réponse temporairement vide d'effacer une commande qui vient d'être passée.
- Les routes commande/client ne dépendent plus du drapeau `schema_version` pour fonctionner.

Aucune ancienne donnée n'est supprimée. La nouvelle table est créée automatiquement par `ensureDB`, donc il n'est pas nécessaire de recréer la base.
