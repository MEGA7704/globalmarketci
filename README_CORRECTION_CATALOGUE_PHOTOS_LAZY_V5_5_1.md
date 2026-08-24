# GLOBAL MARKET V5.5.1 — correction catalogue public / photos Base64

Correction ciblée du chargement public, sans migration ni modification des données existantes.

## Diagnostic confirmé dans D1
- 63 enregistrements `array:items` ; 62 actifs ; 1 supprimé ; 0 JSON invalide.
- 61 des 62 produits actifs contiennent une photo Base64.
- Taille cumulée des photos : environ 7057 Ko.
- Plus grosse photo : environ 701574 octets.

## Correction
- `/api/public/load` ne charge plus les champs `photo` Base64 depuis les patches produit.
- Les données produit sont reconstruites sans photo inline.
- Une URL `/api/public/item-photo?companyId=...&itemId=...` est fournie à la place.
- La nouvelle route lit uniquement la photo demandée et la renvoie comme image.
- Les snapshots historiques restent compatibles.
- Aucune suppression, conversion ou migration des photos existantes.
- Commandes, paiements, comptes, messages et autres paramètres non modifiés.

## Vérifications
- `node --check public/_worker.js` : OK.
- `npm run validate` : OK.
- `npm run build` : OK.
- Vérification statique : `publicLoadPayload` n'appelle plus `loadState` et la requête patches utilise `json_remove(data, '$.photo')`.
