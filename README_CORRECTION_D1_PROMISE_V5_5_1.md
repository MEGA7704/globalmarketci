# GLOBAL MARKET V5.5.1 — Correction sauvegarde D1 après /api/health

Correction ciblée uniquement sur l'initialisation D1 du Worker.

## Problème
Le Worker conservait `dbReadyPromise` au niveau global. Cette Promise contenait une opération D1 créée dans le contexte d'une requête. Un isolate Cloudflare pouvant être réutilisé pour une autre requête, cette Promise pouvait ensuite être réutilisée hors de son contexte initial et provoquer une erreur serveur masquée par `STORAGE_WRITE_FAILED`.

## Correction
- suppression de `dbReadyPromise` ;
- remplacement par un simple booléen `dbSchemaReady` ;
- aucune Promise D1 ni objet d'E/S n'est conservé entre les requêtes ;
- les commandes, paiements, messages, comptes et autres paramètres n'ont pas été modifiés.

## Validation
- `npm run validate` : OK
- `npm run build` : OK
- `node --check public/_worker.js` : OK
