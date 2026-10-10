// Le protocole réseau : commandes des joueurs (client → serveur) et instantanés de la partie (serveur → clients).
// Tout est ici pour que le serveur, le client et les tests parlent exactement la même langue.
import { DEF, NEED } from './config';
import { G } from './state';
import { steer, startCharge, releaseCharge, cancelCharge, placeBuilding, recruit, orderMove, orderAttack, demolish } from './game';

export type Cmd =
  | { c: 'steer', dx: number, dy: number, ax?: number, ay?: number }
  | { c: 'charge' } | { c: 'release' } | { c: 'cancel' }
  | { c: 'place', type: string, tx: number, ty: number }
  | { c: 'recruit', type: string }
  | { c: 'move', ids: number[], x: number, y: number }
  | { c: 'attack', ids: number[], k: 'u' | 'w' | 'b', id: number }
  | { c: 'demolish', id: number };

const num = (v, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d };
const unitsOf = (team, ids) => Array.isArray(ids) ? G.units.filter(u => u.team === team && ids.includes(u.id)) : [];
/** l'entité désignée par une commande d'attaque */
export function findTarget(k, id) {
  const list = k === 'b' ? G.buildings : k === 'w' ? G.workers : G.units;
  return list.find(e => e.id === id && !e.dead) || null;
}
/** applique la commande d'un joueur. Renvoie un message d'erreur pour lui, ou null. Les commandes mal formées sont ignorées. */
export function applyCommand(team: number, m: any): string | null {
  if (!G || G.over || !m || typeof m.c !== 'string' || !G.teams[team] || G.teams[team].out) return null;
  switch (m.c) {
    case 'steer': {
      const dx = Math.max(-1, Math.min(1, num(m.dx))), dy = Math.max(-1, Math.min(1, num(m.dy)));
      steer(team, dx, dy, m.ax != null ? { x: num(m.ax), y: num(m.ay) } : null); return null;
    }
    case 'charge': return startCharge(team);
    case 'release': releaseCharge(team); return null;
    case 'cancel': cancelCharge(team); return null;
    case 'place': return DEF[m.type] && m.type !== 'keep' ? placeBuilding(team, m.type, num(m.tx) | 0, num(m.ty) | 0) : null;
    case 'recruit': return NEED[m.type] ? recruit(team, m.type) : null;
    case 'move': orderMove(team, unitsOf(team, m.ids), num(m.x), num(m.y)); return null;
    case 'attack': { const t = findTarget(m.k, m.id); if (t) orderAttack(team, unitsOf(team, m.ids), t); return null }
    case 'demolish': return demolish(team, G.buildings.find(b => b.id === m.id));
  }
  return null;
}

// ---------------- instantanés ----------------
export const U_TYPES = ['lord', 'archer', 'lancier', 'spadassin'];
export const B_TYPES = Object.keys(DEF);
export const CARRY_TYPES = ['', 'bois', 'pierre', 'ble', 'fer', 'arc', 'lance', 'epee', 'fleche'];
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
/** drapeaux d'un ouvrier, pour l'affichage (au travail, il manque une matière, plus d'arbres, pas de réserve/grenier) */
export const WF = { working: 1, need: 2, idle: 4, noReserve: 8, noGrenier: 16 };

export interface Snapshot {
  t: number;
  /** un par joueur (2 en 1v1, 4 en 2v2) ; `out` : éliminé */
  tm: { res: any, stash: any, starving: boolean, keep: number, lord: number, out?: boolean }[];
  ctrl: [number, number][];
  /** unités : id, équipe, type, x, y, orientation, vie, vie max, morte, charge de l'arc, élan, éclair */
  u: number[][];
  /** ouvriers : id, équipe, bâtiment, x, y, orientation, vie, vie max, objet porté, drapeaux */
  w: number[][];
  /** bâtiments : id, équipe, type, tx, ty, vie, vie max, pousse du blé, remplaçant dans…, éclair */
  b: number[][];
  /** flèches : id, équipe, du seigneur, x, y, vx, vy, distance parcourue, portée */
  a: number[][];
  /** effets apparus depuis le dernier instantané */
  fx: any[];
  /** arbres abattus depuis le dernier instantané */
  fell: number[];
}
/** fabrique l'instantané de la partie (côté serveur). `fell` : arbres abattus depuis le précédent. */
export function makeSnapshot(fell: number[]): Snapshot {
  const fx = [];
  for (const f of G.fx) if (!f.sent) { f.sent = 1; const o: any = { ...f }; delete o.sent; fx.push(o) }
  return {
    t: r2(G.t),
    tm: G.teams.map(tm => ({ res: tm.res, stash: tm.stash, starving: !!tm.starving, keep: tm.keep.id, lord: tm.lord.id, out: !!tm.out })),
    ctrl: G.ctrl.map(c => [c.charging ? 1 : 0, r2(c.start)]),
    u: G.units.map(u => [u.id, u.team, U_TYPES.indexOf(u.type), r1(u.x), r1(u.y), r2(u.face), Math.ceil(u.hp), u.maxhp, u.dead ? 1 : 0, r2(u.charge || 0), r2(u.lunge || 0), r2(Math.max(0, u.flash))]),
    w: G.workers.map(w => [w.id, w.team, w.b ? w.b.id : 0, r1(w.x), r1(w.y), r2(w.face), Math.ceil(w.hp), w.maxhp, w.carry ? CARRY_TYPES.indexOf(w.carry.type) : 0,
      (w.working ? WF.working : 0) | (w.state === 'working' && w.need ? WF.need : 0) | (w.idle ? WF.idle : 0) | (w.noStore === 'reserve' ? WF.noReserve : 0) | (w.noStore === 'grenier' ? WF.noGrenier : 0)]),
    b: G.buildings.map(b => [b.id, b.team, B_TYPES.indexOf(b.type), b.tx, b.ty, Math.ceil(b.hp), b.maxhp, r2(b.grow || 0), b.respawn == null ? -1 : r1(b.respawn), r2(Math.max(0, b.flash))]),
    a: G.arrows.map(a => [a.id, a.team, a.lord ? 1 : 0, r1(a.x), r1(a.y), r1(a.vx), r1(a.vy), r1(a.d), r1(a.md)]),
    fx, fell,
  };
}
