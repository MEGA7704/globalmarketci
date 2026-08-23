# GLOBAL MARKET V6.1.3 — restauration forensique des commandes historiques

Cette version corrige le cas où des commandes anciennes existaient encore dans les stockages V5 mais n'étaient plus visibles dans l'espace client après la migration V6.

## Sources inspectées

La récupération d'un client vérifie désormais, dans cet ordre :

- les commandes D1 relationnelles déjà rattachées au client ;
- les anciens identifiants du même client ;
- `company_state_patches` pour les commandes encore présentes dans les deltas V5 ;
- la file KV `pending-ops:v563:*` utilisée lorsque D1 était occupé ;
- les caches client KV `cache:client-payload:v563:*` qui contenaient l'historique affiché avant V6 ;
- le cache d'état V5 ;
- les sauvegardes D1 de la table `backups` ;
- les snapshots D1 `company_state_chunks` ;
- les anciens `state_chunks` ;
- en dernier recours, la reconstruction complète de l'état V5.

Les commandes retrouvées sont rattachées au compte client actuellement connecté et réinsérées dans `gm_orders` sans modifier leur identifiant, date, montant ou statut.

## Fluidité

L'ouverture de l'espace client lance d'abord une recherche rapide. Si une recherche historique plus profonde est nécessaire, elle continue en arrière-plan et l'interface réinterroge automatiquement l'historique quelques secondes plus tard. Le bouton « Restaurer mes anciennes commandes » force immédiatement la recherche complète.

## Important

Ne supprimez pas l'ancienne base D1, les tables historiques ni le namespace KV avant d'avoir vérifié que les commandes ont été récupérées.
