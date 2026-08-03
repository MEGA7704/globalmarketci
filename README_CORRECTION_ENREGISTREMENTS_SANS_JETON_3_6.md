# GLOBAL MARKET 3.6 — Enregistrements sans blocage du jeton de sécurité

## Correction appliquée

La route générale `POST /api/save`, utilisée pour enregistrer les ventes, stocks, clients, paramètres et autres données courantes, ne demande plus le jeton CSRF de l’onglet. Cette correction évite le message **« Jeton de sécurité invalide »** lorsqu’une reconnexion a été faite dans un autre onglet ou lorsque le jeton affiché dans l’ancienne page n’est plus synchronisé.

## Protections conservées

- session Cloudflare valide obligatoire ;
- cookie de session `HttpOnly`, `Secure` et `SameSite=Lax` ;
- contrôle strict de l’origine de la requête ;
- séparation des données entre entreprises ;
- contrôle des rôles et des comptes actifs ;
- jeton CSRF maintenu pour les opérations sensibles : utilisateurs, mots de passe, suppression d’entreprise et actions administratives.

## Résultat

Les enregistrements ordinaires peuvent se poursuivre sans être interrompus par un jeton devenu obsolète. Une session expirée demande toujours une nouvelle connexion.
