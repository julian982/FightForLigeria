// La simulation : création de partie, ouvriers, combat, famine, commandes des joueurs.
// Aucun accès au DOM ni à Three.js : le client lit `G` pour dessiner, et reçoit les événements par `hooks`.
import { T, GW, GH, W, H, TERR, S, DEF, ARMY_MAX, STORE_OF, START_RES, RICH_RES, UT, RESN, NEED, STONES, IRON, ROCKS, RESPAWN, TREE_R, CHARGE_T, AI_ARCHER_RANGE } from './config';
import { rawWater, genTrees, gh } from './maps';
import { dist, dE, rectDist, rectClamp, inRect } from './util';
import { G, trees, setG, setTrees, hooks } from './state';
import { navDirty, navVer, dirtyNav, blocksOf, solidAt, buildNav, freePoint, nav, pushOut, shotClear, treesNear } from './nav';
import { aiTick, updAiLord } from './ai';

export interface GameOptions {
  /** stock de départ généreux (partie privée) */
  rich?: boolean;
  /** pour chaque équipe : true si l'IA la contrôle (par défaut : l'équipe 1) */
  ai?: [boolean, boolean];
}

export function newStats() { return { killS: 0, killW: 0, lostS: 0, lostW: 0, recruits: 0, prod: { bois: 0, pierre: 0, ble: 0, fer: 0, arc: 0, lance: 0, epee: 0, fleche: 0 }, built: 0, lostB: 0, razed: 0, shot: 0, hit: 0, dmg: 0, longest: 0, starve: 0, army: [], resH: [] } }
/** contrôle d'un seigneur : direction voulue (monde), point visé, charge de l'arc */
export function newCtrl(ai: boolean) { return { ai, dx: 0, dy: 0, aim: null as null | { x: number, y: number }, charging: false, start: 0 } }

