# GLOBAL MARKET V4.5 — Correction connexion cloud

## Problème corrigé
Le message « Le service cloud est momentanément occupé. Une nouvelle tentative sera effectuée. » pouvait apparaître à la connexion sans qu’une vraie reprise automatique de la requête de connexion soit effectuée.

## Corrections
- 5 tentatives automatiques de connexion en cas de 408/425/500/502/503/504 ou indisponibilité réseau temporaire.
- Temporisation progressive entre les tentatives.
- Les erreurs d’identifiant, de mot de passe, de rôle ou de limitation de sécurité ne sont pas masquées ni répétées.
- Le Worker charge d’abord la base légère des profils, puis uniquement les données de l’entreprise authentifiée.
- Les snapshots de toutes les entreprises ne sont plus chargés avant chaque connexion normale.
- Reprises automatiques sur les lectures D1/KV temporairement indisponibles.
- Création de session KV réessayée automatiquement.
- L’échec d’effacement des compteurs de tentative n’annule plus une connexion valide.
- Les contrôles de sécurité, sessions HttpOnly, CSRF, limitations de tentatives et isolation par entreprise restent actifs.

## Déploiement
Déployer le dossier `public` sur Cloudflare Pages ou utiliser `npm run deploy`. Après déploiement, effectuer Ctrl+F5 dans le navigateur.
