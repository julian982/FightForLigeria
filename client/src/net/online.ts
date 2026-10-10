// La connexion au serveur de jeu : liste des parties, salon d'attente (réglages, prêt, discussion), puis la partie.
import { Client } from '@colyseus/sdk';
import { net } from './act';
import { applySnapshot } from './mirror';

export const SRV_KEY = 'ffl.server', PSEUDO_KEY = 'ffl.pseudo';
/** code de fermeture envoyé par le serveur quand l'hôte exclut un joueur */
export const KICKED = 4001;

/** serveur par défaut : celui fixé à la construction (GitHub Pages), sinon la machine qui sert la page en local */
export function defaultServer() {
  const built = (import.meta as any).env?.VITE_GAME_SERVER;
  if (built && location.protocol === 'https:') return built;
  return `ws://${location.hostname && location.protocol === 'http:' ? location.hostname : 'localhost'}:2567`;
}
export function serverUrl() { let v = ''; try { v = localStorage.getItem(SRV_KEY) || '' } catch (e) {} return v || defaultServer() }
/** on ne mémorise l'adresse que si elle diffère de celle par défaut (pour suivre un changement de serveur) */
export function setServerUrl(v: string) { try { v = v.trim(); if (!v || v === defaultServer()) localStorage.removeItem(SRV_KEY); else localStorage.setItem(SRV_KEY, v) } catch (e) {} }