/** démarre une partie sur la carte chargée (voir loadMap) */
export function newGame(opts: GameOptions = {}) {
  hooks.reset();
  setTrees(genTrees());
  const ai = opts.ai || [false, true];
  setG({ t: 0, teams: [], buildings: [], units: [], workers: [], arrows: [], fx: [], over: null, winner: null, foodT: 0, nid: 1, uid: 1,
    ai: { i: 0, t: 0, wave: 5, next: 240 }, stats: { kills: 0, recruits: 0 }, st: [newStats(), newStats()], histT: 0,
    ctrl: [newCtrl(ai[0]), newCtrl(ai[1])] });
  for (const id of [0, 1]) {
    // le stock de départ attend dans les charrettes : il n'apparaît qu'une fois la réserve (bois, pierre, fer) ou le grenier (blé) posé
    const tm = { id, res: { ...START_RES, bois: 0, pierre: 0, fer: 0, ble: 0 }, stash: { bois: START_RES.bois, pierre: START_RES.pierre, fer: START_RES.fer, ble: START_RES.ble }, keep: null, lord: null, starving: false };
    G.teams.push(tm);
    tm.keep = addBuilding(id, 'keep', id === 0 ? 6 : GW - 9, 18);
    tm.lord = spawnUnit(id, 'lord', { x: tm.keep.x + (id === 0 ? 110 : -110), y: tm.keep.y });
  }
  buildNav();
  if (opts.rich) for (const tm of G.teams) for (const k in RICH_RES) (k in tm.stash ? tm.stash : tm.res)[k] = RICH_RES[k];
  return G;
}
/** ressources rangées dans chaque bâtiment de stockage */
export const STORED: Record<string, string[]> = { reserve: ['bois', 'pierre', 'fer'], grenier: ['ble'] };
/** le stock en attente rejoint la réserve ou le grenier qu'on vient de poser */
function unstash(tm, type) { for (const k of STORED[type]) { tm.res[k] += tm.stash[k]; tm.stash[k] = 0 } }
export function addBuilding(team, type, tx, ty) {
  const d = DEF[type];
  const b: any = { kind: 'building', id: G.nid++, team, type, tx, ty, bx: tx * T, by: ty * T, bw: d.w * T, bh: d.h * T, hp: d.hp, maxhp: d.hp, flash: 0, worker: null, dead: false, grow: 0 };
  b.x = b.bx + b.bw / 2; b.y = b.by + b.bh / 2; b.blocks = blocksOf(b);
  G.buildings.push(b); dirtyNav(); if (type !== 'keep' && G.st) G.st[team].built++;
  if (d.store) unstash(G.teams[team], type);
  if (d.work) spawnWorker(b);
  return b;
}
function spawnWorker(b) {
  const sp = stockPt(b.team);
  const w = { kind: 'worker', id: G.uid++, team: b.team, x: sp.x, y: sp.y, r: 7, hp: 30, maxhp: 30, speed: 76, b, state: 'toWork', timer: 0, carry: null, tree: null, need: false, flash: 0, dead: false, vx: 0, vy: 0, face: 0 };
  b.worker = w; b.respawn = null; G.workers.push(w); if (G.teams[b.team].starving) setStarve(w, true);
}
function setStarve(e, on) {
  if (e.baseHp === undefined) e.baseHp = e.maxhp;
  if (!!e.starve === on) return; e.starve = on;
  if (on) { e.maxhp = Math.round(e.baseHp * .75); e.hp = Math.max(1, e.hp * .75) } else { e.maxhp = e.baseHp; e.hp = Math.min(e.maxhp, e.hp / .75) }
}
/** point de dépôt devant le donjon */
export function stockPt(team) { const k = G.teams[team].keep; return { x: k.x, y: k.by + k.bh + 12 } }
export function spawnUnit(team, type, at) {
  const s = UT[type];
  const u: any = { kind: 'unit', id: G.uid++, team, type, x: at.x + (Math.random() - .5) * 20, y: at.y + (Math.random() - .5) * 10, r: s.r, hp: s.hp, maxhp: s.hp, speed: s.speed, order: null, cd: Math.random(), face: team === 0 ? 0 : Math.PI, flash: 0, dead: false, vx: 0, vy: 0, ai: 0, charge: 0 };
  u.guard = { x: u.x, y: u.y }; G.units.push(u); if (type !== 'lord' && G.st) G.st[team].recruits++; if (type !== 'lord' && G.teams[team].starving) setStarve(u, true); return u;
}
export function armySize(team) { return G.units.filter(u => u.team === team && u.type !== 'lord' && !u.dead).length }
export function afford(tm, type) { const c = DEF[type].cost; return Object.keys(c).every(k => tm.res[k] >= c[k]) }
export function missing(tm, type) { const c = DEF[type].cost; return Object.keys(c).filter(k => tm.res[k] < c[k]).map(k => (c[k] - tm.res[k]) + ' ' + RESN[k]).join(', ') }
export function pay(tm, type) { const c = DEF[type].cost; for (const k in c) tm.res[k] -= c[k] }
export function nearestTree(x, y, max) { let best = null, bd = max; for (const t of trees) { if (t.wood <= 0) continue; const d = dist(x, y, t.x, t.y); if (d < bd) { bd = d; best = t } } return best }
/** null si on peut construire là, sinon la raison */
export function canPlace(team, type, tx, ty): string | null {
  const d = DEF[type];
  if (tx < 0 || ty < 0 || tx + d.w > GW || ty + d.h > GH) return 'Hors de la carte';
  const x = tx * T, y = ty * T, w = d.w * T, h = d.h * T, cx = x + w / 2, cy = y + h / 2;
  for (let sx = x - 16; sx <= x + w + 16; sx += 20) for (let sy = y - 16; sy <= y + h + 16; sy += 20) if (rawWater(sx, sy)) return 'Trop près de l\'eau';
  const k = G.teams[team].keep;
  if (type !== 'mine' && dist(cx, cy, k.x, k.y) > TERR) return 'Hors de ton territoire';
  if (d.store && G.buildings.some(o => o.team === team && o.type === type && !o.dead)) return 'Tu as déjà un' + (type === 'reserve' ? 'e réserve' : ' grenier');
  for (const b of G.buildings) if (!b.dead && x < b.bx + b.bw && x + w > b.bx && y < b.by + b.bh && y + h > b.by) return 'Emplacement occupé';
  for (const e of [...G.units, ...G.workers]) if (!e.dead && e.x > x - e.r && e.x < x + w + e.r && e.y > y - e.r && e.y < y + h + e.r) return 'Des personnes sont sur l\'emplacement';
  const sp = stockPt(team); if (sp.x > x - 30 && sp.x < x + w + 30 && sp.y > y - 10 && sp.y < y + h + 24) return 'Laisse libre l\'entrée du donjon';
  for (const t of trees) { if (t.wood <= 0) continue; if (rectDist(t.x, t.y, { bx: x, by: y, bw: w, bh: h }) < TREE_R + 4) return 'Des arbres gênent' }
  if (type === 'carriere') { if (!STONES.some(s => dist(cx, cy, s.x, s.y) < s.r - 10)) return 'La carrière se pose sur un gisement de pierre' }
  else if (STONES.some(s => rectDist(s.x, s.y, { bx: x, by: y, bw: w, bh: h }) < s.r * .7)) return 'Gisement de pierre : réservé à la carrière';
  if (type === 'mine') { if (dist(cx, cy, IRON.x, IRON.y) > IRON.r - 12) return 'La mine se pose sur le gisement de fer, au centre de la carte' }
  else if (rectDist(IRON.x, IRON.y, { bx: x, by: y, bw: w, bh: h }) < IRON.r * .7) return 'Gisement de fer : réservé à la mine';
  if (type === 'bucheron' && !nearestTree(cx, cy, 280)) return 'Aucun arbre à proximité';
  return null;
}
function treeSpot(t, from) { let best = null, bd = 1e9; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = t.x + Math.cos(a) * (TREE_R + 10), y = t.y + Math.sin(a) * (TREE_R + 10); if (solidAt(x, y, 6)) continue; const d = dist(x, y, from.x, from.y); if (d < bd) { bd = d; best = { x, y } } } return best || { x: t.x - TREE_R - 10, y: t.y } }
function doorSpot(b) {
  const sp = stockPt(b.team), m = 13, c = [];
  for (let x = b.bx + 10; x <= b.bx + b.bw - 10; x += 20) c.push({ x, y: b.by + b.bh + m }, { x, y: b.by - m });
  for (let y = b.by + 10; y <= b.by + b.bh - 10; y += 20) c.push({ x: b.bx - m, y }, { x: b.bx + b.bw + m, y });
  let best = null, bd = 1e9; for (const q of c) { if (solidAt(q.x, q.y, 7)) continue; const d = dist(q.x, q.y, sp.x, sp.y) + (q.y < b.by ? 40 : 0); if (d < bd) { bd = d; best = q } }
  return best || { x: b.x, y: b.by + b.bh + m };
}

