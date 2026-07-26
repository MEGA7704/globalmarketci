# GLOBAL MARKET — Correction connexion et vitesse 2.5

## Connexion
La fiche de connexion apparaît immédiatement. La restauration d'une session existante se déroule en arrière-plan avec un délai court et ne bloque plus l'affichage.

## Création d'entreprise
Après la création sécurisée, le Worker renvoie directement la session et les données déjà limitées à la nouvelle entreprise. Le navigateur ne lance plus une seconde lecture complète de la base.

## Sécurité conservée
- mot de passe vérifié et haché côté Worker ;
- cookie HttpOnly/Secure ;
- données filtrées par entreprise ;
- aucune empreinte ou sel de mot de passe transmis ;
- limitation des tentatives ;
- KV et D1 conservés.

## Cloudflare Pages
- Commande de version : `npm run build`
- Répertoire de sortie : `public`
- Répertoire racine : vide
- Branche de production : `main`
