# GLOBAL MARKET V6.0.1 — correction de l’échec Cloudflare 8000109

## Cause exacte

Le build V6.0 était valide, mais `wrangler.json` liait immédiatement le projet Pages au Durable Object externe `global-market-realtime`. Cloudflare refuse de publier une Function Pages qui référence un Worker externe qui n’existe pas encore : `Error 8000109: Script global-market-realtime not found`.

## Correction V6.0.1

- Le `wrangler.json` principal ne contient plus la liaison Durable Object externe. Le premier déploiement Pages peut donc réussir même si le Worker temps réel n’a pas encore été créé.
- Le temps réel est **optionnel au premier déploiement**. Tant que la liaison `REALTIME_HUB` n’existe pas, le navigateur ne boucle plus sur des tentatives WebSocket : il utilise le polling léger de secours toutes les 10 minutes.
- Le Worker temps réel reste fourni dans `realtime-worker/`.
- La configuration complète à utiliser après création du Worker est fournie dans `wrangler.pages-with-realtime.json`.

## Ordre recommandé

### Étape 1 — déployer Pages
Poussez cette V6.0.1 sur GitHub. Le déploiement Pages doit aller jusqu’à `Success` sans erreur 8000109.

### Étape 2 — créer le Worker temps réel une seule fois
Depuis une machine authentifiée avec Wrangler :

```bash
npm install
npm run realtime:deploy
```

Le Worker créé doit s’appeler exactement `global-market-realtime` et exporter la classe Durable Object `RealtimeHub`.

### Étape 3 — lier le Durable Object au projet Pages
Dans Cloudflare : **Workers & Pages → globalmarketci → Settings → Bindings → Add → Durable Object**.

- Variable name : `REALTIME_HUB`
- Durable Object namespace : `RealtimeHub` du Worker `global-market-realtime`

Puis relancez un déploiement Pages.

> Alternative CLI : après que `global-market-realtime` existe, `wrangler.pages-with-realtime.json` contient la liaison externe prête à l’emploi.

## Vérification

Ouvrez `/api/health`.

- `relationalV6: true` : migration D1 V6 active
- `mediaBound: true` : R2 actif
- `realtimeBound: false` : Pages fonctionne, mais le Worker temps réel n’est pas encore lié
- `realtimeBound: true` : WebSocket temps réel totalement actif

La V6.0.1 ne dépend donc plus de l’existence préalable du Worker temps réel pour publier le site.
