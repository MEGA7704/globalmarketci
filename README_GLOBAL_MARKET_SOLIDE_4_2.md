# GLOBAL MARKET 4.2 — Encaissement transactionnel et code modulaire

Cette version renforce la fiabilité des ventes simultanées sans créer de nouveau KV ni de nouvelle base D1.

## Ressources Cloudflare conservées

```text
KV : GLOBAL_MARKET_KV
D1 : GLOBAL_MARKET_D1
```

## Encaissement côté serveur

La validation du panier utilise maintenant :

```text
POST /api/cart/checkout
```

Le navigateur envoie uniquement :

- la révision actuelle de l’entreprise ;
- les identifiants des lignes du panier ;
- le client choisi ;
- une clé d’idempotence unique.

Le Worker effectue ensuite côté serveur :

1. le contrôle de la session et du rôle ;
2. le contrôle CSRF ;
3. la vérification de la révision ;
4. la vérification de l’appartenance des lignes au caissier ;
5. le contrôle du stock réel ;
6. la diminution du stock ;
7. la validation des lignes de vente ;
8. la création d’un numéro d’encaissement unique ;
9. l’enregistrement des mouvements de stock ;
10. la publication atomique du nouveau snapshot D1.

## Protection contre les doubles clics

Chaque encaissement utilise une clé unique dans :

```text
gm_checkout_requests
```

La même demande ne peut donc pas créer deux ventes, même si le bouton est cliqué plusieurs fois ou si une réponse réseau arrive en retard.

## Concurrence entre deux caissiers

Deux caissiers qui tentent de vendre le dernier article disponible à partir de la même révision ne peuvent pas produire un stock négatif :

- une seule validation est acceptée ;
- la seconde reçoit une erreur de conflit ;
- sa ligne reste dans son panier ;
- elle peut actualiser et corriger sa commande.

Les paniers des comptes Caisse sont filtrés par `userId`. Un administrateur conserve la visibilité générale de l’entreprise.

## Numéro unique

Chaque encaissement reçoit un numéro du type :

```text
VTE-20260803-XXXXXXXXXX
```

Toutes les lignes validées ensemble portent ce même numéro.

## Découpage du programme

Le grand fichier navigateur a été séparé en modules chargés dans cet ordre :

```text
app.js
app-sales.js
app-admin.js
app-bootstrap.js
```

Les styles sont séparés en :

```text
style.css
style-sales.css
style-admin.css
```

Le Worker utilise également :

```text
public/server/checkout.js
public/server/session-utils.js
```

Les 22 anciennes déclarations de fonctions dupliquées ont été supprimées. Le validateur bloque désormais automatiquement toute nouvelle duplication de nom de fonction.

## Migration D1

Le fichier suivant est inclus :

```text
cloudflare/migrations/0007_transactional_checkout.sql
```

Le Worker crée aussi automatiquement la table au premier appel, afin de conserver la compatibilité avec Cloudflare Pages.

## Tests inclus

```bash
npm run validate
npm run test:isolation
npm run test:e2e
npm run check
```

Les tests vérifient notamment :

- la syntaxe de tous les modules ;
- l’absence de fonctions dupliquées ;
- l’isolation de deux entreprises ;
- la migration depuis l’ancien stockage ;
- la reconstruction des gros enregistrements ;
- l’idempotence d’un encaissement ;
- deux caissiers concurrents sur le dernier article ;
- la présence de la connexion avant l’inscription ;
- l’ouverture et le centrage du popup d’inscription.

Le test navigateur possède un contrôle structurel de repli lorsque l’environnement interdit à Chromium l’accès au serveur local.

## Déploiement

```text
Branche : main
Commande : npm run build
Sortie : public
Racine : vide
Framework : Aucun
```

Après le déploiement, `/api/health` doit retourner notamment :

```json
{
  "storageVersion": 7,
  "storageMode": "transactional-checkout-v7"
}
```
