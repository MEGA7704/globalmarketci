# GLOBAL MARKET V5.5.1 — Notifications commandes et messages

Correction ciblée ajoutée sur la base V5.5.1 existante, sans modification du stockage, des commandes, paiements ou règles métier.

## Compte boutique / administrateur
- Nouvelle commande reçue : popup « Vous avez une nouvelle commande » avec « Voir la commande ».
- Nouveau message client : popup « Vous avez un nouveau message » avec « Voir le message ».
- Le bouton ouvre directement la commande ou la conversation concernée après actualisation des données.

## Compte client
- Changement de statut d'une commande : popup avec le nouvel état et bouton « Voir la commande ».
- États signalés : commande confirmée/validée, commande annulée, paiement confirmé avec livraison en cours, commande livrée.
- Nouveau message de boutique : popup « Vous avez un nouveau message » avec « Voir le message ».

## Technique
- Deux endpoints GET légers et sans écriture : `/api/notifications` et `/api/public/notifications`.
- Vérification périodique uniquement lorsque la page est visible.
- Aucune ancienne donnée n'est notifiée à la connexion : la première lecture initialise uniquement la référence.
- Aucun changement de schéma D1, aucune migration, aucune modification de la logique de sauvegarde.
