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
├── server/      → le serveur de jeu en ligne (Node.js + Colyseus) : liste des parties, salons, parties 1v1 et 2v2, comptes (MariaDB)
├── deploy/      → hébergement du serveur et de sa base sur un VPS (Docker, Traefik, guide pas à pas)
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
npm run dev:server   # serveur de jeu en ligne sur ws://localhost:2567
npm run test:server  # test de bout en bout : deux joueurs se connectent et jouent (+ les comptes si DB_HOST est défini)
```

Pour essayer les comptes en local, il faut une MariaDB. Lance le serveur avec `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` et `DB_NAME` (voir `deploy/.env.example`). Sans SMTP, les emails, et donc le lien de confirmation, s'affichent dans le terminal du serveur.

## Jouer en ligne avec un ami (serveur local)

1. Sur ton PC : `npm install`, puis `npm run dev:server` (le serveur de jeu) et, dans un autre terminal, `npm run dev` (le jeu).
2. Ouvre le jeu (`http://localhost:5173`), clique sur **Parties en ligne**, choisis ton pseudo, puis **Créer une partie** : nom, publique ou privée, carte, réglages. Tu arrives dans le salon, avec un code à partager (ex. `LOIRE-7K2M`).
3. Ton ami ouvre **Parties en ligne** : une partie publique apparaît dans la liste, il clique sur **Rejoindre**. Une partie privée n'est pas listée : il tape le code dans **Partie privée ?**.
   Dans le salon, vous discutez, l'hôte peut changer la carte et les réglages, chacun clique sur **Je suis prêt**, puis l'hôte lance. Tu joues à gauche, lui à droite.
   - Sur le même réseau (même box) : il ouvre `http://<ton-ip-locale>:5173`, le jeu trouve tout seul le serveur.
   - À distance : il faut ouvrir le port 2567 (et 5173) de ta box vers ton PC, et qu'il mette `ws://<ton-ip-publique>:2567` dans **Serveur de jeu**, en bas de la page des parties en ligne.
4. Quitter la partie (ou perdre la connexion) compte comme un abandon : l'autre gagne.

