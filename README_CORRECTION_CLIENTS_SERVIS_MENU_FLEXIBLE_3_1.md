# GLOBAL MARKET — Correction ciblée 3.1.0

## Périmètre modifié

Uniquement la section **Ventes**, le **Rapport bilan détaillé de l’entreprise** et le comportement du **menu horizontal**.

## Ventes

- Ajout du champ obligatoire **Nb de Clients servis** dans le formulaire commun de vente de produit et de service.
- Valeur minimale : 1.
- La valeur est enregistrée dans chaque vente sous la propriété `clientsServed`.
- Le champ est également modifiable depuis la fenêtre de modification d’une vente.
- Les anciennes ventes restent compatibles et sont comptées comme un client servi lorsqu’aucune valeur historique n’existe.

## Rapport bilan détaillé

Dans **Ventes généralisées des produits et services vendus**, la colonne **Clients servis** additionne maintenant les nombres saisis dans les formulaires de vente.

Le résumé financier utilise la même méthode de calcul.

## Menu horizontal

- La barre supérieure reste visible pendant le défilement vertical.
- Le menu s’adapte à la largeur disponible.
- Sur les écrans étroits, il défile horizontalement à la souris, au pavé tactile ou au toucher.
- La section active est automatiquement recentrée.

## Éléments non modifiés

Connexion, inscription, Super Admin, abonnements, stocks, clients, marketplace, Cloudflare KV, D1 et logique serveur.
