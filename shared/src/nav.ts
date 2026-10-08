// Obstacles & navigation : grille de 20 px, A*, glissement contre les obstacles, ligne de tir.
import { W, H, ROCKS, RIVER, TREE_R } from './config';
import { wHit } from './maps';
import { dist, rectDist, inRect } from './util';
import { G, trees } from './state';

export const NC = 20, NW = W / NC, NH = H / NC;
export const navGrid = new Uint8Array(NW * NH);
export let navDirty = true, navVer = 0;
export function dirtyNav() { navDirty = true }
const TB = 80, TBW = W / TB, TBH = H / TB; let treeB: any[][] = [];
function bucketTrees() { treeB = Array.from({ length: TBW * TBH }, () => []); for (const t of trees) if (t.wood > 0) treeB[Math.min(TBH - 1, Math.floor(t.y / TB)) * TBW + Math.min(TBW - 1, Math.floor(t.x / TB))].push(t) }
export function treesNear(x, y, fn) { const cx = Math.floor(x / TB), cy = Math.floor(y / TB); for (let j = cy - 1; j <= cy + 1; j++) { if (j < 0 || j >= TBH) continue; for (let i = cx - 1; i <= cx + 1; i++) { if (i < 0 || i >= TBW) continue; const a = treeB[j * TBW + i]; if (!a) continue; for (let k = 0; k < a.length; k++) { const t = a[k]; if (t.wood > 0 && fn(t)) return t } } } return null }
export function blocksOf(b) {
  if (b.type === 'ferme') return [{ bx: b.x + 24, by: b.y - 58, bw: 36, bh: 48 }];
  return [{ bx: b.bx + 2, by: b.by + 2, bw: b.bw - 4, bh: b.bh - 4 }];
}
export function solidAt(x, y, inf = 0) {
  for (const b of G.buildings) { if (b.dead) continue; for (const q of b.blocks) if (inRect(x, y, q) || (inf > 0 && rectDist(x, y, q) < inf)) return b }
  const R = TREE_R + inf, tt = treesNear(x, y, t => Math.abs(t.x - x) < R && Math.abs(t.y - y) < R && dist(x, y, t.x, t.y) < R); if (tt) return tt;
  for (const st of ROCKS) if (dist(x, y, st.x, st.y) < st.r * .9 + inf) return st;
  if (wHit(x, y, inf + 4)) return RIVER;
  return null;
}
export function buildNav() {
  navGrid.fill(0); const inf = 9; bucketTrees();
  const mark = (x0, y0, x1, y1, test) => {
    const cy0 = Math.max(0, Math.floor((y0 - inf) / NC)), cy1 = Math.min(NH - 1, Math.floor((y1 + inf) / NC));
    const cx0 = Math.max(0, Math.floor((x0 - inf) / NC)), cx1 = Math.min(NW - 1, Math.floor((x1 + inf) / NC));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (test(cx * NC + NC / 2, cy * NC + NC / 2)) navGrid[cy * NW + cx] = 1;
  };
  for (const b of G.buildings) { if (b.dead) continue; for (const q of b.blocks) mark(q.bx, q.by, q.bx + q.bw, q.by + q.bh, (x, y) => inRect(x, y, q) || rectDist(x, y, q) < inf) }
  for (const t of trees) if (t.wood > 0) mark(t.x - TREE_R, t.y - TREE_R, t.x + TREE_R, t.y + TREE_R, (x, y) => dist(x, y, t.x, t.y) < TREE_R + inf);
  for (const st of ROCKS) { const R = st.r * .9; mark(st.x - R, st.y - R, st.x + R, st.y + R, (x, y) => dist(x, y, st.x, st.y) < R + inf) }
  for (let cy = 0; cy < NH; cy++) for (let cx = 0; cx < NW; cx++) { const i = cy * NW + cx; if (!navGrid[i] && wHit(cx * NC + NC / 2, cy * NC + NC / 2, inf + 4)) navGrid[i] = 1 }
  navDirty = false; navVer++;
}
export const cellOf = (x, y) => Math.max(0, Math.min(NH - 1, Math.floor(y / NC))) * NW + Math.max(0, Math.min(NW - 1, Math.floor(x / NC)));
export const cellPt = c => ({ x: (c % NW) * NC + NC / 2, y: ((c / NW) | 0) * NC + NC / 2 });
export function segClear(x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1); if (d < 1) return true;
  const n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) { const t = i / n; if (t * d < 12 || (1 - t) * d < 20) continue; if (navGrid[cellOf(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)]) return false }
  return true;
}
export function nearestFree(c) {
  if (!navGrid[c]) return c; const cx = c % NW, cy = (c / NW) | 0;
  for (let r = 1; r < 16; r++) { let best = -1, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= NW || y >= NH) continue; const n = y * NW + x; if (!navGrid[n]) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n } } }
    if (best >= 0) return best }
  return -1;
}
export function freePoint(x, y, r = 10) { if (!solidAt(x, y, r)) return { x, y }; const c = nearestFree(cellOf(x, y)); return c < 0 ? { x, y } : cellPt(c) }
const gS = new Float32Array(NW * NH), came = new Int32Array(NW * NH), seenS = new Uint32Array(NW * NH), closedS = new Uint32Array(NW * NH); let stamp = 0;
export function findPath(sx, sy, tx, ty) {
  const s = nearestFree(cellOf(sx, sy)), g = nearestFree(cellOf(tx, ty)); if (s < 0 || g < 0) return null;
  stamp++; const hk = [], hv = [], gx = g % NW, gy = (g / NW) | 0;
  const H_ = n => { const dx = Math.abs(n % NW - gx), dy = Math.abs(((n / NW) | 0) - gy); return Math.max(dx, dy) + .414 * Math.min(dx, dy) };
  const push = (n, f) => { let i = hk.length; hk.push(f); hv.push(n); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= hk[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p } };
  const pop = () => { const top = hv[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hk.length && hk[l] < hk[m]) m = l; if (r < hk.length && hk[r] < hk[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m } } return top };
  gS[s] = 0; seenS[s] = stamp; came[s] = -1; push(s, H_(s)); let it = 0;
  while (hk.length && it < 7000) { const c = pop(); if (c === g) break; if (closedS[c] === stamp) continue; closedS[c] = stamp; it++;
    const cx = c % NW, cy = (c / NW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= NW || ny >= NH) continue; const n = ny * NW + nx; if (navGrid[n]) continue;
      if (dx && dy && (navGrid[cy * NW + nx] || navGrid[ny * NW + cx])) continue;
      const ng = gS[c] + (dx && dy ? 1.414 : 1); if (seenS[n] !== stamp || ng < gS[n]) { seenS[n] = stamp; gS[n] = ng; came[n] = c; push(n, ng + H_(n)) } } }
  if (seenS[g] !== stamp) return null;
  const pts = []; for (let c = g; c !== -1; c = came[c]) pts.push(cellPt(c)); pts.reverse(); return pts;
}
function pushCirc(e, cx, cy, R) { const dx = e.x - cx, dy = e.y - cy; if (Math.abs(dx) >= R || Math.abs(dy) >= R) return; const d = Math.hypot(dx, dy); if (d < R) { if (d < .01) { e.x += R; return } e.x = cx + dx / d * R; e.y = cy + dy / d * R } }
function pushRect(e, q, r) {
  const cx = Math.max(q.bx, Math.min(e.x, q.bx + q.bw)), cy = Math.max(q.by, Math.min(e.y, q.by + q.bh)), dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
  if (d > 0) { if (d < r) { e.x = cx + dx / d * r; e.y = cy + dy / d * r } return }
  // coincé à l'intérieur : sortir par le côté libre le plus proche
  const c = [[q.bx - r - 1, e.y, e.x - q.bx], [q.bx + q.bw + r + 1, e.y, q.bx + q.bw - e.x], [e.x, q.by - r - 1, e.y - q.by], [e.x, q.by + q.bh + r + 1, q.by + q.bh - e.y]].sort((a, b) => a[2] - b[2]);
  for (const [x, y] of c) if (x > r && y > r && x < W - r && y < H - r && !solidAt(x, y, r - 2)) { e.x = x; e.y = y; return }
  const f = nearestFree(cellOf(e.x, e.y)); if (f >= 0) { const p = cellPt(f); e.x = p.x; e.y = p.y } else { e.x = c[0][0]; e.y = c[0][1] }
}
export function clampWorld(e) { e.x = Math.max(e.r, Math.min(W - e.r, e.x)); e.y = Math.max(e.r, Math.min(H - e.r, e.y)) }
export function pushOut(e) {
  const r = e.r;
  for (let k = 0; k < 3; k++) {
    treesNear(e.x, e.y, t => { pushCirc(e, t.x, t.y, TREE_R + r); return false });
    for (const st of ROCKS) pushCirc(e, st.x, st.y, st.r * .9 + r);
    for (const b of G.buildings) { if (b.dead || Math.abs(b.x - e.x) > b.bw / 2 + r + 2 || Math.abs(b.y - e.y) > b.bh / 2 + r + 2) continue; for (const q of b.blocks) pushRect(e, q, r) }
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
// déplacement avec contournement des obstacles
export function nav(e, x, y, dt, tol = 4, mul = 1) {
  if (dist(e.x, e.y, x, y) <= tol) { e.stuck = 0; e.stuckN = 0; return true }
  let p = e.path;
  if (!p || p.ver !== navVer || G.t - p.t > 3 || (dist(p.x, p.y, x, y) > 24 && G.t - p.t > .25)) {
    p = e.path = { x, y, ver: navVer, t: G.t, pts: null, i: 0 };
    if (!segClear(e.x, e.y, x, y)) p.pts = findPath(e.x, e.y, x, y);
  }
  let tx = x, ty = y;
  if (p.pts) {
    let k = 0; while (p.i < p.pts.length - 1 && k < 6 && segClear(e.x, e.y, p.pts[p.i + 1].x, p.pts[p.i + 1].y)) { p.i++; k++ }
    const w = p.pts[p.i];
    if (p.i >= p.pts.length - 1 && (segClear(e.x, e.y, x, y) || dist(e.x, e.y, w.x, w.y) < 6)) p.pts = null;
    else { if (dist(e.x, e.y, w.x, w.y) < 6 && p.i < p.pts.length - 1) p.i++; tx = p.pts[p.i].x; ty = p.pts[p.i].y }
  }
  const ox = e.x, oy = e.y; moveTo(e, tx, ty, dt, 0, mul); pushOut(e);
  const moved = dist(ox, oy, e.x, e.y);
  e.stuck = moved < e.speed * mul * dt * .3 ? (e.stuck || 0) + dt : 0;
  const d = dist(e.x, e.y, x, y);
  if (d <= tol || (e.stuck > .4 && d < tol + 40)) { e.stuck = 0; e.stuckN = 0; return true }
  if (e.stuck > 1.2) { e.stuck = 0; e.path = null; e.stuckN = (e.stuckN || 0) + 1; if (e.stuckN >= 3) { e.stuckN = 0; return true } }
  return false;
}
// les flèches s'arrêtent sur les obstacles (sauf la cible visée)
export function shotClear(x0, y0, x1, y1, target) {
  const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (target && target.kind === 'building' && inRect(x, y, { bx: target.bx, by: target.by, bw: target.bw, bh: target.bh })) return true;
    const o = solidAt(x, y, 0); if (o && o !== target && o !== RIVER) return false }
  return true;
}
