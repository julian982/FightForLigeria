// Obstacles & navigation : grille de 20 px, A*, glissement contre les obstacles, ligne de tir.
import { W, H, T, GH_MAX, ROCKS, RIVER, TREE_R, DEF, TOWER_CAP, TOP_H, sideOf } from './config';
import { wHit } from './maps';
import { dist, rectDist, inRect } from './util';
import { G, trees } from './state';

// grilles allouées pour la plus grande carte (2v2) ; NH suit la carte chargée (mis à jour par buildNav)
const NH_MAX = GH_MAX * T / 20;
export const NC = 20, NW = W / NC;
export let NH = H / NC;
const NN = NW * NH_MAX;
/** le sol, une grille par camp : une porte ou un escalier ne laisse passer que son camp (0 = praticable) */
export const navGrids = [new Uint8Array(NN), new Uint8Array(NN)];
/** le dessus des murs, portes, escaliers et tours terminés de chaque camp (0 = praticable) */
export const topGrids = [new Uint8Array(NN), new Uint8Array(NN)];
/** cases d'escalier de chaque camp : on y passe du sol au chemin de ronde */
const stairGrids = [new Uint8Array(NN), new Uint8Array(NN)];
/** compatibilité : le sol vu par le camp de gauche */
export const navGrid = navGrids[0];
export let navDirty = true, navVer = 0;
export function dirtyNav() { navDirty = true }
const TB = 80, TBW = Math.ceil(W / TB); let TBH = Math.ceil(H / TB), treeB: any[][] = [];
function bucketTrees() { TBH = Math.ceil(H / TB); treeB = Array.from({ length: TBW * TBH }, () => []); for (const t of trees) if (t.wood > 0) treeB[Math.min(TBH - 1, Math.floor(t.y / TB)) * TBW + Math.min(TBW - 1, Math.floor(t.x / TB))].push(t) }
export function treesNear(x, y, fn) { const cx = Math.floor(x / TB), cy = Math.floor(y / TB); for (let j = cy - 1; j <= cy + 1; j++) { if (j < 0 || j >= TBH) continue; for (let i = cx - 1; i <= cx + 1; i++) { if (i < 0 || i >= TBW) continue; const a = treeB[j * TBW + i]; if (!a) continue; for (let k = 0; k < a.length; k++) { const t = a[k]; if (t.wood > 0 && fn(t)) return t } } } return null }
export function blocksOf(b) {
  if (b.type === 'ferme') return [{ bx: b.x + 24, by: b.y - 58, bw: 36, bh: 48 }];
  return [{ bx: b.bx + 2, by: b.by + 2, bw: b.bw - 4, bh: b.bh - 4 }];
}

