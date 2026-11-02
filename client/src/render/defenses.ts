// Les défenses en low poly stylisé, comme les autres bâtiments : murs (palissade de rondins ou tuffeau taillé) avec chemin
// de ronde et créneaux légers, portes, escaliers de bois et tours. Un segment de mur se raccorde à ses voisins : les
// créneaux ne bordent que les côtés libres, et deux segments en diagonale sont reliés par un pan de mur.
// Les hauteurs du chemin de ronde suivent TOP_H (shared/src/config.ts) : c'est là que se tiennent les soldats montés.
import * as THREE from 'three';
import { DEF, G, TOP_H, stairTop } from '@ffl/shared';
import { Kit, P, cbox, cyl, cone, arch, teamPal } from './stylized';

// voisins d'un segment : bits N, E, S, O puis diagonales NE, SE, SO, NO
const N = 1, E = 2, S = 4, Wb = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const DIRS: [number, number, number][] = [[0, -1, N], [1, 0, E], [0, 1, S], [-1, 0, Wb], [1, -1, NE], [1, 1, SE], [-1, 1, SW], [-1, -1, NW]];
const linkable = (b: any) => { const d = DEF[b.type].def; return d === 'mur' || d === 'porte' || d === 'tour' };
/** quels voisins d'une défense sont aussi des murs, portes ou tours du même joueur */
export function defMask(b: any) {
  if (!DEF[b.type].def || DEF[b.type].w > 1) return 0;
  let m = 0;
  for (const o of G.buildings) {
    if (o === b || o.dead || o.team !== b.team || !DEF[o.type].def || !linkable(o)) continue;
    for (const [dx, dy, bit] of DIRS) { const x = b.tx + dx, y = b.ty + dy; if (x >= o.tx && x < o.tx + DEF[o.type].w && y >= o.ty && y < o.ty + DEF[o.type].h) m |= bit }
  }
  return m;
}

/** épaisseur des murs (une case = 1) : le chemin de ronde est un peu plus étroit que la case */
export const WALL_T = .7;
/** créneaux le long d'une face (repère : face le long de x, à z = -off) */
function merlons(k: Kit, wood: boolean, y: number, len: number, off: number) {
  if (wood) for (let x = -len / 2 + .06; x < len / 2 - .02; x += .135) { k.add(cyl(.045, .05, .22, 5), k.pick([P.woodM, P.woodD, P.woodL]), x, y, -off + .04); k.add(cone(.05, .1, 5), P.woodD, x, y + .22, -off + .04) }
  else { const n = Math.max(1, Math.round(len / .42)); for (let i = 0; i < n; i++) k.add(k.stone(.2, .24, .12, .015), k.pick([P.tufL, P.tuf]), -len / 2 + (i + .5) * len / n, y, -off + .06) }
}
/** parement d'une face : rondins verticaux (bois) ou assises de tuffeau décalées (pierre), puis ses créneaux */
function face(k: Kit, wood: boolean, H: number, len: number, off: number) {
  if (wood) {
    for (let x = -len / 2 + .055; x < len / 2; x += .11) k.add(cyl(.058, .062, H - .04 + (k.rnd() - .5) * .05, 6), k.pick([P.woodM, P.woodL, P.woodM, P.woodD]), x, 0, -off + .03);
    for (const y of [H * .3, H * .72]) k.add(cbox(len, .05, .04, .01), P.woodDD, 0, y, -off - .03);
  } else {
    const rowH = .2;
    for (let r = 0; r * rowH < H - .08; r++) { let x = -len / 2, first = r % 2 ? .13 : 0;
      while (x < len / 2 - .01) { let l = first || .22 + k.rnd() * .14; first = 0; if (x + l > len / 2) l = len / 2 - x; if (l > .05) k.add(k.stone(l - .015, rowH - .015, .06, .012), k.pick([P.tufL, P.tufL, P.tuf, P.tufM]), x + l / 2, r * rowH, -off + .02); x += l } }
  }
  merlons(k, wood, H, len, off);
}
/** un tronçon de mur, de longueur len (le long de x) et d'épaisseur t, centré ; faces parementées : [z−, z+, x−, x+] */
function piece(k: Kit, wood: boolean, H: number, len: number, t: number, faces: boolean[]) {
  k.add(cbox(len, H - .05, t, .02), wood ? P.woodD : P.tufM, 0, 0, 0);
  if (!wood) k.add(k.stone(len + .04, .1, t + .06, .015), P.stoneD, 0, -.02, 0); // soubassement
  // chemin de ronde : planches ou dalles
  if (wood) for (let x = -len / 2 + .07; x < len / 2; x += .14) k.add(cbox(.13, .05, t + .02, .01), k.pick([P.woodL, P.woodM]), x, H - .05, 0);
  else k.add(cbox(len + .01, .05, t + .01, .01), P.tufD, 0, H - .05, 0);
  if (faces[0]) face(k, wood, H, len, t / 2);
  if (faces[1]) k.at(0, 0, 0, Math.PI, () => face(k, wood, H, len, t / 2));
  if (faces[2]) k.at(0, 0, 0, Math.PI / 2, () => face(k, wood, H, t, len / 2));
  if (faces[3]) k.at(0, 0, 0, -Math.PI / 2, () => face(k, wood, H, t, len / 2));
}
/**
 * le mur d'une case : un noyau au centre et un bras vers chaque voisin (droit, ou en diagonale jusqu'à l'angle partagé),
 * si bien que les segments se raccordent quelle que soit la forme du tracé ; créneaux sur chaque face libre
 */
