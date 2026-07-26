# GLOBAL MARKET — Suppression sécurisée des comptes entreprises (version 2.9)

## Modification ciblée

La section **Super Admin → Gestion professionnelle des entreprises inscrites** permet désormais de supprimer définitivement un compte entreprise.

## Protection de la suppression

La suppression exige :

1. une session Super Admin valide ;
2. le jeton CSRF de la session ;
3. une première confirmation ;
4. la saisie exacte du nom de l’entreprise ;
5. la saisie du mot `SUPPRIMER`.

L’API `POST /api/companies/delete` refuse tout autre rôle.

## Éléments retirés

- fiche de l’entreprise ;
- utilisateurs de l’entreprise ;
- identifiants sécurisés de ces utilisateurs ;
- sessions actives des utilisateurs ;
- clients de la boutique et leurs accès ;
- données actives liées à l’entreprise : stocks, ventes, commandes, paiements, rapports et paramètres.

Le journal de sécurité D1 conserve une trace administrative de l’opération.

## Déploiement Cloudflare

- Branche : `main`
- Commande : `npm run build`
- Répertoire de sortie : `public`
- Répertoire racine : vide
