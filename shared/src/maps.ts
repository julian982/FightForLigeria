// Les cartes : données, eau, relief. Toutes symétriques, donjons et gisements aux mêmes places.
import { W, H, S, IRON, ROCKS, BRIDGE_Y } from './config';
import { clamp01, dist, rng } from './util';

export const MAPS: Record<string, any> = {
  amboise:{name:"Rives d'Amboise",desc:"La Loire borde le sud, des forêts sur les flancs, le fer au milieu de la plaine. Une carte ouverte et équilibrée.",
    seed:42,treeSeed:1337,amp:.55,
    south:x=>1470+25*Math.sin(x/230)+14*Math.sin(x/97+1),
    path:x=>800+Math.sin(x/260)*70*Math.sin(clamp01((x-300)/(W-600))*Math.PI),
    clusters:[[150,260,120,18],[520,470,80,10],[130,1180,110,16],[470,1420,120,16],[966,720,120,18],[878,250,100,14],[996,1190,110,14],[1336,430,80,8],[1336,1270,80,8]],
    scatter:0,clearings:[],vines:[[1440,190],[1440,1080]],sand:[[620,1545,3.2],[1558,1565,4],[2410,1535,2.6]],bridges:[],
    grass:[0x5f8f3e,0x689c45,0x5a8a3a,0x71a54b,0x638f40]},
  cher:{name:'Confluence du Cher',desc:"Le Cher coupe la carte en deux avant de rejoindre la Loire. Trois passages seulement, et le fer au cœur d'une île que chacun voudra tenir.",
    seed:7,treeSeed:2024,amp:.45,cher:true,
    south:x=>1500+18*Math.cos((x-W/2)/260)+10*Math.cos((x-W/2)/90),
    path:x=>780+60*Math.sin(clamp01((x-300)/(W-600))*Math.PI),
    clusters:[[150,250,120,18],[520,430,90,12],[140,1160,110,16],[470,1320,100,12],[907,560,100,14],[848,210,100,14],[937,1130,110,14],[1203,1010,40,5],[1218,520,45,6]],
    scatter:0,clearings:[],vines:[[640,170],[W-640,170]],sand:[[700,1565,3],[2180,1565,3]],
    bridges:[{x:W/2-70,y:256,w:140,h:84},{x:W/2-228,y:798,w:92,h:84},{x:W/2+228-92,y:798,w:92,h:84},{x:W/2-70,y:1190,w:140,h:84}],
    grass:[0x5c8e3d,0x66994a,0x588a3a,0x6fa34c,0x619242]},
  chinon:{name:'Forêt de Chinon',desc:"Une forêt dense percée de clairières, la Vienne au sud. Le bois abonde, mais on voit mal venir l'ennemi et les flèches s'arrêtent dans les arbres.",
    seed:13,treeSeed:777,amp:.7,
    south:x=>1530+16*Math.cos((x-W/2)/200)+9*Math.cos((x-W/2)/70),
    path:x=>{const t=clamp01((x-300)/(W-600));return 790+70*Math.sin(t*Math.PI)*Math.cos(t*Math.PI*4)},
    clusters:[[150,250,140,22],[520,450,110,16],[140,1170,130,20],[480,1380,120,16],[937,640,140,22],[878,240,130,20],[966,1180,130,20],[1322,420,90,12],[1322,1240,90,12]],
    scatter:420,clearings:[[1440,840,190],[700,980,100],[W-700,980,100],[560,640,110],[W-560,640,110]],vines:[[1440,200]],sand:[[996,1585,2.4],[1884,1585,2.4]],bridges:[],
    grass:[0x4f8036,0x5a8b3c,0x4a7832,0x63964a,0x55873a]},
};
export const MAP_IDS = Object.keys(MAPS);

/** carte chargée (liaison vivante : les autres modules voient toujours la valeur à jour) */
export let MAP: any = MAPS.amboise;
export let MAPID: string | null = null;

// le Cher : un lit vertical au centre, qui se sépare autour de l'île du fer
function cherWater(x, y) { const d = Math.hypot(x - IRON.x, y - IRON.y); if (d < 150) return false; if (d < 215) return true; return Math.abs(x - W / 2) < 50 + 7 * Math.sin(y / 120) }
export function rawWater(x, y) { return y > MAP.south(x) || (MAP.cher === true && cherWater(x, y)) }
export function inBridge(x, y) { for (const b of MAP.bridges) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true; return false }
export const walkWater = (x, y) => rawWater(x, y) && !inBridge(x, y);
export const wHit = (x, y, r) => walkWater(x, y) || walkWater(x + r, y) || walkWater(x - r, y) || walkWater(x, y + r) || walkWater(x, y - r);