// ---------------- défenses : murs, portes, escaliers, tours ----------------
/** les défenses, case par case (une tour occupe 4 cases). Tenu à jour par buildNav. */
const defMap = new Map<number, any>();
const tileKey = (tx: number, ty: number) => ty * 1000 + tx;
export const isDefense = (b) => !!b && !!DEF[b.type] && !!DEF[b.type].def;
/** la défense (debout) sur la case du point x, y */
export function defAt(x, y) { const b = defMap.get(tileKey(Math.floor(x / T), Math.floor(y / T))); return b && !b.dead ? b : null }
/** le dessus praticable pour un camp en x, y : défense terminée de ce camp */
export function topAt(x, y, side) { const b = defAt(x, y); return b && !(b.build < 1) && sideOf(b.team) === side ? b : null }
/** idem, avec un peu de marge (on peut longer le bord du chemin de ronde, couper un angle entre deux murs en diagonale) */
export function topNear(x, y, side, tol = 6) { return topAt(x, y, side) || topAt(x - tol, y - tol, side) || topAt(x + tol, y - tol, side) || topAt(x - tol, y + tol, side) || topAt(x + tol, y + tol, side) }
const isStair = b => !!b && b.type === 'escalier';
/** la défense (hors escalier) la plus proche du point, à quelques pixels près : pour passer de l'escalier au mur, même par un angle */
function wallNear(x, y, side, tol = 7) { for (const [dx, dy] of [[0, 0], [-tol, -tol], [tol, -tol], [-tol, tol], [tol, tol], [0, -tol], [0, tol], [-tol, 0], [tol, 0]]) { const b = topAt(x + dx, y + dy, side); if (b && !isStair(b)) return b } return null }
function stairNear(x, y, side, tol = 6) { for (const [dx, dy] of [[0, 0], [-tol, -tol], [tol, -tol], [-tol, tol], [tol, tol]]) if (isStair(topAt(x + dx, y + dy, side))) return true; return false }
/** une porte ou un escalier terminés laissent passer leur camp au sol */
export const passFor = (b, side) => (DEF[b.type].def === 'porte' || b.type === 'escalier') && !(b.build < 1) && sideOf(b.team) === side;
/** encore de la place sur cette tour pour e ? (déjà dessus : oui) */
function room(e, b) {
  if (DEF[b.type].def !== 'tour') return true;
  if (e.sx !== undefined && e.up && topAt(e.sx, e.sy, sideOf(e.team)) === b) return true;
  let n = 0; for (const u of G.units) if (u !== e && !u.dead && u.up && topAt(u.x, u.y, sideOf(u.team)) === b) n++;
  return n < TOWER_CAP;
}
/** hauteur (3D) du dessus sous un point : chemin de ronde, plateforme de tour, ou rampe d'escalier (selon sa pente) */
/** hauteur en haut d'un escalier : celle du mur ou de la tour contre lequel il monte */
export function stairTop(b) {
  const d = b.dir ?? 0, [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][d], o = defAt((b.tx + dx + .5) * T, (b.ty + dy + .5) * T);
  return o && o.type !== 'escalier' ? TOP_H[o.type] : TOP_H.escalier;
}
export function topHeight(x, y) {
  const b = defAt(x, y); if (!b) return 0;
  if (b.type !== 'escalier') return TOP_H[b.type] || 0;
  // rampe : du sol (côté opposé au mur) jusqu'au chemin de ronde (côté mur)
  const d = b.dir ?? 0, fx = (x - b.bx) / b.bw, fy = (y - b.by) / b.bh, k = d === 0 ? fy : d === 1 ? 1 - fx : d === 2 ? 1 - fy : fx;
  return stairTop(b) * Math.max(0, Math.min(1, 1 - k));
}

