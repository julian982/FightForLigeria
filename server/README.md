# Serveur FightForLigeria (à venir)

Ce dossier accueillera le serveur multijoueur. Il n'est pas encore développé : le jeu actuel tourne entièrement dans le navigateur (`client/`), sur la simulation de `shared/`.

## Rôle prévu

- **Serveur de jeu qui fait autorité** : il fait tourner la simulation, reçoit les commandes des joueurs (déplacement du seigneur, tirs, constructions, ordres aux soldats) et renvoie l'état de la partie.
- **Lobbies** : parties privées avec code, places ami ou IA.
- **File classée** : matchmaking 1v1 et 2v2 avec élargissement progressif de l'écart d'Elo.
- **Elo et comptes** : calcul après chaque partie classée (avec `shared/src/elo.ts`), classement, historique.

## Stack retenue

- Node.js + TypeScript, en important directement la simulation de `shared/`.
- Colyseus pour les salles de jeu en WebSocket, Fastify pour l'API (comptes, classement).
- MariaDB (ou PostgreSQL) avec Prisma pour les comptes et l'Elo.
- Un VPS avec Docker Compose et Caddy (HTTPS), déployé par une GitHub Action à chaque push sur `main`.

Le client restera servi par GitHub Pages et se connectera au serveur en WebSocket.
