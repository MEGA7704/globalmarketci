# GLOBAL MARKET V5.5.1 — Compte client et réinitialisation

Corrections ciblées uniquement, sans modification des commandes, paiements, messagerie ou architecture de stockage existante.

## Compte client
- Ajout du bouton **Mon compte** dans l'espace client.
- Affichage dans le même popup des informations personnelles et du compte : numéro client, statut, identifiant de connexion et date de création.
- Modification du nom, e-mail et téléphone.
- Le téléphone reste l'identifiant de connexion GLOBAL MARKET.
- Modification sécurisée du téléphone et du mot de passe avec vérification du mot de passe actuel.
- Mise à jour de l'index de connexion serveur lors d'un changement de téléphone.

## Mot de passe oublié — compte client
- Ajout du lien **Mot de passe oublié ?** dans le popup de connexion client.
- La demande est transmise au Super Admin GLOBAL MARKET.
- Les demandes client apparaissent dans l'espace Super Admin avec les demandes Administrateur boutique.
- Le Super Admin peut générer un mot de passe temporaire pour le compte client.

## Réinitialisation compte boutique
- Texte remplacé par : **Administrateur réinitialisé par Globalmarket et Caisse réinitialisé par votre Administrateur**.
- La ligne de filtres/recherche de l'accueil est masquée pendant l'ouverture du popup de réinitialisation afin de ne plus apparaître derrière celui-ci.

## Validation
- `npm run build` : OK.
- Worker, sécurité, KV, D1 et configuration Cloudflare : validation existante OK.
