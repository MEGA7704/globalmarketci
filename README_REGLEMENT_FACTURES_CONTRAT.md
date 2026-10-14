# Suivi informatif des règlements de factures sous contrat

Dans « Factures du client sous contrat », chaque ligne comporte « Régler » à côté de « Imprimer ».

- Règlement du solde complet ou montant partiel.
- Validation du montant et interdiction des versements dépassant le solde restant.
- Historique daté, montant réglé, solde à payer et statut.
- Règlements enregistrés uniquement dans `clients[].invoiceSettlements`, par période de facture.
- Aucun ajout aux ventes, à la caisse ni à `payments` : hors rapport général.

Pour déployer, utiliser le contenu de ce dossier sur Cloudflare Pages.