Pour héberger le serveur sur un VPS (à côté d'autres sites, sans les toucher) : voir [deploy/README.md](deploy/README.md).

Le serveur fait autorité : il fait tourner la même simulation (`shared/`) et les navigateurs ne lui envoient que des commandes. Le solo contre l'IA reste entièrement dans le navigateur.

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
| Barre « Sélection » (à droite) | Clic sur un type (archers…) pour ne garder que lui, Maj + clic pour le retirer |
| Clic droit | Déplacer la sélection, ou attaquer la cible visée (ils s'en approchent juste à portée) |
| Échap | Annuler la construction ou la sélection |
| M | Couper ou remettre le son (le bouton haut-parleur en haut règle l'ambiance nature et les bruitages séparément ; l'ambiance est tirée au hasard parmi 3 boucles de 3 minutes) |

## Règles

- **Victoire** : abattre le seigneur ennemi. Sa vie n'est pas affichée.
- **Ressources** : bois, pierre (tuffeau), blé, fer. Petit stock au départ (30 bois, 10 pierre, 20 blé, 8 flèches) : le bois et la pierre n'arrivent qu'une fois la réserve posée, le blé une fois le grenier posé.
- **Stockage** : réserve et grenier gratuits, armurerie à 5 bois, un de chaque. Bois, pierre et fer vont à la réserve, le blé au grenier, les arcs, lances et épées à l'armurerie, les flèches au donjon. Si un bâtiment de stockage est détruit, son stock est perdu.
- **Ateliers** : l'artisan (arcs, lances, flèches, forge) va chercher ses matières à la réserve, les apporte à son atelier, fabrique, puis range le résultat. S'il manque une matière, il attend devant la réserve.
- **Nourriture** : ouvriers et soldats mangent 1 blé toutes les 12 s pour 4 bouches. En famine (blé à 0), ils perdent 50 % de vitesse et 25 % de vie.
- **Flèches du seigneur** : 8 au départ, une par tir. Sur un autre seigneur, elles font 25 % de dégâts en moins. L'atelier de flèches en fabrique d'autres avec du bois. Les archers n'en consomment pas.
- **Construction** : tu poses tes bâtiments où tu veux dans ta moitié de carte (la gauche ou la droite selon ton camp ; en 2v2, la moitié est partagée avec ton allié).
- **Fer** : un seul gisement, au centre de la carte, à égale distance des deux joueurs. La mine est le seul bâtiment qui se pose hors de ta moitié de carte.
- **Pierre** : un gisement de tuffeau par joueur, dans sa moitié de carte mais à bonne distance du donjon : la carrière étire le village et doit être défendue.
- **La trêve** : en ligne, contre l'IA et en classée, les 20 premières secondes de la partie (20 vraies secondes, même en vitesse rapide) sont une trêve : aucun tir ni coup ne blesse l'ennemi, et un mur invisible (un rideau doré) empêche de franchir le milieu de la carte. Un compte à rebours s'affiche, une cloche sonne la fin. Pas de trêve dans le tutoriel.
- **Les gabarres** : de temps en temps, deux bateaux traversent la Loire en même temps, l'un depuis le bord gauche, l'autre depuis le bord droit (chaque camp voit arriver le sien). Le premier seigneur qui touche une gabarre d'une flèche fait tomber sa cargaison : +10 bois et +5 pierre, une seule fois par gabarre et par partie (sans réserve, le butin attend qu'elle soit posée).
- **Ouvrier tué** : le bâtiment s'arrête (icône rouge) et un remplaçant sort du donjon 20 s plus tard.
- **Collisions** : arbres, bâtiments et rochers bloquent les unités et les flèches. Les flèches du seigneur se plantent dans les bâtiments sans les abîmer : pour raser un bâtiment, il faut des soldats (archers, lanciers, spadassins). Les rivières bloquent les unités (sauf sur les ponts), pas les flèches.
- **Couleur du royaume** : 8 couleurs au choix sur l'accueil, appliquées aux soldats, bâtiments, drapeaux et flèches.

### Bâtiments

| Touche | Bâtiment | Coût | Produit |
|---|---|---|---|
| 1 | Réserve | Gratuit | Stocke bois, pierre et fer |
| 2 | Grenier | Gratuit | Stocke le blé |
| 3 | Bûcheron | 6 bois | 3 bois par voyage |
| 4 | Carrière | 12 bois | 3 pierre par voyage |
| 5 | Ferme à blé | 15 bois | 5 blé par récolte |
| 6 | Atelier de flèches | 12 bois | 4 flèches pour 2 bois |
| 7 | Atelier d'arcs | 15 bois · 8 pierre | 1 arc pour 3 bois |
| 8 | Atelier de lances | 15 bois · 8 pierre | 1 lance pour 3 bois |
| 9 | Caserne | 15 bois · 23 pierre | Transforme les armes en soldats |
| 0 | Mine de fer | 30 bois · 15 pierre | 1 fer par voyage |
| ) | Forge | 20 bois · 20 pierre | 1 épée pour 2 fer et 3 bois |
| = | Armurerie | 5 bois | Stocke arcs, lances et épées |

### Unités (15 soldats maximum)

Sans ordre, tes soldats tiennent leur position : ils ne poursuivent personne et ne frappent que ce qui est à leur portée (tir pour les archers, contact pour les lanciers et spadassins).

| Unité | Arme | PV | Dégâts | Particularité |
|---|---|---|---|---|
| Archer | 1 arc | 55 | 9 | Tire à distance (environ 8 à 9 cases), ne tire que si la voie est dégagée ; on le voit bander son arc avant chaque tir |
| Lancier | 1 lance | 120 | 13 | Corps à corps, plus rapide ; au combat il baisse sa lance, lève son bouclier et porte des estocs |
| Spadassin | 1 épée | 420 | 34 | Unité d'élite, flèches −50 %, vaut environ 4 lanciers |

## Cartes

Trois cartes symétriques (83 × 46 cases, agrandies de 15 % ; 83 × 92 en 2v2), au choix sur la page Jouer. Les donjons, le tuffeau et le fer sont toujours aux mêmes places.

