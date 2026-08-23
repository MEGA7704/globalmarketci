# GLOBAL MARKET V6.0.5 — Catalogue stable sans disparition

Cette version corrige le cas où les produits apparaissent puis disparaissent quelques secondes plus tard.

Corrections :
- une réponse vide transitoire de `/api/v6/catalog` ne remplace plus un catalogue déjà affiché ;
- le navigateur conserve en mémoire le dernier catalogue valide tant que le serveur n'a pas confirmé qu'il est réellement vide ;
- le serveur conserve un dernier catalogue public valide dans KV pendant 24 h pour résister à une lecture D1 momentanément incohérente ;
- si le catalogue D1 est vide alors que des données V5 existent, une réconciliation V5 → V6 est forcée même si une ancienne migration avait déjà été marquée comme terminée ;
- la réconciliation est limitée à une fois par minute afin d'éviter de charger D1 inutilement ;
- les produits à stock zéro restent visibles avec le bouton `Stock épuisé` ;
- nouvelle clé de cache `catalog-v605` et cache public non vide de 60 secondes.

Le catalogue n'est effacé de l'écran que lorsque le serveur renvoie une réponse vide confirmée (`authoritativeEmpty=true`).
