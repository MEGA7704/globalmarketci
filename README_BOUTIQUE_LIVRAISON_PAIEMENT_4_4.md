# GLOBAL MARKET 4.4 — Frais de livraison et choix de paiement

Correction ciblée de l’espace Boutique officielle des entreprises.

## Frais de livraison automatiques

- 5 à 4 999 FCFA : 10 %
- 5 000 à 24 999 FCFA : 5 %
- 25 000 à 99 999 FCFA : 2 %
- 100 000 FCFA et plus : 1,5 %

Le serveur recalcule toujours le sous-total, le taux, les frais et le total final. Le navigateur ne peut pas imposer un faux montant.

## Modes de paiement

- Payer à la livraison : aucune référence de transaction nécessaire.
- Payer maintenant : choix Wave ou USDT TRC20 avec les informations déjà configurées par l’entreprise. L’ID de transaction est obligatoire avant l’envoi de la commande.

## Données enregistrées

Chaque commande contient `subtotal`, `deliveryFeeRate`, `deliveryFee`, `total`, `paymentChoice`, `paymentMethod`, `paymentStatus` et `transactionId`.

Les frais de livraison sont ajoutés au rapport de vente lorsque la commande Marketplace est validée.
