# GLOBAL MARKET 3.3.0 — Panier cliquable et modifiable

Correction ciblée dans la section **Vente** uniquement.

## Nouveau comportement

- chaque produit ou service ajouté au panier est entièrement cliquable ;
- un clic ouvre la fenêtre professionnelle de modification avant encaissement ;
- la touche **Entrée** ou **Espace** ouvre également la modification ;
- les boutons `−`, `+`, la saisie de quantité et le bouton de retrait restent indépendants ;
- la fenêtre permet de modifier la quantité, le nombre de clients servis, les montants autorisés et la note ;
- les modifications sont enregistrées dans le panier sans valider la vente ;
- l’encaissement final reste obligatoire pour intégrer les lignes aux rapports.

## Sécurité

Le Worker Cloudflare, les routes API, KV, D1, les sessions et les contrôles de rôle n’ont pas été modifiés.
