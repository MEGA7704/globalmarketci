# Correction Super Admin — version 2.8.0

Cette version corrige le cas où le mot de passe Super Admin avait déjà été initialisé dans KV avec une ancienne valeur.

## Secrets Cloudflare obligatoires — environnement Production

- `SUPER_ADMIN_EMAIL` : identifiant du Super Admin
- `SUPER_ADMIN_INITIAL_PASSWORD` : mot de passe à appliquer lors de la synchronisation sécurisée

Les valeurs doivent être ajoutées dans **Workers & Pages > projet > Settings > Variables and Secrets**, en mode chiffré, puis un nouveau déploiement doit être lancé.

## Fonctionnement

La variable non sensible `SUPER_ADMIN_PASSWORD_VERSION` force une seule synchronisation du mot de passe avec le secret Cloudflare. Après la première connexion réussie, la synchronisation ne se répète plus. Les données des entreprises, ventes, stocks, abonnements, KV et D1 ne sont pas supprimées.

Sur la page de connexion, sélectionner le profil **Administrateur**.

## Diagnostic

Ouvrir `/api/health`. Les valeurs suivantes doivent être `true` :

- `superAdminEmailConfigured`
- `superAdminPasswordSecretConfigured`
- `passwordVersionSynchronized` après la première tentative de connexion Super Admin
