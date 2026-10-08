# FightForLigeria

Jeu de stratégie médiévale en temps réel dans le navigateur, en 3D isométrique low poly, sur les bords de Loire en Touraine. Inspiré de Stronghold, mais plus court et plus direct : ton seigneur est un archer que tu diriges toi-même, et la partie s'arrête dès qu'un des deux seigneurs tombe.

## Lancer le jeu

Ouvre `index.html` dans un navigateur récent. Il n'y a rien à installer ni à compiler. Three.js et les polices se chargent depuis un CDN, il faut donc une connexion internet.

Clavier et souris requis.

## Contrôles

| Touche | Action |
|---|---|
| Z Q S D | Déplacer ton seigneur (la caméra le suit) |
| Clic gauche maintenu | Bander l'arc, relâcher pour tirer (la charge augmente portée et dégâts) |
| Molette | Zoomer |
| 1 à 8 | Choisir un bâtiment, clic gauche pour le poser |
| R · T · Y | Recruter un archer, un lancier, un spadassin |
| Maj + glisser | Sélectionner des soldats (Ctrl + Maj pour ajouter à la sélection) |
| F | Sélectionner toute l'armée |
| Clic droit | Déplacer la sélection, ou attaquer la cible visée |
| Échap | Annuler la construction ou la sélection |

## Règles

- **Victoire** : abattre le seigneur ennemi. Sa vie n'est pas affichée.
- **Ressources** : bois, pierre (tuffeau), blé, fer. Les ouvriers sortent seuls du donjon et rapportent tout au stock. Sans blé, ils travaillent deux fois moins vite.
- **Fer** : un seul gisement, au centre de la carte, à égale distance des deux joueurs. La mine est le seul bâtiment qui se pose hors de ton territoire.
- **Ouvrier tué** : le bâtiment s'arrête (icône rouge) et un remplaçant sort du donjon 20 s plus tard.
- **Collisions** : arbres, bâtiments et rochers bloquent les unités et les flèches. La Loire bloque les unités, pas les flèches.
- **Couleur du royaume** : 8 couleurs au choix sur l'accueil, appliquées aux soldats, bâtiments, drapeaux et flèches.

### Bâtiments

| Touche | Bâtiment | Coût | Produit |
|---|---|---|---|
| 1 | Bûcheron | 6 bois | 3 bois par voyage |
| 2 | Carrière | 12 bois | 2 pierre par voyage |
| 3 | Ferme à blé | 15 bois | 5 blé par récolte |
| 4 | Atelier d'arcs | 15 bois · 8 pierre | 1 arc pour 3 bois |
| 5 | Atelier de lances | 15 bois · 8 pierre | 1 lance pour 3 bois |
| 6 | Caserne | 15 bois · 23 pierre | Transforme les armes en soldats |
| 7 | Mine de fer | 30 bois · 15 pierre | 1 fer par voyage |
| 8 | Forge | 20 bois · 20 pierre | 1 épée pour 2 fer et 3 bois |

### Unités (15 soldats maximum)

| Unité | Arme | PV | Dégâts | Particularité |
|---|---|---|---|---|
| Archer | 1 arc | 55 | 9 | Tire à distance, ne tire que si la voie est dégagée |
| Lancier | 1 lance | 120 | 13 | Corps à corps, plus rapide |
| Spadassin | 1 épée | 420 | 34 | Unité d'élite, flèches −50 %, vaut environ 4 lanciers |

## Classement (en préparation)

Deux classements indépendants, 1v1 et 2v2, avec 6 rangs de 3 divisions chacun : Bois, Pierre, Fer, Argent, Or, Rubis. Départ à 1000 Elo (Bois I), après 5 parties de placement. L'écran est prêt, mais il ne sera actif qu'avec le jeu en ligne.

## Où en est le projet

Prototype jouable en solo contre une IA. Tout le jeu tient dans `index.html` : la simulation (`update`) est séparée du rendu Three.js, ce qui facilitera le passage en multijoueur.

Pistes pour la suite :
- multijoueur 1v1 puis 2v2, avec un serveur qui fait autorité ;
- lobbies en ligne et classement réel ;
- plusieurs cartes.
