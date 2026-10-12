// Serveur de jeu FightForLigeria : liste des parties, salons d'attente et parties 1v1 en WebSocket (Colyseus).
import { Server, LobbyRoom } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './room';
import { apiRouter } from './api';
import { initDb } from './db';
import { housekeeping } from './accounts';

const port = Number(process.env.PORT) || 2567;
// les comptes (/api/...) passent par le routeur HTTP de Colyseus, sur le même port que les parties
const server = new Server({ transport: new WebSocketTransport() });
server.router = apiRouter();
// « lobby » : la liste des parties publiques, tenue à jour en direct pour les navigateurs qui la regardent
server.define('lobby', LobbyRoom);
server.define('ffl', GameRoom).enableRealtimeListing();
await server.listen(port);
// la base des comptes peut démarrer après le jeu : on s'y connecte en arrière-plan, les parties en invité marchent déjà
initDb().then(housekeeping);
console.log(`FightForLigeria : serveur prêt sur ws://localhost:${port}`);
