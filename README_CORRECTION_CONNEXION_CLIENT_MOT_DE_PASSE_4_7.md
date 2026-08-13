# GLOBAL MARKET 4.7 — Connexion client boutique et mot de passe oublié

- Connexion client optimisée : chargement limité à l’entreprise de la boutique et reprise automatique des écritures KV.
- Réparation automatique de l’index téléphone des anciens comptes clients.
- Le mot de passe de connexion et d’inscription peut être affiché ou masqué avec une icône œil.
- Ajout du lien **Mot de passe oublié ?** dans la connexion client.
- Popup professionnel de demande : téléphone, e-mail, canal souhaité (SMS / E-mail) et motif.
- La demande est enregistrée uniquement pour l’entreprise concernée et apparaît dans **Paramètres > Demandes de mot de passe oublié** de son administrateur.
- L’administrateur peut générer un nouveau mot de passe temporaire sécurisé pour le client.
- Après génération : possibilité de copier le mot de passe, d’ouvrir un SMS prérempli ou un e-mail prérempli à destination du client.
- Les anciennes sessions du client sont invalidées automatiquement par changement de version du secret.
- Les routes publiques utilisent un chargement D1 ciblé pour limiter les risques de 503 et de timeout.
