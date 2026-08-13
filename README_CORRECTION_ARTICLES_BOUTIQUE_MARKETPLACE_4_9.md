# GLOBAL MARKET V4.9 — Correction des articles de la boutique Marketplace

## Problème corrigé
Les produits/services enregistrés par une entreprise pouvaient ne pas apparaître dans sa boutique client, alors que la boutique elle-même s’ouvrait correctement.

## Cause
Le lien public est historiquement construit à partir du nom de l’entreprise (`slugify(name)`), alors que la route publique serveur recherchait uniquement le champ `shopSlug`. Après la compaction D1 par entreprise, le serveur pouvait donc charger seulement la base globale compacte, sans le snapshot contenant les articles.

## Corrections
- résolution d’une boutique par `shopSlug` **ou** par le nom normalisé de l’entreprise ;
- secours automatique via les snapshots/patchs D1 si l’identité de la boutique n’est pas encore présente dans la base globale compacte ;
- chargement du snapshot D1 de l’entreprise avant de retourner les articles au client ;
- affichage de tous les articles Marketplace non masqués ;
- les articles en rupture de stock restent visibles avec le badge/bouton « Rupture de stock » désactivé ;
- contrôle de stock conservé lors de l’ajout au panier ;
- aucune donnée d’une autre entreprise n’est mélangée à la boutique affichée.

## Déploiement
Déployer le contenu du ZIP sur Cloudflare Pages puis effectuer un rechargement forcé (Ctrl+F5).
