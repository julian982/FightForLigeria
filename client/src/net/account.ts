// Le compte du joueur (facultatif) : appels à l'API du serveur de jeu et session gardée dans le navigateur.
// L'API est à la même adresse que le serveur de jeu (wss://… → https://…/api/…), quel que soit le domaine de la page.
import { serverUrl } from './online';

const KEY = 'ffl.session';
export type User = { id: number, pseudo: string, email: string, createdAt: string };
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
export const register = (pseudo: string, email: string, password: string, terms: boolean) => call('/api/register', { pseudo, email, password, terms });
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
