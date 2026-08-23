# GLOBAL MARKET V5.5.1 — Correction ciblée commandes client et paiement

Base conservée : V5.5.1 avec messagerie boutiques/clients.

## Modifications ciblées
- Espace client : commandes regroupées par boutique et détails des lignes de chaque lot.
- Statuts client : En attente, Régler ma commande, Commande annulée, Paiement en attente, Livraison en cours, Livrée.
- Paiement disponible uniquement après validation de la commande par l'administrateur de la boutique.
- Popup de paiement : Wave ou USDT TRC20, QR Code selon la configuration de la boutique, ID de transaction obligatoire et bouton « J'ai payé ».
- L'ID de transaction et le moyen de paiement sont visibles dans le détail de la commande côté administrateur.
- L'administrateur confirme séparément : validation de la commande, paiement, puis livraison.
- Le client peut annuler une commande tant que le paiement n'est pas confirmé.
- Une commande annulée peut ensuite être supprimée définitivement par le client ; elle disparaît aussi de la liste de la boutique.
- Une commande dont le paiement est confirmé ne peut plus être annulée/supprimée par le client.
- Le stock est restauré lors d'une annulation et les éventuelles lignes de rapport liées à une commande annulée/supprimée sont retirées.

Aucun changement de configuration Cloudflare, de plan, de livraison, de messagerie ou d'autres paramètres métier n'a été effectué.