function wallBody(k: Kit, wood: boolean, H: number, mask: number) {
  const t = WALL_T, L = .5 - t / 2 + .01;
  const orth = ([[N, 0, -1], [E, 1, 0], [S, 0, 1], [Wb, -1, 0]] as [number, number, number][]).filter(([bit]) => mask & bit);
  const diag = ([[NE, N, E, -Math.PI / 4], [SE, S, E, Math.PI / 4], [SW, S, Wb, 3 * Math.PI / 4], [NW, N, Wb, -3 * Math.PI / 4]] as [number, number, number, number][])
    .filter(([bit, a, b2]) => (mask & bit) && !(mask & a) && !(mask & b2));
  // segment isolé : un petit pan est-ouest
  const lone = !orth.length && !diag.length;
  const arms = lone ? [[E, 1, 0], [Wb, -1, 0]] as [number, number, number][] : orth;
  const has = (bit: number) => arms.some(a => a[0] === bit);
  piece(k, wood, H, t, t, [!has(N), !has(S), !has(Wb), !has(E)]);
  for (const [, dx, dz] of arms) {
    const c = t / 2 + L / 2 - .005;
    k.at(dx * c, 0, dz * c, dx ? 0 : Math.PI / 2, () => piece(k, wood, H, L, t, [true, true, lone && dx < 0, lone && dx > 0]));
  }
  for (const [, , , ang] of diag) {
    const s0 = t * .3, s1 = .74, len = s1 - s0, c = (s0 + s1) / 2;
    k.at(Math.cos(ang) * c, 0, Math.sin(ang) * c, -ang, () => piece(k, wood, H, len, t, [true, true, false, false]));
  }
}

