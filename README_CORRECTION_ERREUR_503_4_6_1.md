# GLOBAL MARKET 4.6.1 — Correction erreur 503

## Corrections

- Les fichiers statiques et la page de connexion ne passent plus par Pages Functions.
- Seules les routes `/api/*` invoquent le Worker.
- Une panne API ne bloque plus l’affichage de la connexion.
- Les erreurs de bindings KV/D1 sont maintenant capturées et renvoyées en JSON.
- Un compte Super Admin déjà initialisé conserve son mot de passe existant si le secret de réinitialisation est temporairement absent.
- Le secret reste obligatoire pour une toute première initialisation ou une réinitialisation volontaire.

## Configuration Cloudflare à conserver

- KV : `GLOBAL_MARKET_KV`
- D1 : `GLOBAL_MARKET_D1`
- Secret : `SUPER_ADMIN_EMAIL`
- Secret : `SUPER_ADMIN_INITIAL_PASSWORD`
- Variable : `SUPER_ADMIN_PASSWORD_VERSION`

## Routes

`public/_routes.json` :

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```
