// Une salle = un salon d'attente (joueurs, réglages, « prêt », discussion), puis une partie qui tourne dans un worker.
// Les salons publics apparaissent dans la liste des parties (salle « lobby » de Colyseus), les privés seulement par leur code.
import { Room, type Client } from '@colyseus/core';
import { Worker } from 'node:worker_threads';
import { MAPS } from '@ffl/shared';

const WORDS = ['LOIRE', 'CHER', 'VIENNE', 'TOURS', 'CHINON', 'AMBOISE', 'INDRE'], AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pick = (s: string | string[]) => s[Math.random() * s.length | 0];
export const makeCode = () => pick(WORDS) + '-' + Array.from({ length: 4 }, () => pick(AL)).join('');

/** codes de fermeture envoyés au client quand le serveur le fait sortir du salon */
export const KICKED = 4001;

// ---- nettoyage de ce que les joueurs envoient ----
// caractères de contrôle et d'écriture invisible (retours à la ligne, inversions de sens, espaces de largeur nulle)
const CTRL = new RegExp('[' + [[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069]].map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
/** pseudo : 3 à 16 lettres, chiffres, espaces, tirets ou soulignés */
export function cleanPseudo(v: unknown): string {
  const s = String(v ?? '').replace(CTRL, '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s.length >= 3 ? s : '';
}
export function cleanName(v: unknown, fallback: string): string {
  const s = String(v ?? '').replace(CTRL, '').replace(/\s+/g, ' ').trim().slice(0, 32);
  return s || fallback;
}
export function cleanChat(v: unknown): string { return String(v ?? '').replace(CTRL, '').replace(/\s+/g, ' ').trim().slice(0, 200) }
const SPEEDS = [1, 1.5];
export function cleanSettings(o: any, prev = { map: 'amboise', rich: false, speed: 1 }) {
  return {
    map: o && MAPS[o.map] ? o.map : prev.map,
    rich: o && 'rich' in o ? !!o.rich : prev.rich,
    speed: o && SPEEDS.includes(+o.speed) ? +o.speed : prev.speed,
  };
}

type Player = { id: string, pseudo: string, team: number, ready: boolean, at: number };
type Chat = { who?: string, team?: number, text: string, sys?: boolean };

export class GameRoom extends Room {
  maxClients = 2;
  title = '';
  priv = false;
  host = '';
  players = new Map<string, Player>();
  opts = { map: 'amboise', rich: false, speed: 1 };
  chat: Chat[] = [];
  /** anti-spam : horodatages des derniers messages de chaque joueur */
  sent = new Map<string, number[]>();
  worker: Worker | null = null;
  over = false;

  async onCreate(o: any = {}) {
    this.roomId = makeCode();
    this.opts = cleanSettings(o);
    this.priv = !!o.priv;
    this.title = cleanName(o.name, `Partie de ${cleanPseudo(o.pseudo) || 'Seigneur'}`);
    // un salon privé n'est jamais publié dans la liste (à faire avant la première publication)
    if (this.priv) await this.setPrivate(true);
    this.syncMeta();

    this.onMessage('cmd', (client, cmd) => {
      const p = this.players.get(client.sessionId);
      if (!p || !this.worker || this.over) return;
      this.worker.postMessage({ type: 'cmd', team: p.team, cmd });
    });
    this.onMessage('ready', (client, v) => {
      const p = this.players.get(client.sessionId);
      if (!p || this.worker) return;
      p.ready = !!v; this.pushState();
    });
    this.onMessage('settings', (client, v) => {
      if (client.sessionId !== this.host || this.worker) return;
      const next = cleanSettings(v, this.opts);
      if (next.map === this.opts.map && next.rich === this.opts.rich && next.speed === this.opts.speed) return;
      this.opts = next;
      // un changement de réglage remet tout le monde « pas prêt » : personne ne lance sur une carte qu'il n'a pas vue
      for (const p of this.players.values()) p.ready = false;
      this.system(`L'hôte a changé les réglages : ${MAPS[next.map].name}, stock ${next.rich ? 'généreux' : 'normal'}, vitesse ${next.speed > 1 ? 'rapide' : 'normale'}.`);
      this.syncMeta(); this.pushState();
    });
    this.onMessage('kick', (client, id) => {
      if (client.sessionId !== this.host || this.worker || id === this.host) return;
      const target = this.clients.find(c => c.sessionId === id);
      if (target) { this.system(`${this.players.get(id)?.pseudo} a été exclu du salon.`); target.leave(KICKED) }
    });
    this.onMessage('chat', (client, v) => {
      const p = this.players.get(client.sessionId), text = cleanChat(v);
      if (!p || !text) return;
      const now = Date.now(), times = (this.sent.get(client.sessionId) || []).filter(t => now - t < 5000);
      if (times.length >= 5) { client.send('chatRefused', { msg: 'Doucement : 5 messages toutes les 5 secondes au plus.' }); return }
      times.push(now); this.sent.set(client.sessionId, times);
      this.say({ who: p.pseudo, team: p.team, text });
    });
    this.onMessage('launch', client => {
      if (client.sessionId !== this.host || this.worker) return;
      if (this.players.size < 2) return client.send('chatRefused', { msg: 'Il faut un adversaire pour lancer la partie.' });
      if ([...this.players.values()].some(p => !p.ready)) return client.send('chatRefused', { msg: 'Tout le monde doit être prêt.' });
      this.startGame();
    });
  }

  onJoin(client: Client, o: any = {}) {
    const used = new Set([...this.players.values()].map(p => p.pseudo.toLowerCase()));
    let pseudo = cleanPseudo(o.pseudo) || 'Seigneur', n = 2;
    const base = pseudo.slice(0, 13);
    while (used.has(pseudo.toLowerCase())) pseudo = `${base} ${n++}`;
    const team = [...this.players.values()].some(p => p.team === 0) ? 1 : 0;
    this.players.set(client.sessionId, { id: client.sessionId, pseudo, team, ready: false, at: Date.now() });
    if (!this.host) this.host = client.sessionId;
    client.send('chatLog', this.chat);
    this.system(this.players.size === 1 ? `${pseudo} a ouvert le salon.` : `${pseudo} a rejoint le salon.`);
    this.syncMeta(); this.pushState();
  }

  onLeave(client: Client) {
    const p = this.players.get(client.sessionId);
    this.players.delete(client.sessionId); this.sent.delete(client.sessionId);
    if (!p) return;
    // quitter une partie en cours = abandon : l'adversaire gagne
    if (this.worker) {
      if (!this.over) { this.clientOf(1 - p.team)?.send('note', { msg: 'Ton adversaire a quitté la partie', kind: 'warn' }); this.worker.postMessage({ type: 'forfeit', team: p.team }) }
      return;
    }
    // dans le salon : si l'hôte part, le joueur restant devient l'hôte
    for (const q of this.players.values()) q.ready = false;
    if (this.host === client.sessionId) {
      const next = this.players.values().next().value as Player | undefined;
      this.host = next ? next.id : '';
      this.system(next ? `${p.pseudo} a quitté le salon. ${next.pseudo} devient l'hôte.` : `${p.pseudo} a quitté le salon.`);
    } else this.system(`${p.pseudo} a quitté le salon.`);
    this.syncMeta(); this.pushState();
  }

  /** infos publiées dans la liste des parties */
  syncMeta() {
    const host = this.players.get(this.host);
    this.setMetadata({ name: this.title, host: host ? host.pseudo : '', map: this.opts.map, rich: this.opts.rich, speed: this.opts.speed, mode: '1v1', playing: !!this.worker });
  }
  /** état complet du salon, envoyé à chaque changement (deux joueurs : pas besoin de plus fin) */
  pushState() {
    if (this.worker) return;
    const players = [...this.players.values()].sort((a, b) => a.team - b.team).map(p => ({ id: p.id, pseudo: p.pseudo, team: p.team, ready: p.ready, host: p.id === this.host }));
    for (const c of this.clients) c.send('salon', { code: this.roomId, name: this.title, priv: this.priv, host: this.host, you: c.sessionId, max: this.maxClients, ...this.opts, players });
  }
  say(m: Chat) { this.chat.push(m); if (this.chat.length > 40) this.chat.shift(); this.broadcast('chat', m) }
  system(text: string) { this.say({ text, sys: true }) }

  startGame() {
    this.lock();
    const w = this.worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: this.opts });
    w.on('message', m => {
      if (m.type === 'snap') this.broadcast('snap', m.snap);
      else if (m.type === 'note') this.clientOf(m.team)?.send('note', { msg: m.msg, kind: m.kind });
      else if (m.type === 'end') { this.over = true; this.broadcast('end', { winner: m.winner, st: m.st, t: m.t }); setTimeout(() => this.disconnect(), 3000) }
    });
    w.on('error', e => { console.error('partie', this.roomId, e); this.disconnect() });
    this.syncMeta();
    for (const c of this.clients) { const p = this.players.get(c.sessionId)!; c.send('start', { team: p.team, code: this.roomId, ...this.opts }) }
    console.log(`partie ${this.roomId} lancée (${this.opts.map})`);
  }
  clientOf(team: number) { return this.clients.find(c => this.players.get(c.sessionId)?.team === team) }
  onDispose() { this.worker?.terminate(); this.worker = null }
}