| Carte | Particularité |
|---|---|
| Rives d'Amboise | La Loire au sud, forêts sur les flancs, plaine ouverte au centre |
| Confluence du Cher | Le Cher coupe la carte en deux ; trois passages, le fer sur une île centrale |
| Forêt de Chinon | Forêt dense avec clairières, la Vienne au sud, plus de relief |

En classé, la carte sera tirée au sort parmi les trois.

Une quatrième carte, **Le Jardin de la France**, est réservée au tutoriel : un val paisible au bord de la Loire, sans adversaire. Elle n'apparaît ni dans le choix des cartes ni en ligne.

## Écran de fin

À la fin de chaque partie, un bilan compare toi et l'ennemi : ennemis tués, soldats et ouvriers perdus, soldats recrutés, flèches tirées et touchées, précision, dégâts et plus long tir du seigneur, bâtiments construits, perdus et rasés, ressources produites par type, temps de famine, une courbe de la taille des armées et une courbe des ressources produites (total ou par ressource).

## Modes de jeu

- **Tutoriel** : sur Le Jardin de la France, sans adversaire et sans fin de partie. Un panneau présente chaque bâtiment, un par un (ce qu'il fait, sa touche, son coût) et passe au suivant dès qu'il est posé ; le bouton du bâtiment attendu clignote. « Passer le tutoriel » ferme le panneau et laisse bâtir son village librement.
- **Contre l'IA** : partie libre sur la carte choisie.
- **Partie classée** (compte requis) : file d'attente 1v1 ou 2v2, adversaires de ton niveau, carte tirée au sort, fait bouger l'Elo (voir plus bas).
- **Contre l'IA** : choix de la carte, stock de départ (normal ou généreux), vitesse (normale ou rapide) et couleur du royaume.
- **Parties en ligne** (jamais classées) : pseudo (ou compte), liste des parties publiques en direct, parties privées par code, salon d'attente avec discussion, réglages de l'hôte, « prêt » et exclusion.
  - **1v1** ou **2v2**. En 2v2, chaque carte existe en version deux fois plus haute : quatre châteaux, deux par camp l'un au-dessus de l'autre, un gisement de pierre par château et un gisement de fer par rangée.
  - Chaque joueur a son château, ses ressources et son armée ; les alliés ne se blessent jamais. Un joueur dont le seigneur tombe est éliminé (ses soldats se rendent) et regarde la suite ; un camp perd quand ses deux seigneurs sont tombés.
  - L'hôte peut mettre une IA sur une place libre (par exemple deux amis contre deux IA) ; chacun peut changer de place.
  - La discussion du salon continue pendant la partie (touche Entrée pour écrire, Échap pour fermer) et sur l'écran de fin, à côté du bilan.
  - À la fin de la partie, le salon est gardé : « Retour au salon » pour une revanche avec les mêmes réglages, ou « Quitter le salon ».

## Comptes (facultatifs)

On peut toujours jouer en invité avec un simple pseudo. Un compte réserve son pseudo, porte un blason, ouvre la partie classée et garde l'historique des parties.

- **Inscription.**
  - On donne un pseudo, un email et un mot de passe (8 caractères au moins), et on accepte les conditions d'utilisation.
  - On choisit aussi son **blason** : forme de l'écu (écu, écu français, rondache, losange, bannière), couleur du champ, partition (parti, coupé, tranché, écartelé, fasce, pal, chevron) et sa couleur, meuble (fleur de lys, tour, étoile, croix, épée, couronne, grappe, clé) et sa couleur. Il se change ensuite dans « Mon compte ».
  - **Pas de confirmation par email pour l'instant** : on est connecté dès l'inscription. Pour la remettre quand l'envoi d'emails sera en place, mettre `EMAIL_VERIFY=1` dans le `.env` du serveur (le lien est alors valable 48 h, et un compte jamais confirmé est effacé au bout de 7 jours).
- **Mon compte** : pseudo, email, blason (modifiable), déconnexion et suppression du compte.
- **Administration** (lien dans « Mon compte », visible seulement des comptes listés dans `ADMIN_EMAILS` ou `ADMIN_PSEUDOS` du `.env` du serveur) : chiffres clés (inscrits, joueurs actifs, parties, durée moyenne, cartes) et tableau des joueurs inscrits, triable et filtrable.
- **Mes parties** (menu du haut, une fois connecté) : rangs 1v1 et 2v2 (Elo, victoires, défaites, placement) et **historique des parties** : classées, en ligne et contre l'IA (date, carte, durée, résultat, adversaires et alliés, évolution de l'Elo), filtrable par type. Les parties contre l'IA sont déclarées par le navigateur : elles ne comptent jamais pour l'Elo.
- **Pseudo réservé, email caché.**
  - Le pseudo d'un compte est unique, sans tenir compte des majuscules ni des accents (`Julian` = `julian` = `Juliàn`).
  - En ligne, il porte un écusson. Un invité qui prend le même pseudo devient « Julian invité ».
  - L'email n'est jamais montré aux autres joueurs.
