# GLOBAL MARKET V6.1.7 — correction « serveur trop lent »

## Problème observé
Le navigateur pouvait afficher : « Le serveur met plus de temps que prévu à répondre… ».

## Causes corrigées
1. `ensureDB()` exécutait plusieurs `PRAGMA table_info(...)` à chaque démarrage d’un nouvel isolate avant de vérifier que le schéma V6.1.6 était déjà installé.
2. `/api/v6/bootstrap` rechargeait l’historique client (jusqu’à 1000 commandes + messages + pont historique) pendant une simple connexion ou actualisation de l’accueil.
3. La connexion client attendait ce bootstrap lourd avant d’ouvrir l’espace client.
4. Le message `AbortError` pouvait laisser croire qu’une opération critique avait forcément été synchronisée.

## Correctifs
- Chemin rapide D1 : lecture du marqueur `relational_schema_version` en premier.
- Suppression de la Promise D1 globale `dbReadyPromise` ; seul un booléen d’isolate est conservé après validation du schéma.
- Vérifications PRAGMA et réparation des snapshots uniquement si le marqueur est absent ou ancien.
- Bootstrap public limité au catalogue, entreprises et profil client.
- Commandes/messages chargés à la demande par les routes ciblées déjà présentes.
- Connexion et inscription client ouvrent l’espace dès que l’authentification serveur est confirmée ; le rafraîchissement public devient non bloquant.
- Délai de connexion client porté à 20 s avec 2 tentatives au lieu de 12 s avec 3 tentatives.
- Les erreurs de timeout indiquent désormais la nature de l’action ; une commande au statut inconnu ne doit pas être renvoyée avant vérification de « Mes commandes ».

Aucun déploiement de production n’est effectué par ces modifications.
