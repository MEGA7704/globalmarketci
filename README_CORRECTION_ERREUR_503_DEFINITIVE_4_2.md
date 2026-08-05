# GLOBAL MARKET V4.2 — Suppression du blocage « Erreur serveur 503 »

## Correction appliquée

La sauvegarde ne réécrit plus toute la base de l’entreprise à chaque enregistrement. Le navigateur calcule uniquement les lignes réellement ajoutées, modifiées ou supprimées, puis les transmet à la route sécurisée `POST /api/save-delta`.

## Architecture anti-503

- sauvegarde D1 incrémentielle par ligne et par section ;
- nouvelle table `company_state_patches` avec mise à jour atomique des éléments modifiés ;
- aucun enregistrement courant ne réécrit la base globale ou le document complet de l’entreprise ;
- les anciennes versions de l’application utilisant `/api/save` sont converties côté serveur en modifications incrémentielles ;
- reprise automatique jusqu’à cinq fois pour les erreurs temporaires 408, 425, 429, 500, 502, 503 et 504 ;
- si Cloudflare est momentanément indisponible, la modification reste en attente dans l’onglet et est renvoyée automatiquement sans popup bloquante ;
- nouvelle tentative automatique au retour de la connexion Internet ;
- envoi de secours à la fermeture de la page lorsque la modification est assez légère ;
- les encaissements ne sont plus annulés uniquement à cause d’une indisponibilité temporaire de Cloudflare ;
- les créations de comptes, utilisateurs, clients Marketplace et commandes sont enregistrées par petites modifications D1 ;
- les suppressions d’entreprise utilisent un marqueur D1 dédié et ne réécrivent plus toute la base ;
- le message « La sauvegarde sécurisée a échoué : Erreur serveur 503 » a été retiré du navigateur.

## Compatibilité

Les anciennes tables et sauvegardes restent lisibles. Au chargement, GLOBAL MARKET applique les modifications incrémentielles par-dessus la dernière base valide. Aucune suppression manuelle de D1 ou KV n’est nécessaire.

## Déploiement Cloudflare Pages

- Branche : `main`
- Commande de build : `npm run build`
- Répertoire de sortie : `public`
- Bindings requis : `GLOBAL_MARKET_KV` et `GLOBAL_MARKET_D1`

Après le déploiement, ouvrir une nouvelle fois le site ou effectuer `Ctrl + F5` afin de charger le fichier JavaScript V4.2 généré avec un nouveau nom de build.
