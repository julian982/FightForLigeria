// Serveur de jeu FightForLigeria : liste des parties, salons d'attente et parties 1v1 en WebSocket (Colyseus).
import { Server, LobbyRoom } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './room';

const port = Number(process.env.PORT) || 2567;
const server = new Server({ transport: new WebSocketTransport() });
// « lobby » : la liste des parties publiques, tenue à jour en direct pour les navigateurs qui la regardent
server.define('lobby', LobbyRoom);
server.define('ffl', GameRoom).enableRealtimeListing();
await server.listen(port);
console.log(`FightForLigeria : serveur prêt sur ws://localhost:${port}`);
