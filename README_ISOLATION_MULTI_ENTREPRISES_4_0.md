# GLOBAL MARKET 4.0 — Isolation réelle des entreprises

Cette version remplace la sauvegarde active dans un état global unique par une organisation isolée dans les ressources Cloudflare déjà configurées.

## Aucune nouvelle ressource Cloudflare à créer

La version utilise uniquement les bindings existants :

```text
GLOBAL_MARKET_KV
GLOBAL_MARKET_D1
```

Il ne faut créer ni nouveau namespace KV, ni nouvelle base D1.

## Nouvelle organisation du stockage

Le même KV contient désormais :

```text
state:catalog:v5
state:company:v5:<company_id>
session:<session_id>
auth:user:<user_id>
```

- `state:catalog:v5` contient uniquement la liste des entreprises et les profils publics des utilisateurs.
- Chaque clé `state:company:v5:<company_id>` contient uniquement les produits, ventes, clients, commandes, stocks, paniers, rapports et paramètres de l’entreprise correspondante.
- Les identifiants de connexion restent séparés des données de l’application.

Dans D1, les tables `state_meta`, `state_chunks` et `backups` utilisent déjà la colonne `company_id`. Chaque entreprise possède donc ses propres lignes et ses propres sauvegardes.

## Migration automatique sans perte

Au premier appel après déploiement :

1. le Worker recherche le nouveau catalogue ;
2. s’il n’existe pas, il lit l’ancien état `company:global_market_all` ;
3. il crée une clé et un état D1 indépendants pour chaque entreprise ;
4. il crée le catalogue global ;
5. il conserve l’ancienne clé comme sauvegarde historique en lecture seule.

L’ancien état n’est plus réécrit après la migration.

## Protection contre les conflits

Chaque état d’entreprise possède un numéro de révision.

Lorsqu’un appareil essaie d’enregistrer une ancienne version, le serveur répond avec :

```text
409 COMPANY_DATA_CONFLICT
```

Le navigateur sérialise également les sauvegardes : une seconde sauvegarde attend la fin de la première au lieu de l’écraser.

Conséquences :

- une entreprise ne réécrit plus les données d’une autre ;
- deux sauvegardes du même navigateur ne partent plus simultanément ;
- une modification ancienne ne peut plus remplacer silencieusement une modification récente ;
- le Super Admin ne réécrit que les entreprises réellement modifiées.

## Tests intégrés

La commande suivante exécute les contrôles statiques et un test multi-entreprises en mémoire :

```bash
npm run validate
```

Le test vérifie :

- la création de deux entreprises ;
- l’existence de deux clés KV indépendantes ;
- l’absence de fuite de produits entre les entreprises ;
- le refus d’une sauvegarde obsolète ;
- la migration automatique de l’ancien état global ;
- la conservation de la sauvegarde historique.

## Déploiement

```text
Branche : main
Commande de construction : npm run build
Répertoire de sortie : public
Répertoire racine : vide
```

Avant le premier déploiement de cette version, il est recommandé de conserver une exportation de sécurité du projet et des données. La migration est automatique et l’ancien état reste conservé, mais une sauvegarde externe demeure une bonne pratique.
