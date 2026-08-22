# GLOBAL MARKET V5.6.0 — Espace client, paiements, messagerie et notifications

## Espace client
- Liste des commandes regroupée par boutique, avec détail des produits/services et statut.
- Statuts visibles : En attente, Régler ma commande, Paiement en vérification, Livraison en cours, Livrée et Commande annulée.
- Annulation client autorisée avant confirmation du paiement.
- Une commande annulée peut être supprimée définitivement par le client ; elle disparaît aussi de la liste de la boutique.
- Une commande dont le paiement est confirmé ne peut plus être supprimée.
- Onglets **Mes commandes**, **Mon compte** et **Message**.
- Modification du nom, téléphone/identifiant, email et mot de passe avec contrôle du mot de passe actuel lorsque nécessaire.

## Paiement des commandes
- Le bouton **Régler ma commande** devient disponible uniquement après validation de la commande par la boutique.
- Choix **Wave** ou **USDT TRC20**.
- QR Code généré à partir des informations de paiement configurées par la boutique vendeuse.
- Saisie obligatoire de l’ID de transaction puis bouton **J’ai payé**.
- L’administrateur voit le moyen de paiement et l’ID de transaction avant de confirmer le paiement.
- Après confirmation du paiement, la commande passe en **Livraison en cours** ; après confirmation de livraison, elle passe en **Livrée**.

## Mot de passe oublié
- Lien **Mot de passe oublié ?** ajouté à la connexion du compte client.
- La demande de réinitialisation est transmise au Super Admin GLOBAL MARKET.
- Le Super Admin peut générer un mot de passe temporaire pour le client.
- Texte de la réinitialisation boutique mis à jour et ligne de filtres/recherche supprimée du popup concerné.

## Messagerie
- Le bouton **Votre panier** de l’en-tête de la boutique publique est remplacé par **Contactez-nous**.
- Formulaire d’envoi de message à l’administrateur de la boutique.
- Nouvelle section **Messages** dans Marketplace administrateur avec consultation, réponse, sélection multiple et suppression.
- Onglet **Message** dans l’espace client avec envoi, réponse, sélection multiple et suppression.

## Notifications
- Boutique : alerte visuelle lors d’une nouvelle commande ou d’un nouveau message, avec bouton d’accès direct.
- Client : alerte lors d’un changement de statut d’une commande ou d’un nouveau message.

## Accueil / À propos
- Hero principal supprimé de l’accueil.
- Nouveau bouton **À propos**.
- Page complète et animée présentant GLOBAL MARKET, sa mission, les utilisateurs concernés et un guide de création de boutique.
- Sur téléphone, la fiche produit affiche une commande de fermeture explicite **✕ Fermer**.
