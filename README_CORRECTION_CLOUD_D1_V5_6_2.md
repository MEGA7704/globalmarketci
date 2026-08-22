# GLOBAL MARKET V5.6.2 — stabilité Cloudflare D1

Correction ciblée du message de saturation cloud.

- contrôle du schéma D1 en lecture au démarrage ; les créations de tables ne prennent plus un verrou à chaque démarrage de Worker ;
- chargement public dédupliqué pour les comptes clients ;
- cache serveur très court de 3,5 secondes sur les lectures publiques, invalidé après écriture ;
- sérialisation des écritures D1 dans un même Worker et lots plus petits ;
- reprises D1 progressives avec temporisation et jitter ;
- `STORAGE_BUSY` utilise HTTP 503 + `Retry-After`, tandis que 429 reste réservé aux limites de connexion ;
- suppression de la seconde rafale immédiate de chargement après un échec ;
- notifications espacées à 90 secondes, toujours sans chevauchement.
