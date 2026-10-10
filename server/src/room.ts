// Une salle = un salon d'attente (places, réglages, « prêt », discussion), puis une partie qui tourne dans un worker.
// 1v1 : deux places. 2v2 : quatre places (0 et 2 à gauche, 1 et 3 à droite) ; l'hôte peut mettre une IA sur une place libre.
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
export type Mode = '1v1' | '2v2';
export const seatsOf = (mode: Mode) => mode === '2v2' ? 4 : 2;
export function cleanSettings(o: any, prev = { map: 'amboise', mode: '1v1' as Mode, rich: false, speed: 1 }) {
  return {
    map: o && MAPS[o.map] ? o.map : prev.map,
    mode: (o && (o.mode === '1v1' || o.mode === '2v2') ? o.mode : prev.mode) as Mode,
    rich: o && 'rich' in o ? !!o.rich : prev.rich,
    speed: o && SPEEDS.includes(+o.speed) ? +o.speed : prev.speed,
  };
}

/** une place du salon : libre, tenue par l'IA, ou par un joueur (son identifiant de session) */
type Slot = { kind: 'open' | 'ai' | 'human', id?: string };
type Player = { id: string, pseudo: string, slot: number, ready: boolean, at: number };
type Chat = { who?: string, team?: number, text: string, sys?: boolean };
const SLOT_NAMES = ['à gauche', 'à droite', 'en bas à gauche', 'en bas à droite'];

export class GameRoom extends Room {
  maxClients = 2;
  title = '';
  priv = false;
  host = '';
  players = new Map<string, Player>();
  slots: Slot[] = [];
  opts = { map: 'amboise', mode: '1v1' as Mode, rich: false, speed: 1 };
  chat: Chat[] = [];
  /** anti-spam : horodatages des derniers messages de chaque joueur */
  sent = new Map<string, number[]>();
  worker: Worker | null = null;
  over = false;

  async onCreate(o: any = {}) {
    this.roomId = makeCode();
    this.opts = cleanSettings(o);
    this.slots = Array.from({ length: seatsOf(this.opts.mode) }, () => ({ kind: 'open' as const }));
    this.priv = !!o.priv;
    this.title = cleanName(o.name, `Partie de ${cleanPseudo(o.pseudo) || 'Seigneur'}`);
    this.fitSeats();
    // un salon privé n'est jamais publié dans la liste (à faire avant la première publication)
    if (this.priv) await this.setPrivate(true);
    this.syncMeta();

    this.onMessage('cmd', (client, cmd) => {
      const p = this.players.get(client.sessionId);
      if (!p || !this.worker || this.over) return;
      this.worker.postMessage({ type: 'cmd', team: p.slot, cmd });
    });
    this.onMessage('ready', (client, v) => {
      const p = this.players.get(client.sessionId);
      if (!p || this.worker) return;
      p.ready = !!v; this.pushState();
    });
    this.onMessage('settings', (client, v) => {
      if (client.sessionId !== this.host || this.worker) return;
      const next = cleanSettings(v, this.opts);
      if (next.map === this.opts.map && next.mode === this.opts.mode && next.rich === this.opts.rich && next.speed === this.opts.speed) return;
      if (next.mode !== this.opts.mode && !this.resize(next.mode)) return client.send('chatRefused', { msg: 'Trop de joueurs dans le salon pour passer en 1v1.' });
      this.opts = next;
      // un changement de réglage remet tout le monde « pas prêt » : personne ne lance sur une carte qu'il n'a pas vue
      this.unready();
      this.system(`L'hôte a changé les réglages : ${next.mode}, ${MAPS[next.map].name}, stock ${next.rich ? 'généreux' : 'normal'}, vitesse ${next.speed > 1 ? 'rapide' : 'normale'}.`);
      this.syncMeta(); this.pushState();
    });
    // un joueur change de place (vers une place libre)
    this.onMessage('slot', (client, to) => {
      const p = this.players.get(client.sessionId), i = +to;
      if (!p || this.worker || !this.slots[i] || this.slots[i].kind !== 'open') return;
      this.slots[p.slot] = { kind: 'open' }; this.slots[i] = { kind: 'human', id: p.id }; p.slot = i; p.ready = false;
      this.pushState();
    });
    // l'hôte met une IA sur une place libre, ou la retire
    this.onMessage('slotAi', (client, v) => {
      if (client.sessionId !== this.host || this.worker || !v) return;
      const s = this.slots[+v.slot]; if (!s || s.kind === 'human') return;
      const ai = !!v.ai; if ((s.kind === 'ai') === ai) return;
      this.slots[+v.slot] = { kind: ai ? 'ai' : 'open' };
      this.fitSeats(); this.unready();
      this.system(ai ? `L'hôte a mis une IA ${SLOT_NAMES[+v.slot]}.` : `L'hôte a retiré l'IA ${SLOT_NAMES[+v.slot]}.`);
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
      this.say({ who: p.pseudo, team: p.slot, text });
    });
    this.onMessage('launch', client => {
      if (client.sessionId !== this.host || this.worker) return;
      if (this.slots.some(s => s.kind === 'open')) return client.send('chatRefused', { msg: 'Toutes les places doivent être prises (par un joueur ou une IA) pour lancer.' });
      if ([...this.players.values()].some(p => !p.ready)) return client.send('chatRefused', { msg: 'Tout le monde doit être prêt.' });
      this.startGame();
    });
  }

