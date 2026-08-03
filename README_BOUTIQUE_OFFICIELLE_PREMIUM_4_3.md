# GLOBAL MARKET 4.3 — Boutique officielle premium

## Correction ciblée

Cette version modifie uniquement la boutique publique officielle de chaque entreprise accessible par `#boutique/<entreprise>`.

## Interface ajoutée

- En-tête vert émeraude avec logo sac sécurisé, nom et activité de l’entreprise.
- Recherche instantanée et sélection des catégories.
- Accès au compte client et au panier existant.
- Navigation Toutes catégories, Promotions et Nouveautés.
- Bannière commerciale dynamique avec les photos publiées par l’entreprise.
- Sept univers populaires avec comptage réel des produits disponibles.
- Catalogue responsive avec filtres, promotions, nouveautés et ajout au panier.
- Statistiques de confiance calculées à partir des commandes de l’entreprise.
- Mise en page ordinateur, tablette et téléphone.

## Données dynamiques

Le nom, le slogan, les catégories, les produits, les services, les prix, les photos, les stocks, le panier et les commandes sont ceux de l’entreprise inscrite. Aucune donnée d’une autre entreprise n’est affichée.

## Éléments inchangés

- Connexion et inscription GLOBAL MARKET.
- Tableau de bord.
- Vente et panier interne.
- Super Admin.
- Encaissement transactionnel.
- Worker Cloudflare, sessions, KV, D1 et sécurité.

## Déploiement

- Branche : `main`
- Commande : `npm run build`
- Sortie : `public`
- Répertoire racine : vide