export function buildWall(g: any, b: any) {
  const k = new Kit(b.id * 911 + 7), wood = DEF[b.type].mat === 'bois', H = TOP_H[b.type], mask = b.mask ?? defMask(b);
  wallBody(k, wood, H, mask);
  k.build(g);
}
export function buildGate(g: any, b: any) {
  const k = new Kit(b.id * 577 + 3), wood = DEF[b.type].mat === 'bois', H = TOP_H[b.type], mask = b.mask ?? defMask(b), team = teamPal(b.team), t = WALL_T;
  // le passage traverse le mur : nord-sud si le mur court d'est en ouest, sinon est-ouest
  const ns = !!(mask & (E | Wb)) || !(mask & (N | S));
  k.at(0, 0, 0, ns ? 0 : Math.PI / 2, () => {
    // piliers de part et d'autre du passage
    for (const x of [-.38, .38]) k.at(x, 0, 0, 0, () => piece(k, wood, H, .24, t + .06, [true, true, x < 0 && !(mask & (ns ? Wb : N)), x > 0 && !(mask & (ns ? E : S))]));
    // linteau et chemin de ronde au-dessus du passage
    k.add(cbox(.54, H * .3, t, .02), wood ? P.woodD : P.tufM, 0, H * .7, 0);
    k.add(cbox(.54, .05, t + .01, .01), wood ? P.woodL : P.tufD, 0, H - .05, 0);
    for (const s of [-1, 1]) k.at(0, 0, 0, s > 0 ? 0 : Math.PI, () => {
      // vantaux fermés, cerclés de fer, écu aux couleurs du royaume
      if (wood) { for (let x = -.24; x <= .25; x += .1) k.add(cbox(.09, H * .68, .05, .01), k.pick([P.woodL, P.woodM]), x, 0, -t / 2 + .06) }
      else k.add(arch(.52, H * .72, .05), P.woodM, 0, 0, -t / 2 + .06);
      for (const y of [.2, .55, .9]) if (y < H * .68) k.add(cbox(.54, .04, .02, .005), P.iron, 0, y, -t / 2 + .03);
      k.add(new THREE.CylinderGeometry(.08, .08, .02, 8), team.main, 0, H * .84, -t / 2 - .005, Math.PI / 2);
      merlons(k, wood, H, .54, t / 2);
    });
  });
  k.build(g);
}
export function buildStair(g: any, b: any) {
  const k = new Kit(b.id * 313 + 5), H = stairTop(b), n = Math.max(6, Math.round(H / .16)), dir = b.dir ?? 0;
  // marches de bois qui montent vers le mur (repère : montée vers -z), sur deux limons et des poteaux
  k.at(0, 0, 0, -dir * Math.PI / 2, () => {
    // la rampe déborde un peu sur la case du mur, dont le chemin de ronde est plus étroit que la case
    const Lr = 1 + (.5 - WALL_T / 2), zc = .5 - Lr / 2, ang = Math.atan2(H, Lr), len = Math.hypot(Lr, H);
    for (let i = 0; i < n; i++) { const h = H * (i + 1) / n, z = .5 - (i + .5) * Lr / n; k.add(cbox(.74, .06, Lr / n + .01, .01), k.pick([P.woodL, P.woodM]), 0, h - .06, z); k.add(cbox(.7, h - .06, .04, .005), P.woodD, 0, 0, z + .5 * Lr / n - .02) }
    for (const x of [-.4, .4]) { k.add(cbox(.06, .1, len, .01), P.woodDD, x, H / 2 - .05, zc, ang); k.add(cyl(.035, .035, H + .25, 5), P.woodD, x, 0, -.45); k.add(cbox(.04, .04, len, .005), P.woodM, x, H / 2 + .28, zc, ang) }
  });
  k.build(g);
}
export function buildTower(g: any, b: any) {
  const k = new Kit(b.id * 733 + 11), wood = DEF[b.type].mat === 'bois', H = TOP_H[b.type], team = teamPal(b.team);
  if (wood) {
    // tour de guet : quatre poteaux, croisillons, plateforme à garde-corps de pieux, petite échelle de service
    for (const [x, z] of [[-.72, -.72], [.72, -.72], [.72, .72], [-.72, .72]]) { k.add(cyl(.1, .12, H + .05, 7), P.woodM, x, 0, z); k.add(k.stone(.32, .1, .32, .02), P.stoneD, x, 0, z) }
    for (const [ry, z] of [[0, -.72], [0, .72], [Math.PI / 2, -.72], [Math.PI / 2, .72]] as [number, number][]) k.at(0, 0, 0, ry, () => {
      for (const y of [.15, H * .55]) { k.add(cbox(1.5, .06, .06, .01), P.woodD, 0, y, z); k.add(cbox(1.6, .07, .07, .01), P.woodDD, 0, y + .32, z, 0, 0, .38 * (y > .2 ? 1 : -1)) } });
    k.add(cbox(1.8, .12, 1.8, .02), P.woodD, 0, H - .12, 0);
    for (let x = -.8; x <= .81; x += .2) for (let z = -.8; z <= .81; z += .2) if (Math.abs(x) > .7 || Math.abs(z) > .7) { k.add(cyl(.05, .055, .32, 5), k.pick([P.woodM, P.woodL]), x, H, z); k.add(cone(.055, .1, 5), P.woodD, x, H + .32, z) }
    for (let x = -.72; x <= .73; x += .12) k.add(cbox(.11, .03, 1.5, .005), k.pick([P.woodL, P.woodM]), x, H - .01, 0);
  } else {
    // tour ronde de tuffeau : assises de pierre, meurtrières, couronne de merlons
    const R = .86, rows = Math.round(H / .2);
    for (let r = 0; r < rows; r++) { const off = (r % 2) * .2, n = 12; for (let i = 0; i < n; i++) { const a = (i + off) / n * Math.PI * 2; k.add(k.stone(.42, .19, .2, .015), k.pick([P.tufL, P.tufL, P.tuf, P.tufM]), Math.cos(a) * R, r * .2, Math.sin(a) * R, 0, -a + Math.PI / 2) } }
    k.add(cyl(R - .05, R + .02, H, 12), P.tufM, 0, 0, 0);
    k.add(k.stone(2.0, .12, 2.0, .02), P.stoneD, 0, -.04, 0);
    k.add(cyl(R + .1, R + .1, .1, 12), P.tufD, 0, H - .08, 0);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (i % 2) k.add(k.stone(.28, .26, .16, .015), k.pick([P.tufL, P.tuf]), Math.cos(a) * (R + .04), H, Math.sin(a) * (R + .04), 0, -a + Math.PI / 2) }
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) k.add(cbox(.06, .3, .05, .01), P.dark, Math.cos(a) * (R + .02), H * .55, Math.sin(a) * (R + .02), 0, -a + Math.PI / 2);
    k.add(arch(.34, .5, .06), P.woodM, 0, 0, R + .02);
  }
  k.build(g);
  // bannière du royaume au sommet
  const pole = new THREE.Group(); pole.position.set(wood ? .7 : .55, H, wood ? -.7 : -.55);
  const f = new Kit(b.id * 7 + 1); f.add(cyl(.02, .025, .9, 5), P.woodDD, 0, 0, 0); f.build(pole); g.add(pole);
  const piv = new THREE.Group(); piv.position.set(0, .86, 0); pole.add(piv);
  const fk = new Kit(b.id * 13 + 2); fk.add(cbox(.4, .24, .025, .006), team.main, .22, -.24, 0); fk.add(cbox(.08, .08, .02, .02), P.gold, .22, -.12, .014, 0, 0, Math.PI / 4); fk.build(piv);
  b.flags.push(piv);
}
