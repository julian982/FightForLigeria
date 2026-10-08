# FightForLigeria

Jeu de stratégie médiévale en temps réel dans le navigateur, en 3D isométrique low poly, sur les bords de Loire en Touraine. Inspiré de Stronghold, mais plus court et plus direct : ton seigneur est un archer que tu diriges toi-même, et la partie s'arrête dès qu'un des deux seigneurs tombe.

## Organisation du dépôt

Un monorepo TypeScript (workspaces npm) :

```
fightforligeria/
├── shared/      → la simulation pure, sans Three.js ni DOM (partagée avec le futur serveur)
│   ├── src/
│   │   ├── config.ts   règles et équilibrage (bâtiments, unités, coûts)
│   │   ├── maps.ts     les cartes, l'eau, le relief, les arbres
│   │   ├── state.ts    l'état de la partie et les « hooks » vers le client
│   │   ├── nav.ts      obstacles, A*, glissement, ligne de tir
│   │   ├── game.ts     la simulation et les commandes des joueurs
│   │   ├── ai.ts       l'IA (seigneur, économie, vagues)
│   │   └── elo.ts      le calcul de l'Elo
│   └── test/           tests automatiques (vitest)
├── client/      → le jeu dans le navigateur (Three.js, construit avec Vite)
│   ├── index.html      les pages et le HUD
│   ├── css/
│   └── src/
│       ├── render/     moteur 3D, décor, modèles, synchro scène, minicarte
│       └── ui/         accueil, HUD, entrées clavier/souris, écran de fin
├── server/      → le futur serveur multijoueur (pas encore développé)
└── .github/workflows/pages.yml → tests puis déploiement sur GitHub Pages à chaque push
```

La simulation ne dessine rien : le client lit l'état `G` pour afficher la scène, envoie les actions du joueur par des commandes (`steer`, `startCharge`, `releaseCharge`, `placeBuilding`, `recruit`, `orderMove`, `orderAttack`) et reçoit les événements par des hooks (`removed`, `notify`, `end`, `reset`). C'est ce découpage qui permettra au serveur de faire tourner la même simulation.

## Lancer le jeu

L'accueil a trois pages : **Jouer** (couleur du royaume, carte et parties), **Classement** et **Comment jouer**.

Le plus simple : l'adresse GitHub Pages du dépôt, mise à jour automatiquement à chaque push sur `main`.

En local (Node.js 22) :

```
npm install
npm run dev          # serveur de développement Vite
npm test             # tests de la simulation
npm run typecheck    # vérification des types
npm run build        # site statique dans client/dist
npm run build:single # un seul fichier HTML autonome dans client/dist-single
```

Clavier et souris requis.

## Contrôles

| Touche | Action |
|---|---|
| Z Q S D | Déplacer ton seigneur (la caméra le suit) |
| Espace maintenue | Bander l'arc, relâcher pour tirer (la charge augmente portée et dégâts) |
| Molette | Zoomer |
| A · E (Q · E en QWERTY) | Tourner la caméra autour du seigneur |
| Clic molette maintenu | Tourner (gauche/droite) et incliner (haut/bas) la caméra |
| Page ↑ · Page ↓, Maj + molette | Incliner la caméra |
| V | Vue seigneur (première personne) : ZQSD pour marcher, Espace ou clic pour tirer ; V ou Échap pour revenir |
| 1 à 9, 0, ) | Choisir un bâtiment, clic gauche pour le poser |
| R · T · Y | Recruter un archer, un lancier, un spadassin |
| Clic gauche | Sélectionner un soldat ; glisser pour en encadrer plusieurs (Maj ou Ctrl pour ajouter) |
| F | Sélectionner toute l'armée |
| Clic sur un bâtiment | Fenêtre d'info ; « Démolir » le retire et rend la moitié du coût (s'il est intact) |
| Barre « Sélection » | Clic sur un type (archers…) pour ne garder que lui, Maj + clic pour le retirer |
| Clic droit | Déplacer la sélection, ou attaquer la cible visée |
| Échap | Annuler la construction ou la sélection |

## Règles

- **Victoire** : abattre le seigneur ennemi. Sa vie n'est pas affichée.
- **Ressources** : bois, pierre (tuffeau), blé, fer. Petit stock au départ (30 bois, 10 pierre, 20 blé, 8 flèches).
- **Stockage** : réserve et grenier, gratuits, un de chaque. Bois, pierre et fer vont à la réserve, le blé au grenier, les armes et flèches au donjon. Si la réserve ou le grenier est détruit, son stock est perdu.
- **Nourriture** : ouvriers et soldats mangent 1 blé toutes les 12 s pour 4 bouches. En famine (blé à 0), ils perdent 50 % de vitesse et 25 % de vie.
- **Flèches du seigneur** : 8 au départ, une par tir. L'atelier de flèches en fabrique d'autres avec du bois. Les archers n'en consomment pas.
- **Fer** : un seul gisement, au centre de la carte, à égale distance des deux joueurs. La mine est le seul bâtiment qui se pose hors de ton territoire.
- **Ouvrier tué** : le bâtiment s'arrête (icône rouge) et un remplaçant sort du donjon 20 s plus tard.
- **Collisions** : arbres, bâtiments et rochers bloquent les unités et les flèches. Les rivières bloquent les unités (sauf sur les ponts), pas les flèches.
- **Couleur du royaume** : 8 couleurs au choix sur l'accueil, appliquées aux soldats, bâtiments, drapeaux et flèches.

