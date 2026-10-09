// La connexion au serveur de jeu : créer ou rejoindre un lobby privé, puis recevoir la partie.
import { Client } from '@colyseus/sdk';
import { net } from './act';
import { applySnapshot } from './mirror';
import { $ } from '../state';

export const SRV_KEY = 'ffl.server';
/** serveur par défaut : celui fixé à la construction (GitHub Pages), sinon la machine qui sert la page en local */
export function defaultServer() {
  const built = (import.meta as any).env?.VITE_GAME_SERVER;
  if (built && location.protocol === 'https:') return built;
  return `ws://${location.hostname && location.protocol === 'http:' ? location.hostname : 'localhost'}:2567`;
}
export function serverUrl() { let v = ''; try { v = localStorage.getItem(SRV_KEY) || '' } catch (e) {} return v || defaultServer() }
/** on ne mémorise l'adresse que si elle diffère de celle par défaut (pour suivre un changement de serveur) */
export function setServerUrl(v: string) { try { v = v.trim(); if (!v || v === defaultServer()) localStorage.removeItem(SRV_KEY); else localStorage.setItem(SRV_KEY, v) } catch (e) {} }

type Handlers = { start(m: any): void, first(): void, end(m: any): void, note(msg: string, kind: string): void, lost(): void, lobby(msg: string, code?: string): void };
export let handlers: Handlers, nstate: 'idle' | 'connecting' | 'hosting' | 'playing' = 'idle', gameOver = false;
export function setNetHandlers(h: Handlers) { handlers = h }
export const netState = () => nstate;

export function bind(room: any) {
  net.room = room; gameOver = false;
  room.onMessage('joined', (m: any) => { if (m.team === 0) { nstate = 'hosting'; handlers.lobby(`Lobby ${m.code} créé : envoie ce code à ton ami. En attente de son arrivée…`, m.code) } });
  room.onMessage('start', (m: any) => { nstate = 'playing'; handlers.start(m) });
  room.onMessage('snap', (s: any) => { if (nstate !== 'playing') return; if (applySnapshot(s)) handlers.first() });
  room.onMessage('note', (n: any) => handlers.note(n.msg, n.kind || ''));
  room.onMessage('end', (m: any) => { gameOver = true; handlers.end(m) });
  room.onLeave(() => {
    const was = nstate; net.room = null; nstate = 'idle';
    if (was === 'playing' && !gameOver) handlers.lost();
    else if (was === 'hosting') handlers.lobby('Le lobby a été fermé.');
  });
}
async function connect(fn: (c: any) => Promise<any>, what: string) {
  if (nstate !== 'idle') return;
  nstate = 'connecting'; handlers.lobby(`Connexion au serveur ${serverUrl()}…`);
  try { const c = new Client(serverUrl()); bind(await fn(c)) }
  catch (e: any) {
    nstate = 'idle'; net.room = null; console.warn('connexion au serveur :', e);
    const m = String(e && e.message || e);
    handlers.lobby(/not found|introuvable|locked|full/i.test(m) ? `Lobby ${what} introuvable ou déjà complet.` : `Impossible de joindre le serveur (${serverUrl()}). Vérifie qu'il est lancé : npm run dev:server`);
  }
}
/** crée un lobby (on sera l'équipe 0, à gauche) */
export function hostGame(opts: { map: string, rich: boolean }) {
  if (nstate === 'hosting') { leaveGame(); handlers.lobby('Partie en ligne annulée.'); return Promise.resolve() }
  return connect(c => c.create('ffl', opts), '');
}
/** rejoint le lobby d'un ami avec son code */
export function joinGame(code: string) { return connect(c => c.joinById(code.trim().toUpperCase()), code.trim().toUpperCase()) }
export function leaveGame() { const r = net.room; nstate = 'idle'; net.room = null; try { r && r.leave() } catch (e) {} }
