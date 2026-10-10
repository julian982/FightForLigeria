# Serveur de jeu FightForLigeria

Serveur Node.js + TypeScript (Colyseus) pour les parties en ligne. Liste des parties, salons d'attente et parties 1v1 ou 2v2.

```
npm run dev:server     # construit puis lance le serveur sur ws://localhost:2567 (PORT=… pour changer)
npm run test:server    # lance le serveur et joue tout le parcours : liste, salons, discussion, prêt, partie, exclusion
```

## Comment ça marche

- `src/index.ts` : le serveur Colyseus, avec deux salles :
  - `lobby` : la liste des parties publiques, tenue à jour en direct pour les navigateurs qui la regardent (salle fournie par Colyseus) ;
  - `ffl` : un salon puis une partie.
- `src/room.ts` : un salon. Son identifiant est le code à partager (`LOIRE-7K2M`).
  - Publique, il apparaît dans la liste avec son nom, son hôte, sa carte et ses réglages. Privé, il n'y apparaît jamais : on le rejoint par son code.
  - Les joueurs ont un pseudo (nettoyé, et dédoublonné si besoin). L'hôte choisit la carte, le stock et la vitesse ; tout changement remet les joueurs « pas prêt ». Il peut exclure un joueur. S'il part, l'autre devient l'hôte.
  - Discussion du salon : messages nettoyés, 200 caractères au plus, 5 messages toutes les 5 secondes par joueur.
  - Places : 2 en 1v1, 4 en 2v2 (0 et 2 à gauche, 1 et 3 à droite). L'hôte peut mettre une IA sur une place libre, et chacun peut changer de place ; le nombre de connexions acceptées suit le nombre de places sans IA.
  - L'hôte lance quand toutes les places sont prises et que tous les joueurs sont prêts. Un départ en cours de partie = abandon : en 1v1 l'adversaire gagne, en 2v2 le joueur est éliminé et son allié continue.
- `src/worker.ts` : chaque partie tourne dans son propre *worker thread* avec la simulation de `shared/` (60 pas par seconde), ce qui isole les parties entre elles.
- `shared/src/net.ts` : le protocole commun.
  - Le navigateur envoie des **commandes** (`steer`, `charge`, `release`, `place`, `recruit`, `move`, `attack`, `demolish`). Le serveur les vérifie avec les mêmes règles que le solo.
  - Le serveur renvoie un **instantané** de la partie 20 fois par seconde (positions, vie, ressources, flèches, effets, arbres abattus), plus les messages pour chaque joueur et la fin de partie.
- Côté navigateur, `client/src/net/` reconstruit la partie à partir des instantanés et lisse les mouvements.

## Prochaines étapes

3. Netcode : prédiction du seigneur local et interpolation plus fine (moins de latence ressentie).
4. Comptes et base de données (Fastify + Prisma + MariaDB ou PostgreSQL).
5. File classée et Elo (`shared/src/elo.ts`).
7. Déploiement : image Docker (`server/Dockerfile`) et guide VPS dans [`deploy/`](../deploy/README.md) — fait.
