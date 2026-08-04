# GLOBAL MARKET 3.9 — Rapport bilan lié à l’entreprise connectée

Cette mise à jour corrige le **Rapport bilan détaillé de l’entreprise**.

## Correction principale

Le rapport imprimé ou enregistré en PDF n’utilise plus une identité d’entreprise fixe. Il récupère automatiquement les informations de l’entreprise rattachée à la session active :

- raison sociale et identité légale ;
- RCCM et compte contribuable ;
- adresse, téléphone, e-mail et activité ;
- capital social, devise, responsable, logo, signature et cachet lorsqu’ils sont renseignés ;
- couleurs principales du rapport ;
- ventes, catégories, produits, services, frais, charges et obligations du mois actif.

Le Worker Cloudflare continue d’isoler les données avec l’identifiant de l’entreprise contenu dans la session sécurisée. Les données envoyées au navigateur par `/api/load` sont déjà limitées à cette entreprise.

## Nouveau modèle A4

Le rapport dispose maintenant :

- d’un en-tête officiel dynamique ;
- d’un tableau détaillé de neuf colonnes ;
- d’un résumé financier complet ;
- du total des frais de service ;
- du nombre total de ventes ;
- des obligations du mois sélectionné ;
- d’un résultat net après obligations ;
- d’une signature dynamique ;
- d’une numérotation unique ;
- d’un export Excel au format CSV ;
- d’une impression A4 portrait optimisée.

## Paramétrage

Dans **Mon compte > Modifier informations entreprise**, l’administrateur peut désormais renseigner :

- le capital social ;
- la devise ;
- la fonction du responsable ;
- le logo ;
- les couleurs du rapport ;
- la signature ;
- le cachet.

Les champs absents sont masqués proprement et aucune valeur `undefined`, `null` ou `NaN` ne doit apparaître.

## Déploiement

```bash
npm run build
npx wrangler pages deploy public --project-name=globalmarketci
```

Répertoire de sortie Cloudflare Pages : `public`.
