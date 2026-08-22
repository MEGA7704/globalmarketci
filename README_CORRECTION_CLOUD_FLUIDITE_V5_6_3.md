# GLOBAL MARKET V5.6.3 — Fluidité cloud sans interruption

## Objectif
Éviter que les occupations temporaires Cloudflare D1 interrompent l’utilisation normale de GLOBAL MARKET.

## Corrections principales
- lecture D1 avec reprises courtes automatiques côté Worker ;
- cache KV de secours par entreprise et cache public ;
- conservation des dernières données déjà affichées pendant une indisponibilité temporaire ;
- actualisation silencieuse en arrière-plan (stale-while-revalidate) ;
- file d’écriture de secours KV lorsque D1 refuse temporairement une écriture ;
- réapplication immédiate des opérations en attente afin que l’interface reste cohérente ;
- reprise opportuniste automatique de la file vers D1 dès que le stockage redevient disponible ;
- suppression des popups bloquants liés uniquement à une saturation temporaire ;
- notifications espacées à 120 secondes et chargements réseau dédupliqués ;
- nouvelles tentatives plus progressives sur les actions sécurisées.

## Important
Les erreurs fonctionnelles réelles (mot de passe incorrect, droits insuffisants, validation métier, etc.) restent affichées. Seules les indisponibilités temporaires du stockage sont absorbées automatiquement.