  /** le nombre de connexions acceptées suit le nombre de places qui ne sont pas tenues par l'IA */
  fitSeats() { this.maxClients = Math.max(1, this.slots.filter(s => s.kind !== 'ai').length) }
  unready() { for (const p of this.players.values()) p.ready = false }
  /** passe en 1v1 ou en 2v2 : les joueurs gardent leur place si elle existe encore. Refusé s'il y a trop de joueurs. */
  resize(mode: Mode) {
    const n = seatsOf(mode); if (this.players.size > n) return false;
    const next: Slot[] = Array.from({ length: n }, (_, i) => this.slots[i] && this.slots[i].kind !== 'human' ? { ...this.slots[i] } : { kind: 'open' as const });
    for (const p of [...this.players.values()].sort((a, b) => a.slot - b.slot)) {
      let i = p.slot < n && next[p.slot].kind !== 'human' ? p.slot : next.findIndex(s => s.kind !== 'human');
      next[i] = { kind: 'human', id: p.id }; p.slot = i;
    }
    this.slots = next; this.fitSeats();
    return true;
  }

  onJoin(client: Client, o: any = {}) {
    const used = new Set([...this.players.values()].map(p => p.pseudo.toLowerCase()));
    let pseudo = cleanPseudo(o.pseudo) || 'Seigneur', n = 2;
    const base = pseudo.slice(0, 13);
    while (used.has(pseudo.toLowerCase())) pseudo = `${base} ${n++}`;
    // première place libre, en alternant les camps (0 gauche, 1 droite, 2 gauche, 3 droite)
    const slot = this.slots.findIndex(s => s.kind === 'open');
    if (slot < 0) { client.leave(4002); return }
    this.slots[slot] = { kind: 'human', id: client.sessionId };
    this.players.set(client.sessionId, { id: client.sessionId, pseudo, slot, ready: false, at: Date.now() });
    if (!this.host) this.host = client.sessionId;
    client.send('chatLog', this.chat);
    this.system(this.players.size === 1 ? `${pseudo} a ouvert le salon.` : `${pseudo} a rejoint le salon.`);
    this.syncMeta(); this.pushState();
  }

  onLeave(client: Client) {
    const p = this.players.get(client.sessionId);
    this.players.delete(client.sessionId); this.sent.delete(client.sessionId);
    if (!p) return;
    // quitter une partie en cours = abandon : en 1v1 l'adversaire gagne, en 2v2 l'allié continue seul
    if (this.worker) {
      if (!this.over) {
        if (this.slots.length === 2) this.clientOf(1 - p.slot)?.send('note', { msg: 'Ton adversaire a quitté la partie', kind: 'warn' });
        this.worker.postMessage({ type: 'forfeit', team: p.slot });
      }
      return;
    }
    // dans le salon : la place se libère ; si l'hôte part, le premier joueur restant devient l'hôte
    this.slots[p.slot] = { kind: 'open' };
    this.unready();
    if (this.host === client.sessionId) {
      const next = [...this.players.values()].sort((a, b) => a.at - b.at)[0];
      this.host = next ? next.id : '';
      this.system(next ? `${p.pseudo} a quitté le salon. ${next.pseudo} devient l'hôte.` : `${p.pseudo} a quitté le salon.`);
    } else this.system(`${p.pseudo} a quitté le salon.`);
    this.syncMeta(); this.pushState();
  }

  /** infos publiées dans la liste des parties */
  syncMeta() {
    const host = this.players.get(this.host);
    this.setMetadata({ name: this.title, host: host ? host.pseudo : '', map: this.opts.map, mode: this.opts.mode, rich: this.opts.rich, speed: this.opts.speed,
      seats: this.slots.length, open: this.slots.filter(s => s.kind === 'open').length, ai: this.slots.filter(s => s.kind === 'ai').length, playing: !!this.worker });
  }
  /** état complet du salon, envoyé à chaque changement (quatre joueurs au plus : pas besoin de plus fin) */
  pushState() {
    if (this.worker) return;
    const players = [...this.players.values()].sort((a, b) => a.slot - b.slot).map(p => ({ id: p.id, pseudo: p.pseudo, team: p.slot, slot: p.slot, ready: p.ready, host: p.id === this.host }));
    const slots = this.slots.map(s => ({ kind: s.kind, id: s.id || null }));
    for (const c of this.clients) c.send('salon', { code: this.roomId, name: this.title, priv: this.priv, host: this.host, you: c.sessionId, max: this.slots.length, slots, ...this.opts, players });
  }
  say(m: Chat) { this.chat.push(m); if (this.chat.length > 40) this.chat.shift(); this.broadcast('chat', m) }
  system(text: string) { this.say({ text, sys: true }) }

  startGame() {
    this.lock();
    const ai = this.slots.map(s => s.kind === 'ai');
    const w = this.worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { ...this.opts, ai } });
    w.on('message', m => {
      if (m.type === 'snap') this.broadcast('snap', m.snap);
      else if (m.type === 'note') this.clientOf(m.team)?.send('note', { msg: m.msg, kind: m.kind });
      else if (m.type === 'end') { this.over = true; this.broadcast('end', { winner: m.winner, st: m.st, t: m.t }); setTimeout(() => this.disconnect(), 3000) }
    });
    w.on('error', e => { console.error('partie', this.roomId, e); this.disconnect() });
    this.syncMeta();
    const names = this.slots.map(s => s.kind === 'ai' ? 'IA' : this.players.get(s.id!)?.pseudo || '?');
    for (const c of this.clients) { const p = this.players.get(c.sessionId)!; c.send('start', { team: p.slot, code: this.roomId, names, ...this.opts }) }
    console.log(`partie ${this.roomId} lancée (${this.opts.mode}, ${this.opts.map})`);
  }
  clientOf(team: number) { return this.clients.find(c => this.players.get(c.sessionId)?.slot === team) }
  onDispose() { this.worker?.terminate(); this.worker = null }
}