// ---- relief + distance à l'eau, précalculés sur une grille de 20 px ----
export const HC = 20, GXV = W / HC + 1, GZV = H / HC + 1, hgrid = new Float32Array(GXV * GZV), dgrid = new Float32Array(GXV * GZV);
function buildTerrain() {
  for (let iz = 0; iz < GZV; iz++) for (let ix = 0; ix < GXV; ix++) dgrid[iz * GXV + ix] = rawWater(ix * HC, iz * HC) ? 0 : 1e9;
  const D1 = HC, D2 = HC * 1.4142;
  for (let iz = 0; iz < GZV; iz++) for (let ix = 0; ix < GXV; ix++) { const i = iz * GXV + ix; let v = dgrid[i];
    if (ix > 0) v = Math.min(v, dgrid[i - 1] + D1);
    if (iz > 0) { v = Math.min(v, dgrid[i - GXV] + D1); if (ix > 0) v = Math.min(v, dgrid[i - GXV - 1] + D2); if (ix < GXV - 1) v = Math.min(v, dgrid[i - GXV + 1] + D2) }
    dgrid[i] = v }
  for (let iz = GZV - 1; iz >= 0; iz--) for (let ix = GXV - 1; ix >= 0; ix--) { const i = iz * GXV + ix; let v = dgrid[i];
    if (ix < GXV - 1) v = Math.min(v, dgrid[i + 1] + D1);
    if (iz < GZV - 1) { v = Math.min(v, dgrid[i + GXV] + D1); if (ix < GXV - 1) v = Math.min(v, dgrid[i + GXV + 1] + D2); if (ix > 0) v = Math.min(v, dgrid[i + GXV - 1] + D2) }
    dgrid[i] = v }
  const f = (d, a, b) => clamp01((d - a) / (b - a));
  for (let iz = 0; iz < GZV; iz++) for (let ix = 0; ix < GXV; ix++) { const i = iz * GXV + ix, px = ix * HC, pz = iz * HC, x = px * S, z = pz * S, dw = dgrid[i];
    if (dw === 0) { hgrid[i] = -.25; continue }
    const n = (Math.sin(x * 1.7 + z * .9) * .5 + .5) * .05 + (Math.sin(x * .37 - z * .71) * .5 + .5) * .06;
    const h = .26 * Math.sin(x * .17 + .6) * Math.cos(z * .21) + .16 * Math.sin(x * .09 - z * .13 + 1.3) + .08 * Math.sin(x * .31 + z * .27);
    const k = f(Math.min(Math.hypot(px - 300, pz - 780), Math.hypot(px - W + 300, pz - 780)), 140, 320) * f(Math.min(x, W * S - x, z), 0, 2.5) * f(dw, 30, 160);
    hgrid[i] = dw <= HC * 1.01 ? .02 : .03 + n * (dw < 40 ? .4 : 1) + (h + .5) * MAP.amp * k }
}
/** charge une carte (eau + relief). Renvoie l'identifiant retenu. */
export function loadMap(id: string) {
  if (!MAPS[id]) id = 'amboise';
  MAP = MAPS[id]; MAPID = id; buildTerrain();
  return id;
}
export const wDist = (px, py) => dgrid[Math.max(0, Math.min(GZV - 1, Math.round(py / HC))) * GXV + Math.max(0, Math.min(GXV - 1, Math.round(px / HC)))];
/** hauteur du sol (en unités 3D) au point monde px,py */
export function gh(px, py) {
  if (MAP.bridges.length && inBridge(px, py)) return BRIDGE_Y;
  const fx = Math.max(0, Math.min(GXV - 1.001, px / HC)), fz = Math.max(0, Math.min(GZV - 1.001, py / HC)), ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * GXV + ix;
  return (hgrid[i] * (1 - tx) + hgrid[i + 1] * tx) * (1 - tz) + (hgrid[i + GXV] * (1 - tx) + hgrid[i + GXV + 1] * tx) * tz;
}
/** les arbres de la carte chargée : générés sur la moitié gauche puis copiés en miroir */
export function genTrees() {
  const r = rng(MAP.treeSeed), half = [], Mp = MAP;
  const ok = (x, y) => {
    if (x < 20 || y < 20 || y > H - 20 || x > W / 2 - 30) return false;
    if (dist(x, y, 300, 780) < (Mp.scatter ? 300 : 200)) return false;
    if (ROCKS.some(s => dist(x, y, s.x, s.y) < s.r + 24)) return false;
    if (wDist(x, y) < 40 || inBridge(x, y)) return false;
    if (Mp.clearings.some(([cx, cy, cr]) => dist(x, y, cx, cy) < cr)) return false;
    if (Mp.vines.some(([vx, vy]) => Math.abs(x - vx) < 160 && Math.abs(y - vy) < 70)) return false;
    if (Mp.scatter && x > 260 && Math.abs(y - Mp.path(x)) < 45) return false;
    for (const t of half) if (Math.abs(t.x - x) < 27 && Math.abs(t.y - y) < 27 && dist(t.x, t.y, x, y) < 27) return false;
    return true;
  };
  const add = (x, y) => half.push({ x, y, r: 13 + r() * 4, wood: 5, sh: r(), v: r() < .5 ? 0 : r() < .7 ? 1 : 2 });
  for (const [cx, cy, rad, n] of Mp.clusters) for (let i = 0; i < n * 2; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (ok(x, y)) add(x, y) }
  for (let i = 0; i < Mp.scatter; i++) { const x = r() * W / 2, y = r() * H; if (ok(x, y)) add(x, y) }
  const out = []; for (const t of half) { out.push(t); out.push({ ...t, x: W - t.x, sh: (t.sh + .37) % 1 }) }
  return out;
}
