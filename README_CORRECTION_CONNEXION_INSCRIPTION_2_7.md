# GLOBAL MARKET — Correction connexion et inscription 2.7

## Comportement corrigé

- La page de connexion est affichée en premier à chaque ouverture sans session active.
- La fiche d’inscription reste totalement masquée au chargement.
- Le popup d’inscription s’ouvre uniquement après un clic sur le bouton **INSCRIPTION**.
- Le bouton de fermeture, le clic sur l’arrière-plan et la fermeture du popup restaurent la page de connexion.

## Mise en page du popup

- Popup centré horizontalement et verticalement.
- Largeur maximale : 1320 px.
- Toutes les lignes occupent 100 % de la largeur intérieure.
- Information de l’entreprise : 4 colonnes égales.
- Spécialité : 2 colonnes égales.
- ID du responsable : 3 colonnes égales.
- Identifiant de connexion : 2 colonnes égales.
- Champs blancs avec texte noir.
- Responsive : 2 colonnes sur tablette et 1 colonne sur téléphone.

## Sécurité

La correction ne modifie pas les routes API, les liaisons KV/D1, la vérification serveur des mots de passe, les sessions, le contrôle CSRF, la séparation des entreprises ou les règles d’abonnement.

## Configuration Cloudflare Pages

- Branche de production : `main`
- Commande de version : `npm run build`
- Répertoire de sortie : `public`
- Répertoire racine : vide
