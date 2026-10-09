// Les actions du joueur local. En solo elles agissent directement sur la simulation ;
// en ligne elles partent au serveur (après une vérification locale pour afficher tout de suite les erreurs).
import { G, afford, canPlace, cancelCharge, demolish, demolishError, missing, orderAttack, orderMove, placeBuilding, recruit, recruitError, releaseCharge, startCharge, steer } from '@ffl/shared';
import { ME } from '../state';

/** la connexion en cours (null en solo) */
export const net = { room: null as any };
export const online = () => !!net.room;
export function send(m: any) { try { net.room.send('cmd', m) } catch (e) { /* connexion perdue : géré ailleurs */ } }

export let lastMove = '', lastAim = '', steerT = 0;
export const act = {
  /** direction de marche (repère monde) et point visé */
  steer(dx: number, dy: number, aim: { x: number, y: number } | null) {
    if (!online()) return steer(ME, dx, dy, aim);
    const mv = dx.toFixed(2) + ',' + dy.toFixed(2), am = aim ? Math.round(aim.x / 3) + ',' + Math.round(aim.y / 3) : '', now = performance.now();
    // un changement de direction part tout de suite ; la visée, au plus 20 fois par seconde
    if (mv === lastMove && (am === lastAim || now - steerT < 50)) return;
    lastMove = mv; lastAim = am; steerT = now;
    send({ c: 'steer', dx: +dx.toFixed(3), dy: +dy.toFixed(3), ax: aim ? Math.round(aim.x) : undefined, ay: aim ? Math.round(aim.y) : undefined });
  },
  charge(): string | null {
    if (!online()) return startCharge(ME);
    const L = G.teams[ME].lord; if (G.over || !L || L.dead) return null;
    if (G.teams[ME].res.fleche < 1) return 'Plus de flèches : construis un atelier de flèches (touche 6)';
    send({ c: 'charge' }); G.ctrl[ME].charging = true; G.ctrl[ME].start = G.t; return null;
  },
  release() { if (!online()) return releaseCharge(ME); if (!G.ctrl[ME].charging) return; send({ c: 'release' }); G.ctrl[ME].charging = false },
  cancel() { if (!online()) return cancelCharge(ME); if (G && G.ctrl[ME].charging) { send({ c: 'cancel' }); G.ctrl[ME].charging = false } },
  place(type: string, tx: number, ty: number): string | null {
    if (!online()) return placeBuilding(ME, type, tx, ty);
    const err = canPlace(ME, type, tx, ty) || (!afford(G.teams[ME], type) ? 'Il manque ' + missing(G.teams[ME], type) : null);
    if (!err) send({ c: 'place', type, tx, ty });
    return err;
  },
  recruit(type: string): string | null {
    if (!online()) return recruit(ME, type);
    const err = recruitError(ME, type); if (!err) send({ c: 'recruit', type }); return err;
  },
  move(units: any[], x: number, y: number) {
    if (!online()) return orderMove(ME, units, x, y);
    send({ c: 'move', ids: units.map(u => u.id), x: Math.round(x), y: Math.round(y) });
  },
  attack(units: any[], t: any) {
    if (!online()) return orderAttack(ME, units, t);
    send({ c: 'attack', ids: units.map(u => u.id), k: t.kind === 'building' ? 'b' : t.kind === 'worker' ? 'w' : 'u', id: t.id });
  },
  demolish(b: any): string | null {
    if (!online()) return demolish(ME, b);
    const err = demolishError(ME, b); if (!err) send({ c: 'demolish', id: b.id }); return err;
  },
};
