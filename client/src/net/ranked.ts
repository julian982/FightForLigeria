// La file classée : on y entre connecté à son compte, le serveur forme la partie et nous envoie dans sa salle.
import { Client } from '@colyseus/sdk';
import { sessionToken } from './account';
import { serverUrl, joinRanked } from './online';

export type QueueHandlers = {
  /** chaque seconde : attente (s), écart d'Elo accepté (null = n'importe qui), joueurs dans la file, Elo du mode */
  status(m: { waited: number, window: number | null, players: number, elo: number, games: number }): void,
  /** adversaire(s) trouvé(s) : on rejoint la partie */
  match(m: { roomId: string, mode: string, map: string }): void,
  /** la partie a commencé à se connecter (ok) ou pas */
  joined(ok: boolean): void,
  error(msg: string): void,
};
let room: any = null, leaving = false;
export const queued = () => !!room;
export async function enterQueue(mode: '1v1' | '2v2', h: QueueHandlers) {
  if (room) leaveQueue();
  leaving = false;
  try {
    const r = await new Client(serverUrl()).joinOrCreate('ranked', { token: sessionToken() || undefined, mode });
    if (leaving) { r.leave(); return false }
    room = r;
    r.onMessage('q', (m: any) => h.status(m));
    r.onMessage('qError', (m: any) => h.error(m.msg));
    r.onMessage('replaced', () => { leaving = true; h.error('La recherche a été relancée dans un autre onglet.') });
    r.onMessage('match', async (m: any) => {
      leaving = true; room = null; try { r.leave() } catch (e) {}
      h.match(m);
      h.joined(await joinRanked(m.roomId));
    });
    r.onLeave(() => { if (room === r) room = null; if (!leaving) h.error('Connexion à la file perdue. Relance la recherche.') });
    return true;
  } catch (e: any) {
    const m = String(e && e.message || e);
    h.error(/compte|connecte/i.test(m) ? m : /indisponibles/i.test(m) ? m : `Impossible de joindre le serveur de jeu (${serverUrl()}).`);
    return false;
  }
}
export function leaveQueue() { leaving = true; const r = room; room = null; try { r && r.leave() } catch (e) {} }
