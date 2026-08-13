# GLOBAL MARKET V4.6 — Espace client et rapport clients

Correction appliquée selon le cahier des charges fourni :

- en-tête boutique : le libellé **Connexion** est remplacé par le nom du client connecté ; **Mon compte** ouvre **Espace client** et **Déconnexion** ;
- barre secondaire simplifiée : suppression de **Toutes catégories**, **Promotions** et **Nouveautés** ; conservation de **Créer un compte** et remplacement de **Espace entreprise** par **Créer ma Boutique** ;
- espace client premium avec identité dynamique, historique strictement filtré par client, statuts en badges, suivi, détail, annulation sécurisée, confirmation de réception et facture ;
- paiement à la livraison validable **sans identifiant de transaction** ; les paiements immédiats exigent toujours une référence ;
- calcul des frais de livraison conservé et recalculé côté serveur ;
- rapport général des clients enrichi : statistiques, classement, recherche, filtres de période, état sans données, rapport individuel et impression A4 paysage ;
- sécurité multi-entreprises maintenue : commandes, clients et rapports filtrés par l’entreprise de la session ;
- nouvelle route sécurisée `/api/public/order/action` avec vérification `commande.clientId === client connecté`.

Déployer le contenu du ZIP sur Cloudflare Pages puis effectuer **Ctrl + F5**.
