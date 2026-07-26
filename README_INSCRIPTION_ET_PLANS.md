# GLOBAL MARKET — Inscription premium et deux plans

## Périmètre de la correction

Cette livraison conserve le projet Cloudflare Pages existant et modifie uniquement :

- le composant visuel de la fiche d’inscription des entreprises ;
- les options du champ Type de commerce ;
- l’interface des deux plans Free et Business ;
- le popup de rappel du Plan Free.

Aucune route API, aucune liaison KV/D1 et aucune règle de sécurité du Worker n’a été supprimée.

## Plans

| Plan | Accès | Durée | Prix |
|---|---|---:|---:|
| Free | Complet | 21 jours | 0 FCFA |
| Business | Complet | 365 jours | 26 300 FCFA |

Lien Wave :

```text
https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=26300
```

## Configuration Cloudflare Pages

```text
Branche de production : main
Commande de version    : npm run build
Répertoire de sortie   : public
Répertoire racine      : vide
Infrastructure         : Aucun
```

## Déploiement

1. Décompresser le ZIP.
2. Envoyer son contenu à la racine de la branche `main`.
3. Vérifier que `package.json`, `wrangler.json`, `public/` et `scripts/` sont directement à la racine.
4. Relancer le déploiement Cloudflare du nouveau commit.
5. Le journal doit afficher `global-market-cloudflare@2.1.0 build`.
