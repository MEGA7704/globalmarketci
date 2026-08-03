# GLOBAL MARKET 3.5 — Boutique officielle des entreprises

## Corrections appliquées

- Calcul automatique des frais de livraison sur le sous-total :
  - 5 à 4 999 F CFA : 10 % ;
  - 5 000 à 24 999 F CFA : 5 % ;
  - 25 000 à 99 999 F CFA : 2 % ;
  - 100 000 F CFA et plus : 1,5 %.
- Choix entre **Payer à la livraison** et **Payer maintenant**.
- Paiement immédiat avec les paramètres Wave Business ou USDT TRC20 déjà enregistrés par l’entreprise.
- Champ obligatoire pour l’identifiant de transaction lors d’un paiement immédiat.
- Formulaire de commande pleine largeur, défilable verticalement sur ordinateur, tablette et téléphone.
- Suppression complète de la grande bannière publicitaire.
- Boutique affichée en pleine page.
- Catalogue limité à 16 éléments par page avec boutons Précédent et Suivant.
- Total de commande enregistré avec le sous-total, le taux de livraison, les frais de livraison et le total final.

## Déploiement Cloudflare

- Branche : `main`
- Commande de build : `npm run build`
- Répertoire de sortie : `public`