// ---- pseudo (en attendant les comptes) : mêmes règles que le serveur ----
export function cleanPseudo(v: string) { return String(v || '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16) }
export const pseudoOk = (v: string) => cleanPseudo(v).length >= 3;
export function getPseudo() { let v = ''; try { v = localStorage.getItem(PSEUDO_KEY) || '' } catch (e) {} return pseudoOk(v) ? cleanPseudo(v) : '' }
export function setPseudo(v: string) { const p = cleanPseudo(v); try { localStorage.setItem(PSEUDO_KEY, p) } catch (e) {} return p }

/** ce que la partie (main.ts) doit savoir */
type GameHandlers = { start(m: any): void, first(): void, end(m: any): void, note(msg: string, kind: string): void, lost(): void };
/** ce que les écrans « Parties en ligne » et « Salon » doivent savoir */
export type LobbyHandlers = {
  rooms(list: any[] | null, error?: string): void,
  salon(s: any): void,
  chat(m: any): void,
  chatLog(l: any[]): void,
  refused(msg: string): void,
  left(reason: string): void,
  status(msg: string, kind?: string): void,
};
let game: GameHandlers, lobbyH: LobbyHandlers;
/** idle : pas connecté · salon : dans le salon · playing : en partie · ended : écran de fin (on reste dans le salon, qui attend la revanche) */
export let nstate: 'idle' | 'connecting' | 'salon' | 'playing' | 'ended' = 'idle', gameOver = false;
export function setNetHandlers(h: GameHandlers) { game = h }
export function setLobbyHandlers(h: LobbyHandlers) { lobbyH = h }
export const netState = () => nstate;

// ---- la liste des parties publiques (salle « lobby » du serveur, mise à jour en direct) ----
let lobbyRoom: any = null, browsing = false;
const rooms = new Map<string, any>();
const emitRooms = () => lobbyH.rooms([...rooms.values()].filter(r => r.metadata));
export async function browse() {
  if (browsing) return; browsing = true; rooms.clear();
  try {
    const r = await new Client(serverUrl()).joinOrCreate('lobby');
    if (!browsing) { r.leave(); return }
    lobbyRoom = r;
    r.onMessage('rooms', (l: any[]) => { rooms.clear(); for (const x of l) rooms.set(x.roomId, x); emitRooms() });
    r.onMessage('+', ([id, x]: [string, any]) => { rooms.set(id, x); emitRooms() });
    r.onMessage('-', (id: string) => { rooms.delete(id); emitRooms() });
    r.onLeave(() => { lobbyRoom = null; if (browsing) { browsing = false; lobbyH.rooms(null, 'Connexion à la liste des parties perdue.') } });
  } catch (e) {
    browsing = false; console.warn('liste des parties :', e);
    lobbyH.rooms(null, `Impossible de joindre le serveur de jeu (${serverUrl()}).`);
  }
}
export function stopBrowse() { browsing = false; const r = lobbyRoom; lobbyRoom = null; try { r && r.leave() } catch (e) {} }

// ---- salon et partie ----
function bind(room: any) {
  net.room = room; gameOver = false; nstate = 'salon';
  room.onMessage('salon', (s: any) => lobbyH.salon(s));
  room.onMessage('chat', (m: any) => lobbyH.chat(m));
  room.onMessage('chatLog', (l: any[]) => lobbyH.chatLog(l));
  room.onMessage('chatRefused', (m: any) => lobbyH.refused(m.msg));
  room.onMessage('joined', () => {});
  room.onMessage('start', (m: any) => { nstate = 'playing'; game.start(m) });
  room.onMessage('snap', (s: any) => { if (nstate !== 'playing') return; if (applySnapshot(s)) game.first() });
  room.onMessage('note', (n: any) => game.note(n.msg, n.kind || ''));
  room.onMessage('end', (m: any) => { gameOver = true; nstate = 'ended'; game.end(m) });
  room.onLeave((code: number) => {
    const was = nstate; net.room = null; nstate = 'idle';
    if (was === 'playing' && !gameOver) game.lost();
    else if (was === 'salon' || was === 'ended') lobbyH.left(code === KICKED ? 'L\'hôte t\'a exclu du salon.' : 'Le salon a été fermé.');
  });
}
async function connect(fn: (c: any) => Promise<any>, what: string) {
  if (nstate !== 'idle') return false;
  nstate = 'connecting'; lobbyH.status('Connexion au serveur…');
  try { const room = await fn(new Client(serverUrl())); bind(room); lobbyH.status(''); return true }
  catch (e: any) {
    nstate = 'idle'; net.room = null; console.warn('connexion au serveur :', e);
    const m = String(e && e.message || e);
    lobbyH.status(/not found|no rooms|introuvable|locked|full/i.test(m) ? `Partie ${what} introuvable, déjà complète ou déjà lancée.` : `Impossible de joindre le serveur de jeu (${serverUrl()}).`, 'warn');
    return false;
  }
}
/** crée un salon (on en est l'hôte) */
export function createRoom(o: { name: string, priv: boolean, map: string, mode: string, rich: boolean, speed: number }) {
  return connect(c => c.create('ffl', { ...o, pseudo: getPseudo() }), '');
}
/** rejoint un salon par son code (affiché dans la liste, ou envoyé par un ami pour un salon privé) */
export function joinRoom(code: string) {
  const id = code.trim().toUpperCase();
  return connect(c => c.joinById(id, { pseudo: getPseudo() }), id);
}
/** depuis l'écran de fin : revenir dans le salon (le serveur y est déjà revenu) */
export function backToSalon() { if (nstate !== 'ended' || !net.room) return false; nstate = 'salon'; return true }
export function leaveGame() { const r = net.room; nstate = 'idle'; net.room = null; try { r && r.leave() } catch (e) {} }
const send = (type: string, v?: any) => { try { net.room && net.room.send(type, v) } catch (e) {} };
export const setReady = (v: boolean) => send('ready', v);
export const setSettings = (o: { map?: string, mode?: string, rich?: boolean, speed?: number }) => send('settings', o);
/** se déplacer sur une place libre du salon */
export const takeSlot = (i: number) => send('slot', i);
/** (hôte) mettre ou retirer une IA sur une place */
export const setSlotAi = (slot: number, ai: boolean) => send('slotAi', { slot, ai });
export const launch = () => send('launch');
export const kick = (id: string) => send('kick', id);
export const sendChat = (text: string) => send('chat', text);
