# GLOBAL MARKET V5.5 — Panier horizontal et minimum hors ville

## Corrections intégrées

- Sous la liste des produits, le panier affiche désormais trois cartes de dimensions égales sur ordinateur : **Adresse de livraison**, **Moyen d’expédition**, **Résumé de la commande**.
- La carte Adresse de livraison contient la ville, le quartier lorsqu’une livraison locale est sélectionnée (notamment DIABO pour une boutique installée à DIABO), puis le détail d’adresse.
- Hors ville de la boutique, la liste Moyen d’expédition affiche uniquement le nom des moyens disponibles. Le champ Frais d’expédition est automatique et reprend uniquement les frais fixés pour le moyen choisi, sans pourcentage local.
- Dans la ville de la boutique, la livraison reste gérée par quartier : retrait boutique = 0 FCFA ; autres quartiers = frais local par pourcentage.
- Toute commande hors de la ville de la boutique doit atteindre **10 000 FCFA minimum par boutique**. Le bouton de commande est bloqué en dessous du seuil et le serveur refuse également la commande.
- Validation serveur effectuée avant toute modification de stock afin d’éviter les commandes multi-boutiques partielles en cas d’erreur de livraison.

Version : **5.5.0**.