// ================= Combat =================
export function fireArrow(team, x, y, ang, charge) {
  const sp = 380 + 560 * charge, md = 200 + 520 * charge, dmg = Math.round(10 + 50 * charge);
  const a = { team, x: x + Math.cos(ang) * 15, y: y + Math.sin(ang) * 15, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, d: 0, md, dmg, lord: true, z: charge };
  G.arrows.push(a); G.st[team].shot++;
}
function lordHit(a, dmg) { const s = G.st[a.team]; s.hit++; s.dmg += dmg; s.longest = Math.max(s.longest, a.d) }
/** portée et rayon de détection d'une unité (les archers de l'IA voient et tirent plus loin) */
export function rangeOf(u) { const s = UT[u.type], k = u.type === 'archer' && G.ctrl[u.team].ai ? AI_ARCHER_RANGE : 1; return { range: s.range * k, aggro: Math.max(s.aggro, s.range * k + 50) } }
function unitArrow(u, t) {
  const s = UT.archer, sp = 470, p = t.kind === 'building' ? rectClamp(u.x, u.y, t) : { x: t.x, y: t.y };
  const d = dist(u.x, u.y, p.x, p.y), tt = d / sp, px = p.x + (t.vx || 0) * tt * .7, py = p.y + (t.vy || 0) * tt * .7;
  const ang = Math.atan2(py - u.y, px - u.x) + (Math.random() - .5) * .08; u.face = ang;
  const a = { team: u.team, x: u.x + Math.cos(ang) * 10, y: u.y + Math.sin(ang) * 10, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, d: 0, md: Math.min(rangeOf(u).range + 60, d + 40), dmg: s.dmg, lord: false, z: 0 };
  G.arrows.push(a);
}
/** nuage de poussière (effet visuel, sans incidence sur le jeu) */
function puff(x, y, r, h = .3) {
  G.fx.push({ k: 'puff', x, y, t: 0, life: .7 + Math.random() * .4, r: r * S * 2.2, h: h + gh(x, y) });
}
export function hit(e, dmg, showNum) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = .12;
  if (showNum) G.fx.push({ k: 'num', x: e.x, y: e.y, h: e.kind === 'building' ? 1.6 : 1.2, t: 0, life: .9, v: dmg });
  if (e.hp <= 0) {
    e.dead = true;
    if (e.team === 1 && e.kind !== 'building') G.stats.kills++;
    const me = G.st[e.team], foe = G.st[1 - e.team];
    if (e.kind === 'unit' && e.type !== 'lord') { me.lostS++; foe.killS++ }
    else if (e.kind === 'worker') { me.lostW++; foe.killW++ }
    else if (e.kind === 'building') { me.lostB++; foe.razed++; if (e.worker && !e.worker.dead) me.lostW++ }
    if (e.kind === 'building') {
      if (e.worker) e.worker.dead = true;
      const own = e.team, other = 1 - e.team;
      if (e.type === 'grenier' || e.type === 'reserve') {
        const r = G.teams[e.team].res, lost = e.type === 'grenier' ? ['ble'] : ['bois', 'pierre', 'fer'];
        for (const k of lost) r[k] = 0;
        hooks.notify(own, e.type === 'grenier' ? 'Ton grenier est détruit : tout ton blé est perdu !' : 'Ta réserve est détruite : bois, pierre et fer perdus !', 'warn');
        hooks.notify(other, e.type === 'grenier' ? 'Grenier ennemi détruit : l\'ennemi n\'a plus de blé' : 'Réserve ennemie détruite', '');
      }
      for (let i = 0; i < 9; i++) puff(e.bx + Math.random() * e.bw, e.by + Math.random() * e.bh, 14, .4 + Math.random());
      hooks.notify(own, 'Tu as perdu : ' + DEF[e.type].name.toLowerCase(), 'warn');
      hooks.notify(other, 'Détruit : ' + DEF[e.type].name.toLowerCase(), '');
    }
    else puff(e.x, e.y, e.r + 4);
  }
}
function nearestEnemy(u, radius) {
  let best = null, bs = radius;
  for (const e of G.units) { if (e.team === u.team || e.dead) continue; const d = dE(u, e) - e.r; if (d < bs) { bs = d; best = e } }
  for (const w of G.workers) { if (w.team === u.team || w.dead) continue; const d = dE(u, w) + 30; if (d < bs) { bs = d; best = w } }
  for (const b of G.buildings) { if (b.team === u.team || b.dead || b.type === 'keep') continue; const d = rectDist(u.x, u.y, b) + 70; if (d < bs) { bs = d; best = b } }
  return best;
}
function edgeDist(u, t) { return t.kind === 'building' ? rectDist(u.x, u.y, t) : dE(u, t) - t.r - u.r }
function engage(u, t, dt) {
  const s = UT[u.type], d = edgeDist(u, t), range = rangeOf(u).range;
  if (u.noLos > 0) u.noLos -= dt;
  if (d > range || u.noLos > 0) { const p = t.kind === 'building' ? rectClamp(u.x, u.y, t) : t; nav(u, p.x, p.y, dt, 0) }
  else {
    u.face = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.cd <= 0) {
      if (u.type === 'archer') { const p = t.kind === 'building' ? rectClamp(u.x, u.y, t) : t; if (!shotClear(u.x, u.y, p.x, p.y, t)) { u.noLos = .7; return } }
      u.cd = s.cd * (.9 + Math.random() * .2);
      if (u.type === 'archer') unitArrow(u, t);
      else { hit(t, s.dmg, false); u.lunge = .15 } }
  }
}
function updUnit(u, dt) {
  u.cd -= dt; if (u.lunge) u.lunge = Math.max(0, u.lunge - dt);
  const aggro = rangeOf(u).aggro, o = u.order;
  if (o && o.type === 'move') { if (nav(u, o.x, o.y, dt, 5)) { u.order = null; u.guard = { x: u.x, y: u.y } } return }
  if (o && o.type === 'attack') { if (o.target.dead) { u.order = null; u.guard = { x: u.x, y: u.y }; return } engage(u, o.target, dt); return }
  if (o && o.type === 'amove') { const e = nearestEnemy(u, aggro); if (e) { engage(u, e, dt); return } if (nav(u, o.x, o.y, dt, 12)) { u.order = null; u.guard = { x: u.x, y: u.y } } return }
  const e = nearestEnemy(u, aggro);
  if (e && dist(e.x, e.y, u.guard.x, u.guard.y) < 460) engage(u, e, dt);
  else if (dist(u.x, u.y, u.guard.x, u.guard.y) > 8) nav(u, u.guard.x, u.guard.y, dt, 8, .8);
}

