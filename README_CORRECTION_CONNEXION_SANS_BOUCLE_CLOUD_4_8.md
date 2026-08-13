# GLOBAL MARKET V4.8 — Correction définitive du circuit de connexion

Cette version supprime le comportement visible de type « service cloud occupé / nouvelle tentative » sur les écrans de connexion Administrateur, Caisse et Client.

## Changements techniques

- Authentification **D1 prioritaire** avec migration ciblée des anciens secrets conservés en KV lors de la première connexion réussie.
- Suppression de la migration globale de tous les mots de passe pendant `loadBaseState()` : une connexion ne déclenche plus une rafale de lectures/écritures KV.
- Sessions Administrateur/Caisse et Client enregistrées en **D1**, avec miroir KV de compatibilité non bloquant.
- Limitation des tentatives de connexion déplacée vers **D1** et conçue pour ne pas bloquer un utilisateur légitime si le stockage de rate-limit n’est pas disponible.
- La connexion recherche directement le profil dans les données de l’entreprise puis ne lit qu’un seul secret d’authentification ciblé si une migration KV est encore nécessaire.
- Suppression côté interface des compteurs « tentative 2/5, 3/5… » et de tous les messages « service cloud occupé ».
- Une seule requête de connexion est lancée depuis le navigateur. Les mécanismes de compatibilité restent internes au serveur.
- Les mots de passe restent hachés PBKDF2-SHA256 côté Worker ; aucun mot de passe n’est stocké dans le navigateur.

## Compatibilité

Les anciens comptes restent compatibles. Lorsqu’un secret existe encore uniquement dans KV, il est lu de manière ciblée puis recopié automatiquement dans D1. Après cette migration, les connexions suivantes utilisent D1 en priorité.

## Déploiement

Aucune suppression de D1 ou de KV n’est requise. Le Worker crée automatiquement les nouvelles tables D1 lors du premier appel API.

Après déploiement, effectuer un `Ctrl + F5` sur les postes déjà ouverts afin de charger le nouveau JavaScript versionné V4.8.
