# GLOBAL MARKET V6.1.8 — correction de la sauvegarde D1

Cette version corrige le message générique « La sauvegarde n’a pas pu être terminée ».

## Corrections
- découpage automatique des deltas navigateur en petits lots de 8 opérations ;
- plafond serveur à 45 instructions D1 par appel pour rester sous la limite Workers Free ;
- insertion groupée des lignes de commande (10 lignes par instruction SQL) ;
- repli automatique R2 vers KV si l’écriture média R2 échoue ;
- réparation ciblée automatique d’une colonne/table D1 manquante lorsqu’un ancien schéma est détecté pendant une sauvegarde ;
- diagnostics précis pour stock insuffisant, doublon téléphone/e-mail, schéma D1 obsolète, contrainte de référence et donnée obligatoire manquante ;
- les erreurs transitoires sont remises en file de nouvelle tentative sans effacer les modifications locales.

Aucun déploiement de production n’est effectué par cette archive.