export function solidAt(x, y, inf = 0, side?: number) {
  for (const b of G.buildings) { if (b.dead || (side !== undefined && passFor(b, side))) continue; for (const q of b.blocks) if (inRect(x, y, q) || (inf > 0 && rectDist(x, y, q) < inf)) return b }
  const R = TREE_R + inf, tt = treesNear(x, y, t => Math.abs(t.x - x) < R && Math.abs(t.y - y) < R && dist(x, y, t.x, t.y) < R); if (tt) return tt;
  for (const st of ROCKS) if (dist(x, y, st.x, st.y) < st.r * .9 + inf) return st;
  if (wHit(x, y, inf + 4)) return RIVER;
  return null;
}
export function buildNav() {
  NH = H / NC; const base = navGrids[0]; base.fill(0); const inf = 9; bucketTrees();
  const mark = (g, x0, y0, x1, y1, test) => {
    const cy0 = Math.max(0, Math.floor((y0 - inf) / NC)), cy1 = Math.min(NH - 1, Math.floor((y1 + inf) / NC));
    const cx0 = Math.max(0, Math.floor((x0 - inf) / NC)), cx1 = Math.min(NW - 1, Math.floor((x1 + inf) / NC));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (test(cx * NC + NC / 2, cy * NC + NC / 2)) g[cy * NW + cx] = 1;
  };
  const markB = (g, b) => { for (const q of b.blocks) mark(g, q.bx, q.by, q.bx + q.bw, q.by + q.bh, (x, y) => inRect(x, y, q) || rectDist(x, y, q) < inf) };
  defMap.clear();
  for (const b of G.buildings) { if (b.dead) continue; if (isDefense(b)) { for (let i = 0; i < DEF[b.type].w; i++) for (let j = 0; j < DEF[b.type].h; j++) defMap.set(tileKey(b.tx + i, b.ty + j), b) } else markB(base, b) }
  for (const t of trees) if (t.wood > 0) mark(base, t.x - TREE_R, t.y - TREE_R, t.x + TREE_R, t.y + TREE_R, (x, y) => dist(x, y, t.x, t.y) < TREE_R + inf);
  for (const st of ROCKS) { const R = st.r * .9; mark(base, st.x - R, st.y - R, st.x + R, st.y + R, (x, y) => dist(x, y, st.x, st.y) < R + inf) }
  for (let cy = 0; cy < NH; cy++) for (let cx = 0; cx < NW; cx++) { const i = cy * NW + cx; if (!base[i] && wHit(cx * NC + NC / 2, cy * NC + NC / 2, inf + 4)) base[i] = 1 }
  navGrids[1].set(base);
  const defs = G.buildings.filter(b => !b.dead && isDefense(b));
  for (const s of [0, 1]) {
    // au sol : murs et tours bloquent tout le monde ; portes et escaliers terminés laissent passer leur camp
    for (const b of defs) if (!passFor(b, s)) markB(navGrids[s], b);
    // en haut : le dessus des défenses terminées du camp
    const top = topGrids[s], st = stairGrids[s]; top.fill(1); st.fill(0);
    for (const b of defs) { if (b.build < 1 || sideOf(b.team) !== s) continue;
      for (let cy = Math.floor(b.by / NC); cy < Math.ceil((b.by + b.bh) / NC); cy++) for (let cx = Math.floor(b.bx / NC); cx < Math.ceil((b.bx + b.bw) / NC); cx++) {
        if (cx < 0 || cy < 0 || cx >= NW || cy >= NH) continue; top[cy * NW + cx] = 0; if (isStair(b)) st[cy * NW + cx] = 1 } }
  }
  navDirty = false; navVer++;
}
export const cellOf = (x, y) => Math.max(0, Math.min(NH - 1, Math.floor(y / NC))) * NW + Math.max(0, Math.min(NW - 1, Math.floor(x / NC)));
export const cellPt = c => ({ x: (c % NW) * NC + NC / 2, y: ((c / NW) | 0) * NC + NC / 2 });
export function segClear(x0, y0, x1, y1, grid = navGrids[0]) {
  const d = dist(x0, y0, x1, y1); if (d < 1) return true;
  const n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) { const t = i / n; if (t * d < 12 || (1 - t) * d < 20) continue; if (grid[cellOf(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)]) return false }
  return true;
}
export function nearestFree(c, grid = navGrids[0]) {
  if (!grid[c]) return c; const cx = c % NW, cy = (c / NW) | 0;
  for (let r = 1; r < 16; r++) { let best = -1, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= NW || y >= NH) continue; const n = y * NW + x; if (!grid[n]) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n } } }
    if (best >= 0) return best }
  return -1;
}
export function freePoint(x, y, r = 10, side?: number) { if (!solidAt(x, y, r, side)) return { x, y }; const c = nearestFree(cellOf(x, y), navGrids[side || 0]); return c < 0 ? { x, y } : cellPt(c) }
/** le point du chemin de ronde de ce camp le plus proche de x, y (ou null s'il n'y en a pas à portée) */
export function topPoint(x, y, side) { if (topAt(x, y, side)) return { x, y }; const c = nearestFree(cellOf(x, y), topGrids[side]); return c < 0 ? null : cellPt(c) }
const gS = new Float32Array(NN * 2), came = new Int32Array(NN * 2), seenS = new Uint32Array(NN * 2), closedS = new Uint32Array(NN * 2); let stamp = 0;
/**
 * chemin sur deux niveaux : le sol (l = 0) et le dessus des défenses (l = 1), reliés par les escaliers. `climb` : l'entité
 * peut monter (pas les ouvriers). Renvoie des points { x, y, l }, ou null s'il n'y a pas de chemin (enfermé par des murs).
 */