// ================= Ouvriers =================
function updWorker(w, dt) {
  const b = w.b; if (!b || b.dead) { w.dead = true; return }
  const tm = G.teams[w.team], d = DEF[b.type], eff = 1;
  w.working = false;
  if (w.state === 'toWork') {
    if (!w.spot || w.spotVer !== navVer || (b.type === 'bucheron' && (!w.tree || w.tree.wood <= 0))) {
      w.spotVer = navVer;
      if (b.type === 'bucheron') {
        // plus d'arbre à côté : le bûcheron va au plus proche, même au bout de la carte
        if (!w.tree || w.tree.wood <= 0) w.tree = nearestTree(b.x, b.y, 280) || nearestTree(b.x, b.y, Infinity);
        w.spot = w.tree ? treeSpot(w.tree, w) : doorSpot(b);
      } else if (b.type === 'ferme') w.spot = { x: b.bx + 18 + ((b.id * 37) % 50), y: b.y + ((b.id * 13) % 40) - 10 };
      else w.spot = doorSpot(b);
    }
    if (b.type === 'bucheron' && !w.tree) { if (nav(w, w.spot.x, w.spot.y, dt, 4)) w.idle = true; return }
    w.idle = false;
    if (nav(w, w.spot.x, w.spot.y, dt, 4)) { w.state = 'working'; w.timer = d.work; w.need = !!d.input; const f = b.type === 'bucheron' ? w.tree : b; w.face = Math.atan2(f.y - w.y, f.x - w.x) }
  } else if (w.state === 'working') {
    if (b.type === 'fleches' && G.ctrl[b.team].ai && tm.res.fleche >= 30) return; // l'IA ne stocke pas plus de 30 flèches
    if (w.need) { const inp = d.input; if (Object.keys(inp).every(k => tm.res[k] >= inp[k])) { for (const k in inp) tm.res[k] -= inp[k]; w.need = false } else return }
    if (b.type === 'bucheron' && (!w.tree || w.tree.wood <= 0)) { w.state = 'toWork'; return }
    w.timer -= dt * eff; w.anim = (w.anim || 0) + dt; w.working = true;
    if (b.type === 'ferme') b.grow = Math.min(1, 1 - w.timer / d.work);
    if (w.timer <= 0) {
      w.carry = { type: d.out[0], n: d.out[1] };
      if (b.type === 'bucheron') { w.tree.wood--; if (w.tree.wood <= 0) { stump(w.tree); dirtyNav() } }
      if (b.type === 'ferme') b.grow = 0;
      w.state = 'toStock';
    }
  } else if (w.state === 'toStock') {
    const kind = STORE_OF[w.carry.type]; let dest;
    if (kind) {
      const sb = G.buildings.find(o => o.team === w.team && o.type === kind && !o.dead);
      if (!sb) { w.noStore = kind; nav(w, w.b.x, w.b.by + w.b.bh + 12, dt, 10); return }
      w.noStore = null;
      if (w.destB !== sb || w.destVer !== navVer) { w.dest = doorSpot(sb); w.destB = sb; w.destVer = navVer }
      dest = w.dest;
    } else { const sp = stockPt(w.team); dest = { x: sp.x + ((w.b.id % 5) - 2) * 7, y: sp.y } }
    if (nav(w, dest.x, dest.y, dt, 4)) { tm.res[w.carry.type] += w.carry.n; G.st[w.team].prod[w.carry.type] += w.carry.n; w.carry = null; w.state = 'toWork' }
  }
}
function stump(t) { G.fx.push({ k: 'stump', x: t.x, y: t.y, t: 0, life: 45 }); puff(t.x, t.y, 18, .8) }

