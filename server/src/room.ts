// Une salle = un lobby privé avec un code, deux joueurs, puis une partie qui tourne dans un worker.
import { Room, type Client } from '@colyseus/core';
import { Worker } from 'node:worker_threads';
import { MAPS } from '@ffl/shared';

const WORDS = ['LOIRE', 'CHER', 'VIENNE', 'TOURS', 'CHINON', 'AMBOISE', 'INDRE'], AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pick = (s: string | string[]) => s[Math.random() * s.length | 0];
export const makeCode = () => pick(WORDS) + '-' + Array.from({ length: 4 }, () => pick(AL)).join('');

export class GameRoom extends Room {
  maxClients = 2;
  teams = new Map<string, number>();
  opts = { map: 'amboise', rich: false };
  worker: Worker | null = null;
  over = false;

  onCreate(o: any = {}) {
    this.roomId = makeCode();
    this.opts = { map: MAPS[o.map] ? o.map : 'amboise', rich: !!o.rich };
    this.onMessage('cmd', (client, cmd) => {
      const team = this.teams.get(client.sessionId);
      if (team == null || !this.worker || this.over) return;
      this.worker.postMessage({ type: 'cmd', team, cmd });
    });
  }
  onJoin(client: Client) {
    const team = [...this.teams.values()].includes(0) ? 1 : 0;
    this.teams.set(client.sessionId, team);
    client.send('joined', { team, code: this.roomId, ...this.opts });
    if (this.clients.length === 2) this.startGame();
  }
  startGame() {
    this.lock();
    const w = this.worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: this.opts });
    w.on('message', m => {
      if (m.type === 'snap') this.broadcast('snap', m.snap);
      else if (m.type === 'note') this.clientOf(m.team)?.send('note', { msg: m.msg, kind: m.kind });
      else if (m.type === 'end') { this.over = true; this.broadcast('end', { winner: m.winner, st: m.st, t: m.t }); setTimeout(() => this.disconnect(), 3000) }
    });
    w.on('error', e => { console.error('partie', this.roomId, e); this.disconnect() });
    for (const c of this.clients) c.send('start', { team: this.teams.get(c.sessionId), code: this.roomId, ...this.opts });
    console.log(`partie ${this.roomId} lancée (${this.opts.map})`);
  }
  clientOf(team: number) { return this.clients.find(c => this.teams.get(c.sessionId) === team) }
  onLeave(client: Client) {
    const team = this.teams.get(client.sessionId);
    this.teams.delete(client.sessionId);
    // quitter une partie en cours = abandon : l'adversaire gagne
    if (this.worker && !this.over && team != null) { this.clientOf(1 - team)?.send('note', { msg: 'Ton adversaire a quitté la partie', kind: 'warn' }); this.worker.postMessage({ type: 'forfeit', team }) }
  }
  onDispose() { this.worker?.terminate(); this.worker = null }
}
