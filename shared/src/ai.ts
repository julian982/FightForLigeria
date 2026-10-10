// L'IA : seigneur archer qui défend son camp, économie scriptée et vagues d'attaque. Elle peut jouer n'importe quel joueur (ennemi ou allié en 2v2).
import { T, TERR, DEF, ARMY_MAX, AI_ORDER, STONES, IRONS, sideOf, isFoe } from './config';
import { dist, dE } from './util';
import { G, trees, hooks } from './state';
import { nav, pushOut, shotClear, freePoint } from './nav';
import { addBuilding, spawnUnit, afford, pay, canPlace, nearestTree, fireArrow } from './game';

/** seigneur piloté par l'IA : reste près de chez lui, tire sur ce qui approche */
export function updAiLord(team, dt) {
  const L = G.teams[team].lord; if (L.dead) return;
  L.cd -= dt;
  const k = G.teams[team].keep, home = { x: k.x + (sideOf(team) === 1 ? -130 : 130), y: k.y + Math.sin(G.t * .35) * 70 };
  let foe = null, bd = 600;
  for (const e of G.units) { if (!isFoe(e.team, team) || e.dead) continue; const d = dE(L, e); if (d < bd) { bd = d; foe = e } }
  if (!foe) for (const w of G.workers) { if (!isFoe(w.team, team) || w.dead) continue; const d = dE(L, w); if (d < Math.min(bd, 450)) { bd = d; foe = w } }
  if (foe) {
    let mx = 0, my = 0; const d = dE(L, foe);
    if (d < 180) { mx = L.x - foe.x; my = L.y - foe.y }
    else if (dE(L, home) > (L.hp < 120 ? 60 : 240)) { mx = home.x - L.x; my = home.y - L.y }
    else { const a = Math.atan2(foe.y - L.y, foe.x - L.x) + Math.PI / 2; mx = Math.cos(a) * Math.sin(G.t * .9); my = Math.sin(a) * Math.sin(G.t * .9) }
    const los = shotClear(L.x, L.y, foe.x, foe.y, foe);
    if (!los && dE(L, home) < 320) nav(L, foe.x, foe.y, dt, 0, .6);
    else { const m = Math.hypot(mx, my); if (m > .01) { const sp = L.speed * .5; L.x += mx / m * sp * dt; L.y += my / m * sp * dt } pushOut(L) }
    L.face = Math.atan2(foe.y - L.y, foe.x - L.x);
    L.ai += dt; const need = 1.4; L.charge = Math.min(1, L.ai / need);
    if (L.ai >= need && L.cd <= 0 && los && G.teams[team].res.fleche > 0) { G.teams[team].res.fleche--;
      const ch = Math.min(1, .45 + d / 900), sp = 380 + 560 * ch, tt = d / sp;
      const px = foe.x + (foe.vx || 0) * tt * .85, py = foe.y + (foe.vy || 0) * tt * .85;
      fireArrow(team, L.x, L.y, Math.atan2(py - L.y, px - L.x) + (Math.random() - .5) * .14, ch);
      L.ai = 0; L.cd = .4; L.charge = 0;
    }
  } else { L.ai = 0; L.charge = 0; nav(L, home.x, home.y, dt, 10, .5) }
}
/** cherche un bon emplacement pour un bâtiment de l'équipe */
export function findSpot(team, type) {
  const k = G.teams[team].keep, d = DEF[type]; let best = null, bs = 1e9;
  const nearTrees = trees.filter(t => t.wood > 0 && dist(t.x, t.y, k.x, k.y) < TERR + 200);
  for (let i = 0; i < 280; i++) {
    let cx, cy;
    if (type === 'mine') { const I = IRONS.reduce((a, b) => dist(a.x, a.y, k.x, k.y) <= dist(b.x, b.y, k.x, k.y) ? a : b), a = Math.random() * 6.28, r = Math.random() * (I.r - 14); cx = I.x + Math.cos(a) * r; cy = I.y + Math.sin(a) * r }
    else if (type === 'carriere') { const s = STONES.find(s => dist(s.x, s.y, k.x, k.y) < TERR); if (!s) return null; const a = Math.random() * 6.28, r = Math.random() * (s.r - 20); cx = s.x + Math.cos(a) * r; cy = s.y + Math.sin(a) * r }
    else if (type === 'bucheron') { if (!nearTrees.length) return null; const t = nearTrees[Math.random() * nearTrees.length | 0]; cx = t.x + (Math.random() - .5) * 220; cy = t.y + (Math.random() - .5) * 220 }
    else { const a = Math.random() * 6.28, r = 170 + Math.random() * (TERR - 190); cx = k.x + Math.cos(a) * r; cy = k.y + Math.sin(a) * r }
    const tx = Math.round(cx / T - d.w / 2), ty = Math.round(cy / T - d.h / 2);
    if (canPlace(team, type, tx, ty)) continue;
    const ccx = (tx + d.w / 2) * T, ccy = (ty + d.h / 2) * T;
    let sc = dist(ccx, ccy, k.x, k.y) + (sideOf(team) === 1 ? (k.x - ccx) : (ccx - k.x)) * .6;
    if (type === 'bucheron') { const nt = nearestTree(ccx, ccy, 400); sc = (nt ? dist(ccx, ccy, nt.x, nt.y) : 400) * 3 + sc * .3 }
    if (sc < bs) { bs = sc; best = { tx, ty } }
  }
  return best;
}
/** le seigneur ennemi encore debout le plus proche du donjon de `team` : la cible des vagues d'attaque */
function targetLord(team) {
  const k = G.teams[team].keep; let best = null, bd = 1e9;
  for (const o of G.teams) { if (!isFoe(o.id, team) || o.out || o.lord.dead) continue; const d = dist(o.lord.x, o.lord.y, k.x, k.y); if (d < bd) { bd = d; best = o } }
  return best;
}
/** économie et armée d'un joueur contrôlé par l'IA, toutes les 1,5 s */
export function aiTick(p, dt) {
  const A = G.ai[p], tm = G.teams[p]; A.t += dt; if (A.t < 1.5) return; A.t = 0;
  for (const st of ['reserve', 'grenier']) if (A.i > 2 && !G.buildings.some(b => b.team === p && b.type === st && !b.dead)) { const sp = findSpot(p, st); if (sp) addBuilding(p, st, sp.tx, sp.ty) }
  if (A.i < AI_ORDER.length) { const type = AI_ORDER[A.i]; if (afford(tm, type)) { const s = findSpot(p, type); if (s) { pay(tm, type); addBuilding(p, type, s.tx, s.ty) } A.i++ } }
  else { const cap = { bucheron: 5, ferme: 4, carriere: 2, arcs: 2, lances: 2 }; for (const type of ['bucheron', 'ferme', 'arcs', 'lances', 'carriere']) { const n = G.buildings.filter(b => b.team === p && b.type === type).length; if (n < cap[type] && afford(tm, type)) { const s = findSpot(p, type); if (s) { pay(tm, type); addBuilding(p, type, s.tx, s.ty) } break } } }
  const cas = G.buildings.find(b => b.team === p && b.type === 'caserne' && !b.dead);
  if (cas) { const at = { x: cas.x, y: cas.by + cas.bh + 14 };
    const armyN = () => G.units.filter(u => u.team === p && u.type !== 'lord' && !u.dead).length;
    while (tm.res.arc > 0 && armyN() < ARMY_MAX) { tm.res.arc--; spawnUnit(p, 'archer', at) }
    while (tm.res.lance > 0 && armyN() < ARMY_MAX) { tm.res.lance--; spawnUnit(p, 'lancier', at) }
    while (tm.res.epee > 0 && armyN() < ARMY_MAX) { tm.res.epee--; spawnUnit(p, 'spadassin', at) } }
  const tgt = targetLord(p); if (!tgt) return;
  const L0 = tgt.lord;
  const army = G.units.filter(u => u.team === p && u.type !== 'lord' && !u.dead);
  const idle = army.filter(u => !u.order);
  if (G.t >= A.next && idle.length >= A.wave) { A.next = G.t + 100;
    idle.forEach((u, i) => { const q = freePoint(L0.x + (i % 4 - 1.5) * 26, L0.y + ((i / 4 | 0) - 1) * 26); u.order = { type: 'amove', x: q.x, y: q.y, ai: true } });
    A.wave = Math.min(14, A.wave + 2); hooks.notify(tgt.id, "L'ennemi lance une attaque", "warn");
  }
  for (const u of army) if (u.order && u.order.ai) { u.order.x = L0.x + (Math.random() - .5) * 60; u.order.y = L0.y + (Math.random() - .5) * 60 }
}
