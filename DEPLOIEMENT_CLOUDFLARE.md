# Déploiement Cloudflare Pages

## Paramètres

```text
Branche de production : main
Commande de version    : npm run build
Répertoire de sortie   : public
Répertoire racine      : vide
Infrastructure         : Aucun
```

## Étapes

1. Envoyer tous les fichiers du projet à la racine de la branche `main`.
2. Vérifier que GitHub crée un nouveau commit.
3. Dans Cloudflare Pages, relancer le déploiement du dernier commit.
4. Vérifier que le journal affiche `global-market-cloudflare@6.1.6 build`.
5. Vérifier que le journal affiche `[build] Construction terminée avec succès.`.
6. Ouvrir `/version.json` sur le domaine Pages.

## Erreur « Missing script: build »

Cette erreur signifie que Cloudflare utilise un ancien `package.json` ou que `package.json` n’est pas à la racine du dépôt.

La racine GitHub doit contenir directement :

```text
package.json
wrangler.json
public/
scripts/
```