- **Mot de passe oublié.** Un lien valable 1 h est envoyé par email. Changer de mot de passe déconnecte toutes les sessions.
- **Suppression du compte** depuis « Mon compte », immédiate et définitive.
- **Sécurité.**
  - Les mots de passe sont hachés avec scrypt.
  - Les jetons de session et les liens envoyés par email sont stockés uniquement sous forme d'empreinte (SHA-256).
  - Le nombre de tentatives de connexion et d'inscription est limité.
  - Avec `EMAIL_VERIFY=1`, les réponses ne révèlent pas si un email a déjà un compte (sans confirmation par email, l'inscription signale un email déjà utilisé).
- **Pages légales.** Mentions légales, confidentialité et conditions d'utilisation, en pied de page. Les informations sur l'éditeur et l'hébergeur restent à compléter.

L'API des comptes est servie par le serveur de jeu, sur la même adresse (`/api/...`). La base MariaDB est propre au jeu ; le schéma est créé et mis à jour au démarrage. Si la base est en panne, les parties en invité continuent de marcher.

## Partie classée, classement et Elo

Deux classements indépendants, 1v1 et 2v2, avec 6 rangs de 3 divisions chacun : Bois, Pierre, Fer, Argent, Or, Rubis (100 Elo par division).

- Départ à **1000 Elo** (Bois I), 5 parties de placement.
- Chances = 1 / (1 + 10^((Elo adverse − ton Elo) / 400)) ; points = K × (résultat − chances).
- K = 80 en placement (0 à 4 parties), 40 de 5 à 29 parties, 28 ensuite. À Elo égal : ±40, ±20, ±14.
- Matchmaking : ±100 Elo pendant 20 s, ±250 jusqu'à 40 s, ±500 jusqu'à 60 s, puis n'importe qui.
- En 2v2, l'équipe vaut la moyenne de ses deux joueurs ; les deux coéquipiers gagnent ou perdent autant.
- Quitter une partie classée = défaite. À partir de la 4e partie classée contre le même adversaire dans la journée, gains et pertes divisés par deux. Pas de perte pour inactivité.

- **File classée** : on entre connecté, en 1v1 ou en 2v2. Le serveur apparie le joueur qui attend le plus avec les plus proches de son Elo dans sa fenêtre. En 2v2, le plus fort joue avec le plus faible. La partie est privée, réservée aux comptes appariés, et démarre dès que tous sont arrivés ; si quelqu'un ne vient pas dans les 30 s ou repart avant le début, elle est annulée sans effet sur l'Elo.
- **Fin de partie classée** : une animation montre la victoire ou la défaite, le gain ou la perte d'Elo (le compteur défile jusqu'au nouvel Elo), l'insigne et le rang actuels, la progression dans la division, et annonce une promotion ou une rétrogradation. Pendant le placement, le rang affiché est provisoire. « Rejouer en classé » relance la recherche.
- **Classement** : les 50 meilleurs joueurs placés de chaque mode (blason, rang, Elo), et ta place si tu es plus loin.

Le calcul (`shared/src/elo.ts`) est partagé par le simulateur de la page Classement et le serveur.

## Où en est le projet

Prototype jouable en solo contre une IA. La simulation (`shared/`) est isolée du rendu (`client/`) et couverte par des tests automatiques : première étape vers le multijoueur.

Pistes pour la suite :
- multijoueur 1v1 et 2v2, avec un serveur qui fait autorité (fait) ;
- lobbies en ligne (fait), comptes (fait) et classement réel (fait) ;
- plusieurs cartes.