// ================= Seigneurs contrôlés par un joueur =================
function updCtrlLord(team, dt) {
  const L = G.teams[team].lord; if (L.dead) return;
  const c = G.ctrl[team];
  L.cd -= dt;
  const m = Math.hypot(c.dx, c.dy);
  if (m) { const sp = L.speed * (c.charging ? .55 : 1); L.x += c.dx / m * sp * dt; L.y += c.dy / m * sp * dt }
  pushOut(L);
  if (c.aim) L.face = Math.atan2(c.aim.y - L.y, c.aim.x - L.x);
  L.charge = c.charging ? Math.min(1, (G.t - c.start) / CHARGE_T) : 0;
}

// ================= Commandes (tout ce qu'un joueur peut demander) =================
/** direction de marche du seigneur (repère monde) et point visé */
export function steer(team, dx, dy, aim) { const c = G.ctrl[team]; c.dx = dx; c.dy = dy; c.aim = aim }
/** commence à bander l'arc. Renvoie un message si c'est impossible. */
export function startCharge(team): string | null {
  const L = G.teams[team].lord; if (G.over || L.dead || L.cd > 0) return null;
  if (G.teams[team].res.fleche < 1) return 'Plus de flèches : construis un atelier de flèches (touche 6)';
  const c = G.ctrl[team]; c.charging = true; c.start = G.t; return null;
}
export function cancelCharge(team) { if (G) G.ctrl[team].charging = false }
/** relâche la corde : tire une flèche d'autant plus forte que la charge était longue */
export function releaseCharge(team) {
  const c = G.ctrl[team]; if (!c.charging) return; c.charging = false;
  const L = G.teams[team].lord, res = G.teams[team].res;
  if (!L || L.dead || G.over) return;
  if (res.fleche < 1) { L.charge = 0; return }
  const ch = Math.min(1, (G.t - c.start) / CHARGE_T);
  res.fleche--; fireArrow(team, L.x, L.y, L.face, ch); L.cd = .35; L.charge = 0;
  if (res.fleche === 0) hooks.notify(team, 'Dernière flèche tirée : construis un atelier de flèches (touche 6)', 'warn');
}
/** pose un bâtiment. Renvoie la raison du refus, ou null. */
export function placeBuilding(team, type, tx, ty): string | null {
  const tm = G.teams[team], err = canPlace(team, type, tx, ty);
  if (err) return err;
  if (!afford(tm, type)) return 'Il manque ' + missing(tm, type);
  pay(tm, type); addBuilding(team, type, tx, ty); return null;
}
/** recrute un soldat à la caserne. Renvoie la raison du refus, ou null. */
export function recruit(team, type): string | null {
  const tm = G.teams[team], need = NEED[type];
  const cas = G.buildings.find(b => b.team === team && b.type === 'caserne' && !b.dead);
  if (!cas) return 'Construis d\'abord une caserne';
  if (tm.res[need] < 1) return ({ archer: 'Il te faut un arc : construis un atelier d\'arcs', lancier: 'Il te faut une lance : construis un atelier de lances', spadassin: 'Il te faut une épée : prends le fer au centre de la carte (mine) puis forge-la' })[type];
  if (armySize(team) >= ARMY_MAX) return 'Armée complète : ' + ARMY_MAX + ' soldats maximum';
  tm.res[need]--; spawnUnit(team, type, { x: cas.x, y: cas.by + cas.bh + 14 }); if (team === 0) G.stats.recruits++;
  return null;
}
/** envoie des soldats vers un point, en formation carrée */
export function orderMove(team, units, x, y) {
  const sel = units.filter(u => u.team === team && !u.dead && u.type !== 'lord');
  const n = sel.length, cols = Math.ceil(Math.sqrt(n)), sp = 24;
  sel.forEach((u, i) => { const cx = i % cols, cy = i / cols | 0, p = freePoint(x + (cx - (cols - 1) / 2) * sp, y + (cy - (Math.ceil(n / cols) - 1) / 2) * sp, u.r); u.order = { type: 'move', x: p.x, y: p.y } });
}
/** ordonne d'attaquer une cible (unité, ouvrier ou bâtiment ennemi) */
/** remboursement d'une démolition : la moitié du coût, arrondie en dessous */
export function refundOf(type) { const c = DEF[type].cost || {}, r: Record<string, number> = {}; for (const k in c) { const v = Math.floor(c[k] / 2); if (v > 0) r[k] = v } return r }
/** démolit un de ses bâtiments intact : il disparaît tout de suite et rend la moitié de son coût. Renvoie la raison du refus, ou null. */
export function demolish(team, b): string | null {
  if (!b || b.dead || b.team !== team) return 'Ce bâtiment ne t\'appartient pas';
  if (b.type === 'keep') return 'Le donjon ne peut pas être démoli';
  if (b.hp < b.maxhp) return 'Bâtiment endommagé : impossible de le démolir';
  const res = G.teams[team].res, r = refundOf(b.type);
  for (const k in r) res[k] += r[k];
  b.dead = true; b.demolished = true;
  // démolir une réserve ou un grenier : le stock repart dans les charrettes, il reviendra avec le prochain
  if (DEF[b.type].store) { const tm = G.teams[team]; for (const k of STORED[b.type]) { tm.stash[k] += tm.res[k]; tm.res[k] = 0 } }
  if (b.worker) b.worker.dead = true;
  puff(b.x, b.y, 18, .5);
  return null;
}
export function orderAttack(team, units, target) {
  if (!target || target.team === team) return;
  for (const u of units) if (u.team === team && !u.dead && u.type !== 'lord') u.order = { type: 'attack', target };
}

