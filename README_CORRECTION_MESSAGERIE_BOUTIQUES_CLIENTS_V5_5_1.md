# GLOBAL MARKET V5.5.1 — Messagerie boutiques / clients

Correction ciblée appliquée sur la base stable V5.5.1, sans refonte de la couche de stockage.

## Boutique publique
- Le bouton « Votre panier » de l’en-tête de la boutique est remplacé par « Nous contacter ».
- Ouverture d’un formulaire : nom, téléphone, email, objet et message.
- Le message est adressé uniquement à l’administrateur de la boutique visitée.
- Un client connecté est automatiquement associé à son message.

## Marketplace administrateur boutique
- Nouvelle section « Messages clients ».
- Consultation des demandes reçues et des réponses envoyées.
- Réponse directe au client depuis la conversation.
- Sélection individuelle ou globale des messages.
- Suppression de la sélection ou de tous les messages dans l’espace administrateur.

## Compte client
- Nouveau bouton « Messages » dans le menu et dans l’espace client.
- Consultation des messages envoyés et des réponses des boutiques.
- Envoi d’un nouveau message vers une boutique choisie.
- Réponse à un message de boutique.
- Sélection individuelle ou globale et suppression des messages de l’espace client.

## Stockage
- Ajout uniquement du tableau `marketMessages` au mécanisme de sauvegarde existant.
- Aucune nouvelle base, aucune migration D1 et aucune refonte du stockage.
- Une suppression côté client n’efface pas la copie administrateur, et inversement.

## Vérifications
- `npm run validate` : OK
- `npm run build` : OK
