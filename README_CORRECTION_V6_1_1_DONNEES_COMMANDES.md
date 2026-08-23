# GLOBAL MARKET V6.1.1 — restauration des données et commandes

Cette version corrige le cas où le passage à D1 relationnel V6 rendait invisibles des données déjà enregistrées dans l’ancien stockage V5.

## Corrections

- restauration historique V5 → tables D1 V6 en **insertion des éléments manquants uniquement** ;
- aucune donnée V6 plus récente n’est écrasée par une ancienne copie V5 ;
- restauration ciblée par entreprise lors de la première ouverture d’un espace administrateur/caisse ;
- restauration ciblée par client lors de la première ouverture de son espace ;
- rapprochement d’un ancien identifiant client avec le compte courant par téléphone/e-mail ;
- les commandes/messages historiques sont immédiatement fusionnés dans la réponse puis réinjectés en arrière-plan dans D1 ;
- `/api/load` recharge désormais les données métier après `/api/session` au lieu de rester sur le jeu minimal de connexion ;
- l’espace client actualise séparément `/api/v6/client/orders` et `/api/v6/client/messages` sans recharger tout GLOBAL MARKET ;
- les ventes, stocks, clients, commandes, messages et autres données existantes réapparaissent pendant le backfill ;
- nouvelle clé de cache navigateur V6.1.1.

Le backfill est idempotent et conserve D1 comme source principale.
