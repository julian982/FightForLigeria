// Le compte du joueur (facultatif) : appels à l'API du serveur de jeu et session gardée dans le navigateur.
// L'API est à la même adresse que le serveur de jeu (wss://… → https://…/api/…), quel que soit le domaine de la page.
import { serverUrl } from './online';
import type { Blason, Frame } from '@ffl/shared';

const KEY = 'ffl.session';
/** Elo d'un mode (1v1 ou 2v2) : `placed` devient vrai après les 5 parties de placement */
export type Ladder = { elo: number, games: number, wins: number, placed: boolean, rank: string, tier: number };
export type User = { id: number, pseudo: string, email: string, createdAt: string, blason: Blason, r1: Ladder, r2: Ladder, admin?: boolean, frame?: Frame | null };
let token = '', user: User | null = null;
try { token = localStorage.getItem(KEY) || '' } catch (e) {}

export const apiBase = () => serverUrl().replace(/^ws/, 'http').replace(/\/$/, '');
export const sessionToken = () => token;
export const currentUser = () => user;
const changed = () => window.dispatchEvent(new Event('ffl:account'));
function setSession(t: string, u: User | null) {
  token = t; user = u;
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch (e) {}
  changed();
}

/** appel à l'API : renvoie { ok, status, data } sans jamais lever d'erreur */
async function call(path: string, body?: any): Promise<{ ok: boolean, status: number, data: any }> {
  try {
    const r = await fetch(apiBase() + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data: any = {}; try { data = await r.json() } catch (e) {}
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.' } };
  }
}

/** au chargement : vérifie que la session gardée est toujours valable */
export async function restoreSession() {
  if (!token) return;
  const r = await call('/api/me');
  if (r.ok) { user = r.data.user; changed() }
  else if (r.status === 401) setSession('', null); // session expirée ou compte supprimé
}
/** inscription : sans confirmation par email, le serveur renvoie directement une session (on est connecté) */
export async function register(pseudo: string, email: string, password: string, terms: boolean, blason?: Blason) {
  const r = await call('/api/register', { pseudo, email, password, terms, blason });
  if (r.ok && r.data.token) setSession(r.data.token, r.data.user);
  return r;
}
/** relit le compte (Elo à jour après une partie classée, par exemple) */
export async function refreshMe() { if (!token) return; const r = await call('/api/me'); if (r.ok) { user = r.data.user; changed() } }
export async function saveBlason(blason: Blason) {
  const r = await call('/api/account/blason', { blason });
  if (r.ok && user) { user = { ...user, blason: r.data.blason }; changed() }
  return r;
}
export const history = () => call('/api/history');
export const adminStats = () => call('/api/admin/stats');
/** le profil public d'un joueur (ouvert à tous) */
export const profile = (pseudo: string) => call('/api/profile?pseudo=' + encodeURIComponent(pseudo));
export const leaderboard = (mode: string) => call('/api/leaderboard?mode=' + encodeURIComponent(mode));
/** partie contre l'IA terminée : rangée dans l'historique du compte (jamais dans l'Elo) */
export function reportSolo(map: string, won: boolean, duration: number) { if (token) call('/api/history/solo', { map, won, duration }) }
/** le résultat d'une partie classée met à jour l'Elo affiché sans attendre */
export function applyElo(mode: string, e: { after: number, games: number, wins: number, placed: boolean, rank: string, tier: number }) {
  if (!user) return;
  const l = { elo: e.after, games: e.games, wins: e.wins, placed: e.placed, rank: e.rank, tier: e.tier };
  user = mode === '2v2' ? { ...user, r2: l } : { ...user, r1: l }; changed();
}
export const resend = (email: string) => call('/api/resend', { email });
export async function login(id: string, password: string) {
  const r = await call('/api/login', { login: id, password });
  if (r.ok) setSession(r.data.token, r.data.user);
  return r;
}
export async function logout() { await call('/api/logout', {}); setSession('', null) }
export const forgot = (email: string) => call('/api/forgot', { email });
export const resetPassword = (t: string, password: string) => call('/api/reset', { token: t, password });
export async function deleteAccount(password: string) {
  const r = await call('/api/account/delete', { password });
  if (r.ok) setSession('', null);
  return r;
}
