# Migrations D1 historiques

Ces migrations conservent le stockage historique de GLOBAL MARKET. Depuis V6.1.6, les tables snapshot qui entraient en conflit avec les noms relationnels utilisent `gm_legacy_snapshot_*` sur toute nouvelle base.

Le schéma relationnel courant est `../schema-v6.sql`. Sur une base existante créée avec une ancienne version de `0006`, le Worker exécute d'abord une réparation de compatibilité (`ensureDB`) avant la création des tables relationnelles.

Pour les tests locaux :

```bash
npm run db:migrations:local
npm run db:v6:local
```

N'exécutez les variantes `:remote` qu'après sauvegarde et validation en préproduction.
