# GLOBAL MARKET V6.1.0 — Connexion et catalogue sans blocage

Cette version corrige la cause réelle des deux symptômes observés : catalogue vide et connexion qui expire.

## Cause

- Tant que le marqueur de migration V6 n'était pas terminé, les routes `/api/login`, `/api/v6/catalog` et `/api/v6/bootstrap` retombaient sur le chargement global V5. Cela annulait une grande partie du bénéfice de l'architecture relationnelle.
- Le catalogue relationnel utilisait `SELECT i.*`, donc `payload_json` était renvoyé pour chaque produit. Les anciennes photos Base64 pouvaient rendre une page de 16 produits très lourde.
- La connexion attendait le chargement de tout l'état de la boutique avant de répondre au navigateur.

## V6.1.0

- `/api/login` utilise désormais la table relationnelle immédiatement, même si la migration historique complète continue en arrière-plan.
- Une identité V5 absente de `gm_users` est restaurée depuis le cache/snapshot puis enregistrée dans D1 relationnel.
- La connexion renvoie d'abord la session et les données minimales; les données volumineuses sont chargées après l'ouverture de l'espace.
- `/api/session` est également léger afin qu'un rechargement de page ne bloque plus l'utilisateur.
- `/api/v6/catalog` et `/api/v6/bootstrap` utilisent toujours l'API V6 légère.
- Le catalogue ne renvoie plus les gros `payload_json`; les images sont servies séparément avec cache HTTP.
- Les nouvelles images Base64 sont externalisées vers R2 si disponible, sinon vers KV en attendant l'activation de R2.
- Le dernier catalogue public valide est conservé dans KV et dans le navigateur (uniquement des données publiques), afin qu'une réponse réseau temporaire ne vide plus l'accueil.
- L'hydratation des tables essentielles et la migration V5 vers V6 sont lancées en arrière-plan, sans bloquer l'accueil ni la connexion.
