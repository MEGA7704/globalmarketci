# GLOBAL MARKET V6.1.2 — restauration des commandes client

## Problème corrigé
Des commandes anciennes pouvaient ne plus apparaître dans l’espace client après la migration V5 → V6. Deux causes principales ont été corrigées :

- le marqueur V6.1.1 pouvait considérer une restauration comme terminée alors qu’aucune commande n’avait été retrouvée ;
- certaines commandes historiques étaient encore liées à un ancien `clientId`, alors que le compte client courant avait été recréé ou remappé pendant la migration.

## Correction V6.1.2
La récupération des commandes ne dépend plus du marqueur V6.1.1. La V6.1.2 recherche les commandes dans plusieurs sources, dans cet ordre :

1. `gm_orders` avec l’identifiant client courant ;
2. `gm_orders` avec les anciens identifiants et l’identité présente dans `payload_json` ;
3. `company_state_patches` (`array:marketClients` et `array:orders`) ;
4. l’état historique complet V5/V6 (snapshots, ancien état global et patches).

Le rapprochement utilise l’ID client, le téléphone et l’e-mail. Pour les numéros ivoiriens/internationaux, les dix derniers chiffres sont aussi comparés afin de reconnaître par exemple un numéro stocké avec ou sans `+225`.

Les commandes retrouvées sont rattachées durablement au compte courant dans D1. Les données relationnelles récentes restent prioritaires.

## Protection de l’interface
Une réponse vide non autoritative ne remplace plus les commandes déjà affichées. L’espace client propose également **Restaurer mes anciennes commandes** lorsqu’aucune commande n’est affichée.

## Déploiement
Conserver les bindings actuels `GLOBAL_MARKET_D1` et `GLOBAL_MARKET_KV`. Ne pas recréer la base. Remplacer uniquement les fichiers du dépôt par cette version et redéployer Cloudflare Pages.