export function findPath(sx, sy, tx, ty, side = 0, sl = 0, tl = 0, climb = false) {
  const G0 = navGrids[side], G1 = topGrids[side], ST = stairGrids[side];
  if (!climb) sl = tl = 0;
  const s0 = nearestFree(cellOf(sx, sy), sl ? G1 : G0), g0 = nearestFree(cellOf(tx, ty), tl ? G1 : G0); if (s0 < 0 || g0 < 0) return null;
  const s = s0 + sl * NN, g = g0 + tl * NN;
  stamp++; const hk = [], hv = [], gx = g0 % NW, gy = (g0 / NW) | 0;
  const H_ = n => { const c = n % NN, dx = Math.abs(c % NW - gx), dy = Math.abs(((c / NW) | 0) - gy); return Math.max(dx, dy) + .414 * Math.min(dx, dy) };
  const push = (n, f) => { let i = hk.length; hk.push(f); hv.push(n); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p } };
  const pop = () => { const top = hv[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hk.length && hk[l] < hk[m]) m = l; if (r < hk.length && hk[r] < hk[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m } } return top };
  const relax = (c, n, cost) => { const ng = gS[c] + cost; if (seenS[n] !== stamp || ng < gS[n]) { seenS[n] = stamp; gS[n] = ng; came[n] = c; push(n, ng + H_(n)) } };
  gS[s] = 0; seenS[s] = stamp; came[s] = -1; push(s, H_(s)); let it = 0;
  while (hk.length && it < 22000) { const c = pop(); if (c === g) break; if (closedS[c] === stamp) continue; closedS[c] = stamp; it++;
    const l = c >= NN ? 1 : 0, cell = c - l * NN, grid = l ? G1 : G0, cx = cell % NW, cy = (cell / NW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue; const n = ny * NW + nx; if (grid[n]) continue;
      // au sol, pas de coin coupé entre deux obstacles ; en haut, on suit aussi les murs tracés en diagonale
      if (!l && dx && dy && (grid[cy * NW + nx] || grid[ny * NW + cx])) continue;
      relax(c, n + l * NN, dx && dy ? 1.414 : 1) }
    // escalier : on change de niveau sur place
    if (climb && ST[cell]) relax(c, cell + (1 - l) * NN, .5);
  }
  if (seenS[g] !== stamp) return null;
  const pts = []; for (let c = g; c !== -1; c = came[c]) { const l = c >= NN ? 1 : 0, p = cellPt(c - l * NN); pts.push({ x: p.x, y: p.y, l }) } pts.reverse(); return pts;
}
function pushCirc(e, cx, cy, R) { const dx = e.x - cx, dy = e.y - cy; if (Math.abs(dx) >= R || Math.abs(dy) >= R) return; const d = Math.hypot(dx, dy); if (d < R) { if (d < .01) { e.x += R; return } e.x = cx + dx / d * R; e.y = cy + dy / d * R } }
function pushRect(e, q, r, side?: number) {
  const cx = Math.max(q.bx, Math.min(e.x, q.bx + q.bw)), cy = Math.max(q.by, Math.min(e.y, q.by + q.bh)), dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
  if (d > 0) { if (d < r) { e.x = cx + dx / d * r; e.y = cy + dy / d * r } return }
  // coincé à l'intérieur : sortir par le côté libre le plus proche
  const c = [[q.bx - r - 1, e.y, e.x - q.bx], [q.bx + q.bw + r + 1, e.y, q.bx + q.bw - e.x], [e.x, q.by - r - 1, e.y - q.by], [e.x, q.by + q.bh + r + 1, q.by + q.bh - e.y]].sort((a, b) => a[2] - b[2]);
  for (const [x, y] of c) if (x > r && y > r && x < W - r && y < H - r && !solidAt(x, y, r - 2, side)) { e.x = x; e.y = y; return }
  const f = nearestFree(cellOf(e.x, e.y), navGrids[side || 0]); if (f >= 0) { const p = cellPt(f); e.x = p.x; e.y = p.y } else { e.x = c[0][0]; e.y = c[0][1] }
}
export function clampWorld(e) { e.x = Math.max(e.r, Math.min(W - e.r, e.x)); e.y = Math.max(e.r, Math.min(H - e.r, e.y)) }
export function pushOut(e) {
  const r = e.r, side = sideOf(e.team);
  // ---- chemin de ronde : on y monte et on en descend par un escalier de son camp ; ailleurs, le bord retient ----
  if (e.kind !== 'worker' && defMap.size) {
    if (e.up) {
      const here = topNear(e.x, e.y, side), was = e.sx !== undefined && topNear(e.sx, e.sy, side);
      if (!here && !was) { e.up = false; e.fallen = true } // le mur s'est effondré sous lui : il tombe
      else if (here && room(e, here)) { e.sx = e.x; e.sy = e.y; clampWorld(e); return }
      else if (!here && stairNear(e.sx, e.sy, side)) e.up = false; // en bas de l'escalier
      else { e.x = e.sx; e.y = e.sy; clampWorld(e); return }
    } else if (e.sx !== undefined && stairNear(e.sx, e.sy, side)) {
      // en haut de l'escalier, on touche le mur (le corps le frôle déjà) : on monte
      const here = wallNear(e.x, e.y, side, r + 4);
      // il pose le pied sur le chemin de ronde (on le ramène sur la case du mur)
      if (here && room(e, here)) { e.up = true; e.x = Math.max(here.bx + 6, Math.min(here.bx + here.bw - 6, e.x)); e.y = Math.max(here.by + 6, Math.min(here.by + here.bh - 6, e.y)); e.sx = e.x; e.sy = e.y; clampWorld(e); return }
    }
  }
  for (let k = 0; k < 3; k++) {
    treesNear(e.x, e.y, t => { pushCirc(e, t.x, t.y, TREE_R + r); return false });
    for (const st of ROCKS) pushCirc(e, st.x, st.y, st.r * .9 + r);
    for (const b of G.buildings) { if (b.dead || passFor(b, side) || Math.abs(b.x - e.x) > b.bw / 2 + r + 2 || Math.abs(b.y - e.y) > b.bh / 2 + r + 2) continue; for (const q of b.blocks) pushRect(e, q, r, side) }
  }
  // l'eau : on revient à la dernière position sûre, en glissant sur un axe si possible
  if (wHit(e.x, e.y, r)) { if (e.sx !== undefined) { if (!wHit(e.sx, e.y, r)) e.x = e.sx; else if (!wHit(e.x, e.sy, r)) e.y = e.sy; else { e.x = e.sx; e.y = e.sy } } }
  else { e.sx = e.x; e.sy = e.y }
  clampWorld(e);
}
export function moveTo(e, x, y, dt, tol = 4, mul = 1) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d <= tol) return true;
  const st = Math.min(d, e.speed * mul * (e.starve ? .5 : 1) * dt); e.x += dx / d * st; e.y += dy / d * st; e.face = Math.atan2(dy, dx);
  return d - st <= tol;
}
// déplacement avec contournement des obstacles, au sol ou sur le chemin de ronde (on change de niveau par les escaliers)
export function nav(e, x, y, dt, tol = 4, mul = 1) {
  const side = sideOf(e.team), climb = e.kind !== 'worker', l = e.up ? 1 : 0;
  // la destination est-elle sur le chemin de ronde de son camp ?
  const tl = climb && topAt(x, y, side) ? 1 : 0, grid = l ? topGrids[side] : navGrids[side];
  if (dist(e.x, e.y, x, y) <= tol && l === tl) { e.stuck = 0; e.stuckN = 0; return true }
  let p = e.path;
  if (!p || p.ver !== navVer || p.tl !== tl || G.t - p.t > 3 || (dist(p.x, p.y, x, y) > 24 && G.t - p.t > .25)) {
    p = e.path = { x, y, tl, ver: navVer, t: G.t, pts: null, i: 0 };
    if (l !== tl || !segClear(e.x, e.y, x, y, grid)) { p.pts = findPath(e.x, e.y, x, y, side, l, tl, climb); if (!p.pts) e.blockedT = G.t }
  }
  let tx = x, ty = y;
  if (p.pts) {
    let k = 0; while (p.i < p.pts.length - 1 && k < 6 && p.pts[p.i].l === l && p.pts[p.i + 1].l === l && segClear(e.x, e.y, p.pts[p.i + 1].x, p.pts[p.i + 1].y, grid)) { p.i++; k++ }
    const w = p.pts[p.i];
    if (p.i >= p.pts.length - 1 && l === tl && (segClear(e.x, e.y, x, y, grid) || dist(e.x, e.y, w.x, w.y) < 6)) p.pts = null;
    else { while (p.i < p.pts.length - 1 && dist(e.x, e.y, p.pts[p.i].x, p.pts[p.i].y) < 6) p.i++; tx = p.pts[p.i].x; ty = p.pts[p.i].y }
  }
  const ox = e.x, oy = e.y; moveTo(e, tx, ty, dt, 0, mul); pushOut(e);
  const moved = dist(ox, oy, e.x, e.y);
  e.stuck = moved < e.speed * mul * dt * .3 ? (e.stuck || 0) + dt : 0;
  const d = dist(e.x, e.y, x, y), same = (e.up ? 1 : 0) === tl;
  if (same && (d <= tol || (e.stuck > .4 && d < tol + 40))) { e.stuck = 0; e.stuckN = 0; return true }
  if (e.stuck > 1.2) { e.stuck = 0; e.path = null; e.stuckN = (e.stuckN || 0) + 1; if (e.stuckN >= 3) { e.stuckN = 0; return true } }
  return false;
}
// les flèches s'arrêtent sur les obstacles (sauf la cible visée). En hauteur (tireur ou cible sur un mur), elles passent
// par-dessus les murs et les tours.
export function shotClear(x0, y0, x1, y1, target, high = false) {
  const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (target && target.kind === 'building' && inRect(x, y, { bx: target.bx, by: target.by, bw: target.bw, bh: target.bh })) return true;
    // l'eau et les gisements (pierre, fer) sont bas : ils ne bloquent pas les tirs
    const o = solidAt(x, y, 0); if (o && o !== target && o !== RIVER && !ROCKS.includes(o) && !(high && isDefense(o))) return false }
  return true;
}
