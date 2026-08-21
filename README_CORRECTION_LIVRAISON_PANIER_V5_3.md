# GLOBAL MARKET V5.3 — Livraison et panier client

Corrections intégrées :

- Le choix du **moyen d’expédition** est désormais placé dans le bloc **Adresse de livraison**, juste sous le champ **Détail sur l’adresse de livraison**.
- Pour un panier multi-boutiques, le client choisit le moyen d’expédition disponible pour chaque boutique dans ce même bloc.
- Le bouton **Mon panier** a été retiré du popup **Espace client**.
- La configuration des **villes de livraison** ne contient plus aucun champ de frais fixes : les villes servent uniquement à déclarer les destinations desservies.
- Pour la **ville de la boutique**, le pourcentage local reste appliqué lorsqu’une expédition est choisie.
- Pour les **autres villes**, seuls les frais du moyen d’expédition sont appliqués.
- **RETRAIT A LA BOUTIQUE** est obligatoire et verrouillé à **0 FCFA** : son nom, son frais et sa suppression sont bloqués dans l’interface, et le serveur impose également cette règle.
- Le retrait à la boutique reste disponible uniquement lorsque la ville de livraison correspond à la ville de la boutique.

Version : **5.3.0**.
