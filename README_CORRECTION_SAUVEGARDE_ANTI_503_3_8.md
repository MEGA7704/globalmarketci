# GLOBAL MARKET — Correction sauvegarde anti-503 V3.8

## Problème corrigé

Le message « La sauvegarde sécurisée a échoué : Erreur serveur 503 » apparaissait lorsque chaque enregistrement réécrivait toute la base globale dans une seule opération D1/KV. Les données volumineuses, les images, les historiques et plusieurs sauvegardes rapprochées pouvaient dépasser les ressources du Worker ou surcharger D1.

## Nouvelle architecture de sauvegarde

- chaque entreprise possède désormais son propre document de sauvegarde D1 ;
- la base globale et les sauvegardes du Super Admin utilisent aussi des révisions D1 indépendantes ;
- les données des entreprises sont découpées en blocs de 240 Ko et la base globale en blocs de 400 Ko ;
- les blocs sont écrits en lots limités à huit requêtes ;
- une nouvelle révision est entièrement enregistrée avant de devenir active, pour l’entreprise comme pour la base globale ;
- une sauvegarde interrompue ne remplace jamais la dernière version valide ;
- la compaction de l’ancienne base globale est exécutée après la réponse et ne bloque plus l’utilisateur ;
- la base applicative n’est plus réécrite dans une même clé KV à chaque clic, supprimant la limite KV d’une écriture par seconde ;
- le navigateur regroupe les modifications pendant 1,4 seconde ;
- une seule sauvegarde peut être envoyée à la fois ;
- les erreurs temporaires 429, 500, 502, 503 et 504 sont automatiquement réessayées trois fois ;
- le délai maximal d’une requête de sauvegarde passe à 30 secondes ;
- les nouvelles captures de paiement sont limitées à 500 Ko afin d’éviter une croissance incontrôlée de la base.

## Déploiement

- branche : `main`
- commande : `npm run build`
- sortie : `public`
- bindings : `GLOBAL_MARKET_KV` et `GLOBAL_MARKET_D1`

Les nouvelles tables D1 sont créées automatiquement par le Worker au premier appel API. Aucun effacement manuel de la base existante n’est requis.
