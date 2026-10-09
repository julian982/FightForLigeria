# Serveur de jeu FightForLigeria

Serveur Node.js + TypeScript (Colyseus) pour les parties en ligne. **Étape 2 : lobbies privés 1v1, en local.**

```
npm run dev:server     # construit puis lance le serveur sur ws://localhost:2567 (PORT=… pour changer)
npm run test:server    # lance le serveur, deux faux joueurs créent/rejoignent un lobby et jouent
```

## Comment ça marche

- `src/index.ts` : le serveur Colyseus, une seule salle `ffl`.
- `src/room.ts` : un lobby privé. Son identifiant est le code à partager (`LOIRE-7K2M`). Le créateur joue l'équipe 0 (à gauche), l'invité l'équipe 1. La partie démarre quand les deux sont là ; un départ en cours de partie = abandon.
- `src/worker.ts` : chaque partie tourne dans son propre *worker thread* avec la simulation de `shared/` (60 pas par seconde), ce qui isole les parties entre elles.
- `shared/src/net.ts` : le protocole commun.
  - Le navigateur envoie des **commandes** (`steer`, `charge`, `release`, `place`, `recruit`, `move`, `attack`, `demolish`). Le serveur les vérifie avec les mêmes règles que le solo.
  - Le serveur renvoie un **instantané** de la partie 20 fois par seconde (positions, vie, ressources, flèches, effets, arbres abattus), plus les messages pour chaque joueur et la fin de partie.
- Côté navigateur, `client/src/net/` reconstruit la partie à partir des instantanés et lisse les mouvements.

## Prochaines étapes

3. Netcode : prédiction du seigneur local et interpolation plus fine (moins de latence ressentie).
4. Comptes et base de données (Fastify + Prisma + MariaDB ou PostgreSQL).
5. File classée et Elo (`shared/src/elo.ts`).
6. 2v2.
7. Déploiement : image Docker (`server/Dockerfile`) et guide VPS dans [`deploy/`](../deploy/README.md) — fait.
