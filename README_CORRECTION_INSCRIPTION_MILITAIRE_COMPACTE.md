# GLOBAL MARKET — Correction de la fiche d’inscription

## Résultat appliqué

- popup militaire administratif centré et plus compact ;
- cadre entièrement visible sans défilement interne sur ordinateur ;
- quatre champs « Information de l’entreprise » sur une même ligne ;
- deux champs « Spécialité » sur une même ligne ;
- trois champs « ID du responsable » sur une même ligne ;
- deux champs « Identifiant de connexion » sur une même ligne ;
- champs en fond blanc ;
- texte saisi et options des listes en noir ;
- bouton « CRÉER MON ENTREPRISE » réactif ;
- retour visuel immédiat « CRÉATION EN COURS… » ;
- protection renforcée contre les doubles clics.

## Sécurité conservée

Le Worker Cloudflare, les routes API, KV, D1 et l’authentification serveur n’ont pas été modifiés. Aucun identifiant de connexion ni mot de passe réel n’est inclus dans le projet.

## Fichiers modifiés

```text
public/assets/app.js
public/assets/style.css
package.json
scripts/build.mjs
README.md
README_INSCRIPTION_ET_PLANS.md
```

## Configuration Cloudflare Pages

```text
Branche de production : main
Commande de version    : npm run build
Répertoire de sortie   : public
Répertoire racine      : vide
Infrastructure         : Aucun
```
