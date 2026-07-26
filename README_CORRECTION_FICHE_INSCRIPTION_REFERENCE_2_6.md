# Correction de la fiche d’inscription — Version 2.6.0

Cette version adapte uniquement la fenêtre « FICHE D’INSCRIPTION DES ENTREPRISES » à l’image de référence fournie.

## Présentation appliquée

- grande modale centrée, vert militaire profond et doré ;
- titre doré centré et sous-titre blanc ;
- séparateur horizontal avec losange central ;
- titres de section alignés à gauche avec icônes dorées ;
- quatre champs sur la ligne « Information de l’entreprise » ;
- deux champs sur la ligne « Spécialité » ;
- trois champs sur la ligne « ID du responsable » ;
- deux champs sur la ligne « Identifiant » ;
- champs blancs, textes saisis noirs et placeholders gris foncé ;
- bouton de création doré sur toute la largeur ;
- affichage/masquage du mot de passe conservé ;
- responsive tablette et téléphone.

## Sécurité

Le fichier `public/_worker.js`, les routes API, les bindings KV/D1, la validation serveur et les règles de sécurité n’ont pas été modifiés.

## Construction Cloudflare

- Branche : `main`
- Commande : `npm run build`
- Sortie : `public`
- Répertoire racine : vide
