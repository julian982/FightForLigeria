// Serveur de jeu FightForLigeria : lobbies privés 1v1 en WebSocket (Colyseus).
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './room';

const port = Number(process.env.PORT) || 2567;
const server = new Server({ transport: new WebSocketTransport() });
server.define('ffl', GameRoom);
await server.listen(port);
console.log(`FightForLigeria : serveur prêt sur ws://localhost:${port}`);
