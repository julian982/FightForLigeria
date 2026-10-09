// Le miroir de la partie en ligne : on reconstruit `G` à partir des instantanés du serveur,
// avec les mêmes objets d'une image à l'autre (le rendu y accroche ses maillages), et on lisse les mouvements.
import { B_TYPES, CARRY_TYPES, DEF, G, Snapshot, T, UT, U_TYPES, WF, blocksOf, genTrees, hooks, newCtrl, newStats, setG, setTrees, trees } from '@ffl/shared';
import { online } from './act';
import { ME } from '../state';

export const byId = { u: new Map<number, any>(), w: new Map<number, any>(), b: new Map<number, any>(), a: new Map<number, any>() };
export let gotFirst = false;
/** prépare un G vide pour une partie en ligne (la forêt est générée à l'identique du serveur) */
export function initMirror() {
  hooks.reset();
  for (const m of Object.values(byId)) m.clear();
  setTrees(genTrees().map((t, i) => (t.id = i, t)));
  setG({ t: 0, teams: [0, 1].map(id => ({ id, res: {}, stash: {}, keep: null, lord: null, starving: false })), buildings: [], units: [], workers: [], arrows: [], fx: [],
    over: null, winner: null, ctrl: [newCtrl(false), newCtrl(false)], st: [newStats(), newStats()], stats: { kills: 0, recruits: 0 }, online: true });
  gotFirst = false;
}
export const mirrorReady = () => gotFirst;
export function sync<T>(list: any[], map: Map<number, any>, rows: number[][], make: (r: number[]) => any, upd: (e: any, r: number[]) => void) {
  const seen = new Set<number>();
  for (const r of rows) { let e = map.get(r[0]); if (!e) { e = make(r); map.set(r[0], e); list.push(e) } upd(e, r); seen.add(r[0]) }
  let gone = false;
  for (const e of list) if (!seen.has(e.id)) { e.dead = true; hooks.removed(e); map.delete(e.id); gone = true }
  return gone ? list.filter(e => seen.has(e.id)) : list;
}
/** applique un instantané reçu du serveur. Renvoie true au premier. */
export function applySnapshot(s: Snapshot) {
  const first = !gotFirst; gotFirst = true;
  G.t = s.t;
  G.buildings = sync(G.buildings, byId.b, s.b, r => {
    const type = B_TYPES[r[2]], d = DEF[type], b: any = { kind: 'building', id: r[0], team: r[1], type, tx: r[3], ty: r[4], bx: r[3] * T, by: r[4] * T, bw: d.w * T, bh: d.h * T, dead: false, worker: null };
    b.x = b.bx + b.bw / 2; b.y = b.by + b.bh / 2; b.blocks = blocksOf(b); return b;
  }, (b, r) => { b.hp = r[5]; b.maxhp = r[6]; b.grow = r[7]; b.respawn = r[8] < 0 ? null : r[8]; b.flash = r[9] });
  G.units = sync(G.units, byId.u, s.u, r => ({ kind: 'unit', id: r[0], team: r[1], type: U_TYPES[r[2]], r: UT[U_TYPES[r[2]]].r, x: r[3], y: r[4], face: r[5], vx: 0, vy: 0 }),
    (u, r) => { u.nx = r[3]; u.ny = r[4]; u.nface = r[5]; u.hp = r[6]; u.maxhp = r[7]; u.dead = !!r[8]; u.charge = r[9]; u.lunge = r[10]; u.flash = r[11] });
  G.workers = sync(G.workers, byId.w, s.w, r => ({ kind: 'worker', id: r[0], team: r[1], r: 7, x: r[3], y: r[4], face: r[5], vx: 0, vy: 0 }),
    (w, r) => { w.nx = r[3]; w.ny = r[4]; w.nface = r[5]; w.hp = r[6]; w.maxhp = r[7]; w.carry = r[8] ? { type: CARRY_TYPES[r[8]] } : null;
      const f = r[9]; w.working = !!(f & WF.working); w.need = !!(f & WF.need); w.state = w.need ? 'working' : ''; w.idle = !!(f & WF.idle);
      w.noStore = f & WF.noReserve ? 'reserve' : f & WF.noGrenier ? 'grenier' : null;
      const b = byId.b.get(r[2]); w.b = b; if (b) b.worker = w });
  G.arrows = sync(G.arrows, byId.a, s.a, r => ({ id: r[0], team: r[1], lord: !!r[2], x: r[3], y: r[4] }),
    (a, r) => { a.x = r[3]; a.y = r[4]; a.vx = r[5]; a.vy = r[6]; a.d = r[7]; a.md = r[8] });
  for (const f of s.fx) G.fx.push(f);
  if (s.fell.length) { const ids = new Set(s.fell); for (const t of trees) if (ids.has(t.id)) { t.wood = 0; hooks.removed(t) } setTrees(trees.filter(t => t.wood > 0)) }
  s.tm.forEach((t, i) => { const tm = G.teams[i]; tm.res = t.res; tm.stash = t.stash; tm.starving = t.starving; tm.keep = byId.b.get(t.keep) || tm.keep; tm.lord = byId.u.get(t.lord) || tm.lord });
  // la charge de l'arc du joueur local reste gérée sur place (pas d'à-coups dus au réseau)
  s.ctrl.forEach((c, i) => { if (i !== ME) { G.ctrl[i].charging = !!c[0]; G.ctrl[i].start = c[1] } });
  if (first) for (const e of [...G.units, ...G.workers]) { e.x = e.nx; e.y = e.ny }
  return first;
}
export const angLerp = (a: number, b: number, k: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k };
/** fait avancer l'affichage entre deux instantanés : lissage des positions, flèches en vol, effets */
export function netTick(dt: number) {
  if (!gotFirst || dt <= 0) return;
  G.t += dt;
  const k = 1 - Math.exp(-dt * 14);
  for (const e of [...G.units, ...G.workers]) {
    if (e.nx === undefined) continue;
    const ox = e.x, oy = e.y;
    e.x += (e.nx - e.x) * k; e.y += (e.ny - e.y) * k; e.face = angLerp(e.face, e.nface, Math.min(1, k * 1.5));
    e.vx = (e.x - ox) / dt; e.vy = (e.y - oy) / dt;
    if (e.flash > 0) e.flash -= dt; if (e.lunge > 0) e.lunge = Math.max(0, e.lunge - dt);
    if (e.working) e.anim = (e.anim || 0) + dt;
  }
  for (const b of G.buildings) if (b.flash > 0) b.flash -= dt;
  for (const a of G.arrows) { a.x += a.vx * dt; a.y += a.vy * dt; a.d = Math.min(a.md, a.d + Math.hypot(a.vx, a.vy) * dt) }
  for (const f of G.fx) { f.t += dt; if (f.t >= f.life) hooks.removed(f) }
  G.fx = G.fx.filter(f => f.t < f.life);
}
