# GLOBAL MARKET V5.4 — Quartiers locaux et expédition hors ville

## Corrections intégrées

- Les livraisons **hors de la ville de la boutique** n'appliquent jamais le frais de base calculé par pourcentage : seul le frais du moyen d'expédition choisi est ajouté.
- Pour une livraison dans la **ville de la boutique** (notamment DIABO), le panier affiche un champ **Quartier de livraison**.
- La configuration Marketplace contient une liste préremplie de **10 choix locaux** : `RETRAIT A LA BOUTIQUE` verrouillé + `QUARTIER 1` à `QUARTIER 9`, modifiables par l'administrateur.
- Le **retrait à la boutique** entraîne toujours **0 FCFA** de frais.
- Pour un quartier local autre que le retrait, le frais est calculé automatiquement selon le barème en pourcentage du sous-total.
- Quand la ville choisie correspond à la ville de la boutique, les moyens d'expédition ne sont pas affichés pour cette boutique.
- Les moyens d'expédition restent disponibles uniquement pour les boutiques dont la ville choisie est une destination hors ville.
- La carte « Frais d'expédition automatiques » a été supprimée du popup panier.
- Le **résumé du panier** a été déplacé dans la section **Adresse de livraison**, après les options de quartier / moyen d'expédition.
- Le quartier choisi est transmis et validé côté serveur, puis enregistré dans la commande.

## Compatibilité multi-boutiques

Si un panier contient des boutiques de villes différentes, la livraison locale est traitée par quartier pour les boutiques installées dans la ville choisie, tandis que les autres boutiques utilisent leur moyen d'expédition configuré. Aucun pourcentage local n'est appliqué aux boutiques hors ville.
