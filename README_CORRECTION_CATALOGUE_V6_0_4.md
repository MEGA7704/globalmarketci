# GLOBAL MARKET V6.0.4 — Correction définitive du catalogue

Cette version corrige plusieurs causes possibles d’un catalogue vide après migration V6 :

- réconciliation complète et idempotente du catalogue V5 vers `gm_companies` / `gm_items`, même si les tables V6 sont déjà partiellement remplies ;
- correction des booléens `marketplaceHidden` (`false`, `0`, chaîne `false`) pour éviter de masquer des articles visibles ;
- suppression du filtre SQL qui retirait les produits avec stock à 0 de l’accueil : ils restent visibles avec le statut **Stock épuisé** ;
- suppression du filtre d’expiration d’abonnement au niveau du catalogue public afin de conserver le comportement V5 ; seuls les comptes explicitement `blocked` ou `suspended` sont exclus ;
- fallback legacy conservé si la réconciliation D1 n’est pas encore terminée ;
- nouvelle clé de cache `catalog-v604` pour ne pas réutiliser un cache vide créé par une version précédente.

Le panier continue de refuser un produit réellement indisponible : la correction concerne l’affichage, pas le contrôle du stock lors de la commande.
