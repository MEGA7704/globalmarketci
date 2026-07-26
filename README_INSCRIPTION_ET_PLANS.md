# GLOBAL MARKET — Inscription compacte et sécurité des comptes

## Correction de la fiche d’inscription

La modale est réduite et organisée sans défilement interne sur ordinateur :

- Informations de l’entreprise : 4 champs alignés horizontalement ;
- Spécialité : 2 champs alignés et centrés ;
- ID du responsable : 3 champs alignés horizontalement ;
- Identifiant : 2 champs alignés et centrés.

Le responsive conserve deux colonnes sur tablette et une colonne sur les petits téléphones.

## Sécurité

Aucun identifiant de connexion ni mot de passe réel n’est présent dans ce projet ou dans les documents.

Les deux valeurs suivantes doivent être créées uniquement comme **secrets chiffrés Cloudflare** :

```text
SUPER_ADMIN_EMAIL
SUPER_ADMIN_INITIAL_PASSWORD
```

Utilisez des valeurs personnelles fortes dans Cloudflare et ne les ajoutez jamais au dépôt GitHub.

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
