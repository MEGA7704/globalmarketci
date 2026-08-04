# GLOBAL MARKET 4.0 - Rapport bilan PDF A4 strict

## Correction appliquée

Le rapport bilan détaillé utilise toujours les informations et les données de l’entreprise liée à la session active.

La génération PDF a été renforcée pour respecter strictement le format A4 portrait :

- page physique A4 avec marges d’impression maîtrisées ;
- rapport centré dans la zone imprimable ;
- largeur maximale de 196 mm dans le PDF ;
- suppression de tout débordement horizontal ;
- tableau à neuf colonnes avec largeurs fixes et retour à la ligne ;
- répétition automatique de l’en-tête du tableau sur les pages suivantes ;
- lignes indivisibles entre deux pages ;
- résumé financier et signature conservés ensemble autant que possible ;
- pied de page répété avec numéro de rapport et numéro de page ;
- fenêtre d’aperçu PDF dédiée, indépendante du menu de l’application ;
- attente du chargement du logo, de la signature et du cachet avant l’ouverture de l’impression.

## Utilisation

Dans **Rapports > Rapport bilan détaillé**, sélectionner le mois et l’année, puis cliquer sur **Imprimer / Télécharger PDF**. Dans la fenêtre d’impression du navigateur, choisir **Enregistrer au format PDF**.

## Déploiement Cloudflare Pages

- Commande de build : `npm run build`
- Répertoire de sortie : `public`
- Répertoire racine : `/`
