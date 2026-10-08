# Serveur FightForLigeria (à venir)

Ce dossier accueillera le serveur multijoueur. Il n'est pas encore développé : le jeu actuel tourne entièrement dans le navigateur (`client/`).

## Rôle prévu

- **Serveur de jeu qui fait autorité** : il fait tourner la simulation, reçoit les commandes des joueurs (déplacement du seigneur, tirs, constructions, ordres aux soldats) et renvoie l'état de la partie.
- **Lobbies** : parties privées avec code, places ami ou IA.
- **File classée** : matchmaking 1v1 et 2v2 avec élargissement progressif de l'écart d'Elo.
- **Elo et comptes** : calcul après chaque partie classée (reprendre l'objet `ELO` de `client/index.html`), classement, historique.

## Pistes techniques

- Node.js + WebSocket pour réutiliser directement la simulation du client, ou ASP.NET Core + SignalR.
- Base de données MariaDB pour les comptes et l'Elo.
- Hébergement sur un petit VPS, déployé par une GitHub Action à chaque push sur `main`.

Le client restera servi par GitHub Pages et se connectera au serveur en WebSocket.
