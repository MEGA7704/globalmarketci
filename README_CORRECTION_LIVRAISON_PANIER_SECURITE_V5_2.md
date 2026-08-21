# GLOBAL MARKET V5.2 — Livraison, panier et sécurité

Corrections principales :

- ajout d’un espace **Livraison & expédition** dans la Marketplace administrateur ;
- configuration de **10 villes maximum**, avec la ville de la boutique obligatoirement incluse ;
- frais locaux calculés automatiquement par pourcentage dans la ville de la boutique ;
- frais fixes configurables pour les autres villes ;
- moyens d’expédition configurables avec frais propres à chaque moyen ;
- panier client multi-boutiques avec ville de livraison, détail d’adresse, choix du moyen d’expédition par boutique et calcul automatique des frais ;
- suppression du texte explicatif de répartition dans le popup panier ;
- suppression du bouton **Déconnexion** dans le popup **Mon espace client** ;
- amélioration des couleurs et de la lisibilité des textes dans les popups client et panier ;
- icône afficher / masquer ajoutée aux champs de mot de passe ;
- protection contre les doubles clics sur les boutons de connexion et de création de compte client ;
- calcul et validation des frais d’expédition également effectués côté Worker Cloudflare pour éviter la falsification par le navigateur.

Le Worker conserve une compatibilité avec les anciennes commandes ne transmettant pas encore les nouveaux champs de livraison.