// ================= Boucle =================
function separate() {
  const us = G.units;
  for (let i = 0; i < us.length; i++) { const a = us[i]; if (a.dead) continue;
    for (let j = i + 1; j < us.length; j++) { const b = us[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d < min && d > .01) { const p = (min - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p } } }
}
function finish(winner) {
  G.over = true; G.winner = winner;
  for (const c of G.ctrl) c.charging = false;
  for (const id of [0, 1]) { G.st[id].army.push(armySize(id)); G.st[id].resH.push({ ...G.st[id].prod }) }
  hooks.end(winner);
}
/** avance la simulation de dt secondes */
export function update(dt) {
  G.t += dt;
  if (navDirty) buildNav();
  const pos = [...G.units, ...G.workers].map(e => [e, e.x, e.y]);
  for (const id of [0, 1]) { if (G.ctrl[id].ai) updAiLord(id, dt); else updCtrlLord(id, dt) }
  for (const u of G.units) if (!u.dead && u.type !== 'lord') updUnit(u, dt);
  for (const w of G.workers) if (!w.dead) updWorker(w, dt);
  separate();
  for (const u of G.units) if (!u.dead) pushOut(u);
  for (const [e, x, y] of pos) { e.vx = (e.x - x) / dt; e.vy = (e.y - y) / dt }
  for (const a of G.arrows) {
    a.x += a.vx * dt; a.y += a.vy * dt; a.d += Math.hypot(a.vx, a.vy) * dt;
    for (const e of G.units) { if (e.team === a.team || e.dead) continue; if (dE(a, e) < e.r + 3) { const dm = e.type === 'spadassin' ? Math.ceil(a.dmg * .5) : a.dmg; if (a.lord) lordHit(a, dm); hit(e, dm, a.lord); a.dead = true; break } }
    if (!a.dead) for (const w of G.workers) { if (w.team === a.team || w.dead) continue; if (dE(a, w) < w.r + 3) { if (a.lord) lordHit(a, a.dmg); hit(w, a.dmg, a.lord); a.dead = true; break } }
    if (!a.dead) for (const b of G.buildings) { if (b.dead) continue;
      if (b.team !== a.team && b.type !== 'keep' && a.x > b.bx && a.x < b.bx + b.bw && a.y > b.by && a.y < b.by + b.bh) { const dm = Math.ceil(a.dmg * .4); if (a.lord) lordHit(a, dm); hit(b, dm, a.lord); a.dead = true; break }
      if (b.blocks.some(q => inRect(a.x, a.y, q))) { a.dead = true; a.stick = .5; break } }
    if (!a.dead && treesNear(a.x, a.y, t => Math.abs(t.x - a.x) < TREE_R && Math.abs(t.y - a.y) < TREE_R && dist(a.x, a.y, t.x, t.y) < TREE_R)) { a.dead = true; a.stick = .55 }
    // les gisements de pierre et de fer sont au ras du sol : les flèches passent au-dessus
    // une flèche arrêtée par un obstacle reste plantée quelques secondes
    if (a.dead && a.stick !== undefined) G.fx.push({ k: 'stuck', x: a.x - a.vx * .012, y: a.y - a.vy * .012, a: Math.atan2(a.vy, a.vx), h: a.stick, team: a.team, lord: a.lord, t: 0, life: 3 });
    else if (!a.dead && (a.d >= a.md || a.x < 0 || a.y < 0 || a.x > W || a.y > H)) { a.dead = true; G.fx.push({ k: 'stuck', x: a.x, y: a.y, a: Math.atan2(a.vy, a.vx), team: a.team, lord: a.lord, t: 0, life: 3 }) }
    if (a.dead) hooks.removed(a);
  }
  for (const f of G.fx) f.t += dt;
  for (const e of [...G.units, ...G.workers, ...G.buildings]) if (e.flash > 0) e.flash -= dt;
  G.foodT += dt;
  // le blé nourrit ouvriers et soldats : 1 blé toutes les 12 s pour 4 bouches
  if (G.foodT >= 12) { G.foodT = 0; for (const tm of G.teams) { const n = G.workers.filter(w => w.team === tm.id && !w.dead).length + G.units.filter(u => u.team === tm.id && !u.dead && u.type !== 'lord').length; let eat = Math.ceil(n / 4); const a = Math.min(eat, tm.res.ble); tm.res.ble -= a; eat -= a; tm.stash.ble = Math.max(0, tm.stash.ble - eat) } }
  for (const tm of G.teams) if (tm.starving) G.st[tm.id].starve += dt;
  G.histT -= dt; if (G.histT <= 0) { G.histT = 10; for (const id of [0, 1]) { G.st[id].army.push(armySize(id)); G.st[id].resH.push({ ...G.st[id].prod }) } }
  // famine : vitesse −50 % et vie −25 % pour les ouvriers et les soldats
  for (const tm of G.teams) { const st = tm.res.ble <= 0 && tm.stash.ble <= 0; if (st === !!tm.starving) continue; tm.starving = st;
    for (const e of [...G.workers, ...G.units]) if (e.team === tm.id && !e.dead && e.type !== 'lord') setStarve(e, st);
    hooks.notify(tm.id, st ? 'Famine : plus de blé ! Ouvriers et soldats perdent 50 % de vitesse et 25 % de vie' : 'Le blé est revenu : tes gens retrouvent leurs forces', st ? 'warn' : '') }
  if (G.ctrl[1].ai) aiTick(dt);
  for (const u of G.units) if (u.dead && u.type !== 'lord') hooks.removed(u);
  for (const w of G.workers) if (w.dead) hooks.removed(w);
  for (const b of G.buildings) if (b.dead) { hooks.removed(b); dirtyNav() }
  G.units = G.units.filter(u => !u.dead || u.type === 'lord');
  G.workers = G.workers.filter(w => !w.dead);
  // un ouvrier tué est remplacé après RESPAWN secondes ; le bâtiment est à l'arrêt en attendant
  for (const b of G.buildings) {
    if (b.dead || !DEF[b.type].work || (b.worker && !b.worker.dead)) continue;
    if (b.respawn == null) { b.respawn = RESPAWN; b.grow = 0; hooks.notify(b.team, 'Ouvrier tué (' + DEF[b.type].name.toLowerCase() + ') : un remplaçant arrive dans ' + RESPAWN + ' s', 'warn') }
    b.respawn -= dt; if (b.respawn <= 0) spawnWorker(b);
  }
  G.buildings = G.buildings.filter(b => !b.dead);
  G.arrows = G.arrows.filter(a => !a.dead);
  for (const f of G.fx) if (f.t >= f.life) hooks.removed(f);
  G.fx = G.fx.filter(f => f.t < f.life);
  let felled = false;
  for (const t of trees) if (t.wood <= 0) { hooks.removed(t); felled = true }
  if (felled) { dirtyNav(); setTrees(trees.filter(t => t.wood > 0)) }
  if (!G.over) {
    if (G.teams[0].lord.dead) finish(1);
    else if (G.teams[1].lord.dead) finish(0);
  }
}