### Bâtiments

| Touche | Bâtiment | Coût | Produit |
|---|---|---|---|
| 1 | Réserve | Gratuit | Stocke bois, pierre et fer |
| 2 | Grenier | Gratuit | Stocke le blé |
| 3 | Bûcheron | 6 bois | 3 bois par voyage |
| 4 | Carrière | 12 bois | 2 pierre par voyage |
| 5 | Ferme à blé | 15 bois | 5 blé par récolte |
| 6 | Atelier de flèches | 12 bois | 4 flèches pour 2 bois |
| 7 | Atelier d'arcs | 15 bois · 8 pierre | 1 arc pour 3 bois |
| 8 | Atelier de lances | 15 bois · 8 pierre | 1 lance pour 3 bois |
| 9 | Caserne | 15 bois · 23 pierre | Transforme les armes en soldats |
| 0 | Mine de fer | 30 bois · 15 pierre | 1 fer par voyage |
| ) | Forge | 20 bois · 20 pierre | 1 épée pour 2 fer et 3 bois |

### Unités (15 soldats maximum)

| Unité | Arme | PV | Dégâts | Particularité |
|---|---|---|---|---|
| Archer | 1 arc | 55 | 9 | Tire à distance, ne tire que si la voie est dégagée |
| Lancier | 1 lance | 120 | 13 | Corps à corps, plus rapide |
| Spadassin | 1 épée | 420 | 34 | Unité d'élite, flèches −50 %, vaut environ 4 lanciers |

## Cartes

Trois cartes symétriques, au choix sur la page Jouer. Les donjons, le tuffeau et le fer sont toujours aux mêmes places.

| Carte | Particularité |
|---|---|
| Rives d'Amboise | La Loire au sud, forêts sur les flancs, plaine ouverte au centre |
| Confluence du Cher | Le Cher coupe la carte en deux ; trois passages, le fer sur une île centrale |
| Forêt de Chinon | Forêt dense avec clairières, la Vienne au sud, plus de relief |

En classé, la carte sera tirée au sort parmi les trois.

## Écran de fin

À la fin de chaque partie, un bilan compare toi et l'ennemi : ennemis tués, soldats et ouvriers perdus, soldats recrutés, flèches tirées et touchées, précision, dégâts et plus long tir du seigneur, bâtiments construits, perdus et rasés, ressources produites par type, temps de famine, une courbe de la taille des armées et une courbe des ressources produites (total ou par ressource).

## Modes de jeu

- **Contre l'IA** : partie libre sur la carte choisie.
- **Partie classée** (en préparation) : file d'attente 1v1 ou 2v2, carte tirée au sort, fait bouger l'Elo.
- **Partie privée** : lobby avec code, 1v1 ou 2v2, places réglables en ami ou IA, choix de la carte, stock de départ (normal ou généreux) et vitesse (normale ou rapide). Jouable dès maintenant en 1v1 contre l'IA ; jamais classée.

## Classement et Elo (en préparation)

Deux classements indépendants, 1v1 et 2v2, avec 6 rangs de 3 divisions chacun : Bois, Pierre, Fer, Argent, Or, Rubis (100 Elo par division).

- Départ à **1000 Elo** (Bois I), 5 parties de placement.
- Chances = 1 / (1 + 10^((Elo adverse − ton Elo) / 400)) ; points = K × (résultat − chances).
- K = 80 en placement (0 à 4 parties), 40 de 5 à 29 parties, 28 ensuite. À Elo égal : ±40, ±20, ±14.
- Matchmaking : ±100 Elo pendant 20 s, ±250 jusqu'à 40 s, ±500 jusqu'à 60 s, puis n'importe qui.
- En 2v2, l'équipe vaut la moyenne de ses deux joueurs ; les deux coéquipiers gagnent ou perdent autant.
- Quitter une partie classée = défaite. À partir de la 4e partie classée contre le même adversaire dans la journée, gains et pertes divisés par deux. Pas de perte pour inactivité.

La page Classement explique ces règles et propose un simulateur de gains. Le calcul (`shared/src/elo.ts`) sera repris tel quel par le serveur.

## Où en est le projet

Prototype jouable en solo contre une IA. La simulation (`shared/`) est isolée du rendu (`client/`) et couverte par des tests automatiques : première étape vers le multijoueur.

Pistes pour la suite :
- multijoueur 1v1 puis 2v2, avec un serveur qui fait autorité ;
- lobbies en ligne et classement réel ;
- plusieurs cartes.
